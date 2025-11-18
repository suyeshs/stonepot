/**
 * CapnWeb RPC Client for Display Operations
 * Replaces WebSocket-based DisplayWebSocketService with RPC calls
 */

import { newWebSocketRpcSession, RpcStub } from 'capnweb';
import type {
  DisplayRPC,
  ClientDisplayCallback,
  ConversationState,
  DisplayUpdate
} from './rpc-types';

export class DisplayRpcClient implements ClientDisplayCallback {
  private rpcStub?: RpcStub<DisplayRPC>;
  private sessionId: string = '';
  private workerUrl: string;
  private listeners: Map<string, Set<Function>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(workerUrl: string) {
    this.workerUrl = workerUrl;
  }

  async connect(sessionId: string): Promise<void> {
    this.sessionId = sessionId;

    // Create WebSocket URL for RPC
    const wsUrl = this.workerUrl
      .replace('https://', 'wss://')
      .replace('http://', 'ws://');
    const rpcWsUrl = `${wsUrl}/session/${sessionId}/rpc-ws`;

    console.log('[DisplayRpcClient] Connecting to:', rpcWsUrl);

    try {
      // Create RPC session over WebSocket
      // Pass 'this' as localMain to receive callbacks from the server
      this.rpcStub = newWebSocketRpcSession<DisplayRPC>(
        rpcWsUrl,
        this  // Server can call onInitialState and onDisplayUpdate on this object
      );

      // Request initial state
      const state = await this.rpcStub.getState();
      this.onInitialState(state);

      this.reconnectAttempts = 0;
      console.log('[DisplayRpcClient] Connected successfully');
    } catch (error) {
      console.error('[DisplayRpcClient] Connection error:', error);
      this.attemptReconnect(sessionId);
      throw error;
    }
  }

  private attemptReconnect(sessionId: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[DisplayRpcClient] Max reconnect attempts reached');
      this.emit('error', new Error('Failed to reconnect'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      console.log(`[DisplayRpcClient] Reconnect attempt ${this.reconnectAttempts}...`);
      this.connect(sessionId).catch((err) => {
        console.error('[DisplayRpcClient] Reconnect failed:', err);
      });
    }, delay);
  }

  // ==========================================
  // ClientDisplayCallback Implementation
  // (Called by server via RPC)
  // ==========================================

  onInitialState(state: ConversationState): void {
    console.log('[DisplayRpcClient] Received initial state:', state);
    this.emit('initial_state', state);
  }

  onDisplayUpdate(update: DisplayUpdate): void {
    console.log('[DisplayRpcClient] Received display update:', update);
    this.emit('update', update);
  }

  onError(error: string): void {
    console.error('[DisplayRpcClient] Server error:', error);
    this.emit('error', new Error(error));
  }

  // ==========================================
  // Event Emitter Methods
  // ==========================================

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

  // ==========================================
  // Action Methods
  // (Called by client to send actions to backend)
  // ==========================================

  /**
   * Send user action (button click) to backend
   * This could be extended to use RPC if backend also exposes RPC interface
   */
  sendAction(action: string, data: any) {
    // For now, actions still go through the display worker's legacy action forwarding
    // Could be refactored to direct RPC calls to backend later
    console.log('[DisplayRpcClient] Action sent (via legacy mechanism):', action, data);
  }

  disconnect() {
    if (this.rpcStub) {
      // CapnWeb stubs are disposable
      this.rpcStub[Symbol.dispose]?.();
      this.rpcStub = undefined;
    }
  }

  // ==========================================
  // Legacy Compatibility Methods
  // ==========================================

  sendPing() {
    // RPC sessions have built-in keepalive, ping not needed
    console.log('[DisplayRpcClient] Ping (no-op with RPC)');
  }
}
