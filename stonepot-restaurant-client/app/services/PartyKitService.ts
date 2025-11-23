/**
 * PartyKit Service
 * WebSocket client for real-time collaborative ordering
 */

import { collaborativeOrderStore } from '../stores/collaborativeOrderStore';

export interface PartyKitMessage {
  type: string;
  participantId?: string;
  participantName?: string;
  timestamp: number;
  data?: any;
}

export class PartyKitService {
  private ws: WebSocket | null = null;
  private roomUrl: string | null = null;
  private customerId: string | null = null;
  private customerName: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1s, exponential backoff

  // Event callbacks
  private onSyncCallback?: (state: any) => void;
  private onParticipantJoinedCallback?: (participant: any) => void;
  private onParticipantLeftCallback?: (participant: any) => void;
  private onItemAddedCallback?: (item: any, participant: any) => void;
  private onItemRemovedCallback?: (itemId: string, participant: any) => void;
  private onQuantityUpdatedCallback?: (itemId: string, quantity: number, participant: any) => void;
  private onOrderFinalizedCallback?: (state: any) => void;
  private onErrorCallback?: (error: any) => void;

  /**
   * Connect to PartyKit room
   */
  connect(
    roomUrl: string,
    customerId: string,
    customerName: string,
    circleId?: string,
    tenantId?: string,
    phone?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.roomUrl = roomUrl;
        this.customerId = customerId;
        this.customerName = customerName;

        console.log('[PartyKit] Connecting to:', roomUrl);

        this.ws = new WebSocket(roomUrl);

        this.ws.onopen = () => {
          console.log('[PartyKit] Connected');
          collaborativeOrderStore.setConnectionStatus(true, false);
          this.reconnectAttempts = 0;

          // Send join message
          this.sendJoin(circleId, tenantId, phone);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: PartyKitMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('[PartyKit] Failed to parse message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[PartyKit] WebSocket error:', error);
          collaborativeOrderStore.setConnectionStatus(false, false);
          this.onErrorCallback?.(error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('[PartyKit] Disconnected', event.code, event.reason);
          collaborativeOrderStore.setConnectionStatus(false, false);

          // Attempt reconnection if not a normal closure
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
          }
        };
      } catch (error) {
        console.error('[PartyKit] Connection failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[PartyKit] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    collaborativeOrderStore.setConnectionStatus(false, true);

    setTimeout(() => {
      if (this.roomUrl && this.customerId && this.customerName) {
        this.connect(this.roomUrl, this.customerId, this.customerName)
          .catch(error => {
            console.error('[PartyKit] Reconnection failed:', error);
          });
      }
    }, delay);
  }

  /**
   * Handle incoming messages from PartyKit
   */
  private handleMessage(message: PartyKitMessage) {
    console.log('[PartyKit] Received:', message.type);

    switch (message.type) {
      case 'sync':
        // Initial state sync
        collaborativeOrderStore.syncState(message.data);
        this.onSyncCallback?.(message.data);
        break;

      case 'participant_joined':
        const joinedParticipant = {
          id: message.participantId!,
          name: message.participantName!,
          phone: message.data?.phone || '',
          isOnline: true,
          role: message.data?.role || 'member',
          joinedAt: message.timestamp
        };
        collaborativeOrderStore.addParticipant(joinedParticipant);
        this.onParticipantJoinedCallback?.(joinedParticipant);
        break;

      case 'participant_left':
        collaborativeOrderStore.removeParticipant(message.participantId!);
        this.onParticipantLeftCallback?.({
          id: message.participantId,
          name: message.participantName
        });
        break;

      case 'item_added':
        const addedItem = message.data.item;
        collaborativeOrderStore.addItem(addedItem);
        this.onItemAddedCallback?.(addedItem, {
          id: message.participantId,
          name: message.participantName
        });
        break;

      case 'item_removed':
        const removedItemId = message.data.itemId;
        collaborativeOrderStore.removeItem(removedItemId);
        this.onItemRemovedCallback?.(removedItemId, {
          id: message.participantId,
          name: message.participantName
        });
        break;

      case 'quantity_updated':
        const { itemId, quantity } = message.data;
        collaborativeOrderStore.updateQuantity(itemId, quantity);
        this.onQuantityUpdatedCallback?.(itemId, quantity, {
          id: message.participantId,
          name: message.participantName
        });
        break;

      case 'split_updated':
        collaborativeOrderStore.setSplitType(message.data.splitType);
        break;

      case 'order_finalized':
        collaborativeOrderStore.finalize();
        this.onOrderFinalizedCallback?.(message.data);
        break;

      case 'error':
        console.error('[PartyKit] Server error:', message.data);
        this.onErrorCallback?.(message.data);
        break;

      default:
        console.warn('[PartyKit] Unknown message type:', message.type);
    }
  }

  /**
   * Send join message
   */
  sendJoin(circleId?: string, tenantId?: string, phone?: string) {
    this.send({
      type: 'join',
      participantId: this.customerId!,
      participantName: this.customerName!,
      timestamp: Date.now(),
      data: {
        circleId,
        tenantId,
        phone
      }
    });
  }

  /**
   * Add item to collaborative order
   */
  sendAddItem(item: {
    dishName: string;
    dishType: 'veg' | 'non-veg';
    quantity: number;
    price: number;
    customization?: string;
  }) {
    this.send({
      type: 'add_item',
      participantId: this.customerId!,
      participantName: this.customerName!,
      timestamp: Date.now(),
      data: item
    });
  }

  /**
   * Remove item from order
   */
  sendRemoveItem(itemId: string) {
    this.send({
      type: 'remove_item',
      participantId: this.customerId!,
      participantName: this.customerName!,
      timestamp: Date.now(),
      data: { itemId }
    });
  }

  /**
   * Update item quantity
   */
  sendUpdateQuantity(itemId: string, quantity: number) {
    this.send({
      type: 'update_quantity',
      participantId: this.customerId!,
      participantName: this.customerName!,
      timestamp: Date.now(),
      data: { itemId, quantity }
    });
  }

  /**
   * Update split type
   */
  sendUpdateSplit(splitType: 'equal' | 'itemized' | 'custom') {
    this.send({
      type: 'update_split',
      participantId: this.customerId!,
      participantName: this.customerName!,
      timestamp: Date.now(),
      data: { splitType }
    });
  }

  /**
   * Finalize order
   */
  sendFinalize() {
    this.send({
      type: 'finalize',
      participantId: this.customerId!,
      participantName: this.customerName!,
      timestamp: Date.now()
    });
  }

  /**
   * Leave order
   */
  sendLeave() {
    this.send({
      type: 'leave',
      participantId: this.customerId!,
      participantName: this.customerName!,
      timestamp: Date.now()
    });
  }

  /**
   * Send message to PartyKit
   */
  private send(message: PartyKitMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[PartyKit] Cannot send message, not connected');
    }
  }

  /**
   * Disconnect from PartyKit
   */
  disconnect() {
    if (this.ws) {
      // Send leave message before closing
      this.sendLeave();

      // Close connection
      this.ws.close(1000, 'User disconnected');
      this.ws = null;
    }

    // Clear store
    collaborativeOrderStore.clear();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ============ Event Callbacks ============

  onSync(callback: (state: any) => void) {
    this.onSyncCallback = callback;
  }

  onParticipantJoined(callback: (participant: any) => void) {
    this.onParticipantJoinedCallback = callback;
  }

  onParticipantLeft(callback: (participant: any) => void) {
    this.onParticipantLeftCallback = callback;
  }

  onItemAdded(callback: (item: any, participant: any) => void) {
    this.onItemAddedCallback = callback;
  }

  onItemRemoved(callback: (itemId: string, participant: any) => void) {
    this.onItemRemovedCallback = callback;
  }

  onQuantityUpdated(callback: (itemId: string, quantity: number, participant: any) => void) {
    this.onQuantityUpdatedCallback = callback;
  }

  onOrderFinalized(callback: (state: any) => void) {
    this.onOrderFinalizedCallback = callback;
  }

  onError(callback: (error: any) => void) {
    this.onErrorCallback = callback;
  }
}
