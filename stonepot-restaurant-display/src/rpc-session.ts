/**
 * CapnWeb RPC-enabled Session Manager
 * Exposes display operations as RPC methods
 */

import { DurableObject } from 'cloudflare:workers';
import { newHttpBatchRpcResponse, newWorkersWebSocketRpcResponse } from 'capnweb';
import type { Env } from './types';
import type {
  DisplayRPC,
  BackendDisplayRPC,
  ClientDisplayCallback,
  DishCardData,
  TranscriptionData,
  OrderSummaryData,
  CartItemData,
  ConversationState,
  DisplayUpdate
} from './rpc-types';

export class RpcSessionManager extends DurableObject implements BackendDisplayRPC {
  private conversationState: ConversationState;
  private clients: Set<ClientDisplayCallback>;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.clients = new Set();

    // Initialize conversation state
    this.conversationState = {
      sessionId: '',
      tenantId: '',
      category: 'restaurant',
      transcriptions: [],
      displayUpdates: [],
      currentOrder: undefined,
      createdAt: Date.now(),
      lastActivity: Date.now()
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

    // CapnWeb RPC endpoint - HTTP batch RPC for external clients
    if (url.pathname === '/rpc') {
      // Use newHttpBatchRpcResponse for HTTP-based RPC from external services (like our backend)
      // This creates a Response that handles RPC requests using this object as the local main
      return newHttpBatchRpcResponse(request, this);
    }

    // CapnWeb RPC over WebSocket
    if (url.pathname === '/rpc-ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }
      return newWorkersWebSocketRpcResponse(request, this);
    }

    // Legacy HTTP endpoints for backward compatibility
    if (url.pathname === '/update' && request.method === 'POST') {
      const update = await request.json<DisplayUpdate>();
      await this.handleLegacyUpdate(update);
      return Response.json({
        success: true,
        connectedClients: this.clients.size
      });
    }

    if (url.pathname === '/state') {
      return Response.json(this.conversationState);
    }

    if (url.pathname === '/init' && request.method === 'POST') {
      const { sessionId, tenantId, category } = await request.json();
      this.conversationState.sessionId = sessionId;
      this.conversationState.tenantId = tenantId;
      this.conversationState.category = category || 'restaurant';
      await this.persistState();
      return Response.json({ success: true });
    }

    return new Response('Not found', { status: 404 });
  }

  // ==========================================
  // RPC Interface Implementation
  // ==========================================

  async initSession(tenantId: string, category: string = 'restaurant'): Promise<{ success: boolean }> {
    this.conversationState.tenantId = tenantId;
    this.conversationState.category = category;
    this.conversationState.lastActivity = Date.now();
    await this.persistState();

    console.log('[RpcSession] Initialized:', { tenantId, category });
    return { success: true };
  }

  async registerClient(callback: ClientDisplayCallback): Promise<void> {
    this.clients.add(callback);

    // Send initial state to new client
    try {
      callback.onInitialState(this.conversationState);
    } catch (error) {
      console.error('[RpcSession] Error sending initial state:', error);
    }

    console.log('[RpcSession] Client registered. Total clients:', this.clients.size);
  }

  async unregisterClient(): Promise<void> {
    // Note: In actual implementation, we'd need client identification
    // For now, this is a placeholder
    console.log('[RpcSession] Client unregistered');
  }

  async showDish(dish: DishCardData): Promise<void> {
    const update: DisplayUpdate = {
      type: 'dish_card',
      data: dish,
      timestamp: Date.now()
    };

    this.conversationState.displayUpdates.push(update);
    this.conversationState.lastActivity = Date.now();
    await this.persistState();

    // Broadcast to all clients
    this.broadcastToClients(update);

    console.log('[RpcSession] Dish shown:', dish.name);
  }

  async addTranscription(transcription: TranscriptionData): Promise<void> {
    this.conversationState.transcriptions.push(transcription);
    this.conversationState.lastActivity = Date.now();
    await this.persistState();

    const update: DisplayUpdate = {
      type: 'transcription',
      text: transcription.text,
      speaker: transcription.speaker,
      timestamp: transcription.timestamp,
      isFinal: transcription.isFinal
    };

    this.broadcastToClients(update);
  }

  async showOrderSummary(summary: OrderSummaryData): Promise<void> {
    const update: DisplayUpdate = {
      type: 'order_summary',
      data: summary,
      timestamp: Date.now()
    };

    this.conversationState.displayUpdates.push(update);
    this.conversationState.currentOrder = summary;
    this.conversationState.lastActivity = Date.now();
    await this.persistState();

    this.broadcastToClients(update);

    console.log('[RpcSession] Order summary shown:', summary.items.length, 'items');
  }

  async showCartItemAdded(item: CartItemData): Promise<void> {
    const update: DisplayUpdate = {
      type: 'cart_item_added',
      data: item,
      timestamp: Date.now()
    };

    this.conversationState.displayUpdates.push(update);
    this.conversationState.lastActivity = Date.now();
    await this.persistState();

    this.broadcastToClients(update);

    console.log('[RpcSession] Cart item added:', item.name);
  }

  async updateCart(items: CartItemData[]): Promise<void> {
    const update: DisplayUpdate = {
      type: 'cart_updated',
      data: { items },
      timestamp: Date.now()
    };

    this.conversationState.displayUpdates.push(update);
    this.conversationState.lastActivity = Date.now();
    await this.persistState();

    this.broadcastToClients(update);

    console.log('[RpcSession] Cart updated:', items.length, 'items');
  }

  async clearDisplay(): Promise<void> {
    // Keep transcriptions but clear display updates
    this.conversationState.displayUpdates = [];
    this.conversationState.lastActivity = Date.now();
    await this.persistState();

    const update: DisplayUpdate = {
      type: 'dish_card',
      data: null,
      timestamp: Date.now()
    };

    this.broadcastToClients(update);

    console.log('[RpcSession] Display cleared');
  }

  async getState(): Promise<ConversationState> {
    return this.conversationState;
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  private broadcastToClients(update: DisplayUpdate) {
    const failedClients: ClientDisplayCallback[] = [];

    for (const client of this.clients) {
      try {
        client.onDisplayUpdate(update);
      } catch (error) {
        console.error('[RpcSession] Error broadcasting to client:', error);
        failedClients.push(client);
      }
    }

    // Clean up failed clients
    failedClients.forEach(client => this.clients.delete(client));
  }

  private async persistState() {
    await this.ctx.storage.put('state', this.conversationState);
  }

  /**
   * Handle legacy update format for backward compatibility
   */
  private async handleLegacyUpdate(update: DisplayUpdate) {
    switch (update.type) {
      case 'dish_card':
      case 'menu_item':
      case 'combo_item':
        if (update.data) {
          await this.showDish(update.data);
        }
        break;

      case 'transcription':
        if (update.text) {
          await this.addTranscription({
            text: update.text,
            speaker: update.speaker || 'user',
            timestamp: update.timestamp,
            isFinal: update.isFinal
          });
        }
        break;

      case 'order_summary':
        if (update.data) {
          await this.showOrderSummary(update.data);
        }
        break;

      case 'cart_item_added':
        if (update.data) {
          await this.showCartItemAdded(update.data);
        }
        break;

      case 'cart_updated':
        if (update.data?.items) {
          await this.updateCart(update.data.items);
        }
        break;

      default:
        // Store unknown update types as-is
        this.conversationState.displayUpdates.push(update);
        await this.persistState();
    }
  }
}
