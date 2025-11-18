export interface DisplayUpdate {
  type: string;
  update: any;
  timestamp: number;
}

export class DisplayWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Set<Function>> = new Map();

  constructor(private workerUrl: string) {}

  connect(sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.workerUrl
        .replace('https://', 'wss://')
        .replace('http://', 'ws://');

      this.ws = new WebSocket(`${wsUrl}/session/${sessionId}/display`);

      this.ws.onopen = () => {
        console.log('Display WebSocket connected');
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed, attempting reconnect...');
        this.attemptReconnect(sessionId);
      };
    });
  }

  private handleMessage(data: any) {
    if (data.type === 'initial_state') {
      this.emit('initial_state', data.state);
    } else if (data.type === 'update') {
      this.emit('update', data.update);
    } else if (data.type === 'pong') {
      // Handle ping/pong
    }
  }

  private attemptReconnect(sessionId: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      this.emit('error', new Error('Failed to reconnect'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      console.log(`Reconnect attempt ${this.reconnectAttempts}...`);
      this.connect(sessionId).catch((err) => {
        console.error('Reconnect failed:', err);
      });
    }, delay);
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(event: string, data: any) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  sendPing() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ping' }));
    }
  }

  /**
   * Send user action (button click) to backend via Durable Object
   */
  sendAction(action: string, data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message = {
        type: 'user_action',
        action,
        data,
        timestamp: Date.now()
      };
      this.ws.send(JSON.stringify(message));
      console.log('[DisplayWebSocket] Sent action:', action, data);
    } else {
      console.error('[DisplayWebSocket] Cannot send action - WebSocket not connected');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
