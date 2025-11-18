import { DurableObject } from 'cloudflare:workers';
import type { Env, DisplayClient, ConversationState, DisplayUpdate, SessionInit } from './types';

export class SessionManager extends DurableObject {
  private displays: Map<WebSocket, DisplayClient>;
  private conversationState: ConversationState;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.displays = new Map();

    // Restore hibernated WebSocket connections
    this.ctx.getWebSockets().forEach((ws) => {
      const meta = ws.deserializeAttachment() as DisplayClient;
      this.displays.set(ws, meta);
    });

    // Initialize conversation state
    this.conversationState = {
      sessionId: '',
      tenantId: '',
      currentOrder: null,
      transcriptions: [],
      displayUpdates: [],
      startedAt: Date.now()
    };

    // Restore state from storage
    this.restoreState();
  }

  async restoreState() {
    const saved = await this.ctx.storage.get<ConversationState>('state');
    if (saved) {
      this.conversationState = saved;
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket connection endpoint for display clients
    if (url.pathname === '/display') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }

      const pair = new WebSocketPair();
      await this.handleDisplayConnection(pair[1], request);

      return new Response(null, {
        status: 101,
        webSocket: pair[0]
      });
    }

    // HTTP endpoint for updates from Bun server
    if (url.pathname === '/update' && request.method === 'POST') {
      const update = await request.json<DisplayUpdate>();
      await this.handleUpdate(update);

      return Response.json({
        success: true,
        connectedClients: this.displays.size
      });
    }

    // Get current conversation state
    if (url.pathname === '/state') {
      return Response.json(this.conversationState);
    }

    // Initialize session (called once at start)
    if (url.pathname === '/init' && request.method === 'POST') {
      const init = await request.json<SessionInit>();
      this.conversationState.sessionId = init.sessionId;
      this.conversationState.tenantId = init.tenantId;
      await this.persistState();

      return Response.json({ success: true });
    }

    return new Response('Not found', { status: 404 });
  }

  async handleDisplayConnection(ws: WebSocket, request: Request) {
    // Accept with hibernation support
    this.ctx.acceptWebSocket(ws);

    // Store client metadata (max 2KB)
    const clientInfo: DisplayClient = {
      connectedAt: Date.now(),
      clientId: crypto.randomUUID(),
      userAgent: request.headers.get('User-Agent') || 'unknown'
    };

    ws.serializeAttachment(clientInfo);
    this.displays.set(ws, clientInfo);

    // Send current state immediately to new client
    ws.send(JSON.stringify({
      type: 'initial_state',
      state: this.conversationState,
      timestamp: Date.now()
    }));

    console.log(`Display connected. Total displays: ${this.displays.size}`);
  }

  async handleUpdate(update: DisplayUpdate) {
    // Update conversation state based on type
    switch (update.type) {
      case 'transcription':
        if (update.text) {
          this.conversationState.transcriptions.push({
            text: update.text,
            speaker: update.speaker || 'user',
            timestamp: update.timestamp
          });
        }
        break;

      case 'dish_card':
      case 'menu_section':
      case 'order_summary':
      case 'confirmation':
      case 'webpage':
      case 'snippet':
      case 'cart_item_added':  // NEW: Cart item added notification
      case 'cart_updated':     // NEW: Cart updated
        this.conversationState.displayUpdates.push(update);
        break;

      case 'order_update':
        if (update.order) {
          this.conversationState.currentOrder = update.order;
        }
        break;
    }

    // Persist state to durable storage
    await this.persistState();

    // Broadcast to all connected displays
    this.broadcast({
      type: 'update',
      update: update,
      timestamp: Date.now()
    });
  }

  async persistState() {
    await this.ctx.storage.put('state', this.conversationState);
  }

  broadcast(message: any) {
    const msgStr = JSON.stringify(message);
    const failed: WebSocket[] = [];

    this.ctx.getWebSockets().forEach((ws) => {
      try {
        ws.send(msgStr);
      } catch (err) {
        console.error('Failed to send to client:', err);
        failed.push(ws);
      }
    });

    // Clean up failed connections
    failed.forEach((ws) => {
      this.displays.delete(ws);
      try {
        ws.close(1011, 'Send failed');
      } catch {}
    });
  }

  // WebSocket Hibernation API handlers
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      const data = JSON.parse(message.toString());

      // Handle messages from display clients
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
      // Handle user actions (button clicks) from display
      else if (data.type === 'user_action') {
        await this.forwardActionToBackend(data);
      }

      console.log('Display message:', data);
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  }

  /**
   * Forward user action from display to backend server
   */
  async forwardActionToBackend(actionData: any) {
    try {
      // Get backend URL from environment
      const backendUrl = this.env.BACKEND_URL ||
        'https://stonepot-restaurant-334610188311.us-central1.run.app';

      console.log('[SessionManager] Forwarding action to backend', {
        sessionId: this.conversationState.sessionId,
        action: actionData.action,
        backendUrl
      });

      const response = await fetch(
        `${backendUrl}/api/restaurant/sessions/${this.conversationState.sessionId}/actions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: actionData.action,
            data: actionData.data
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Backend action failed: ${response.statusText}`);
      }

      const result = await response.json();

      console.log('[SessionManager] Action result:', result);

      // Broadcast result to all displays
      this.broadcast({
        type: 'action_result',
        action: actionData.action,
        result: result,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[SessionManager] Failed to forward action:', error);

      // Broadcast error to displays
      this.broadcast({
        type: 'action_error',
        action: actionData.action,
        error: (error as Error).message,
        timestamp: Date.now()
      });
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    this.displays.delete(ws);
    console.log(`Display disconnected. Remaining: ${this.displays.size}`);
  }

  async webSocketError(ws: WebSocket, error: any) {
    this.displays.delete(ws);
    console.error('WebSocket error:', error);
  }
}
