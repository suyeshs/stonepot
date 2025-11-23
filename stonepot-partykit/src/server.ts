/**
 * PartyKit Server for Stonepot Collaborative Ordering
 * Real-time synchronization for group orders
 */

import type * as Party from "partykit/server";

// Message types for collaborative ordering
type MessageType =
  | "join"
  | "leave"
  | "add_item"
  | "remove_item"
  | "update_quantity"
  | "update_split"
  | "finalize"
  | "sync";

interface OrderMessage {
  type: MessageType;
  participantId: string;
  participantName: string;
  timestamp: number;
  data?: any;
}

interface Participant {
  id: string;
  name: string;
  phone: string;
  connectionId: string;
  joinedAt: number;
}

interface OrderItem {
  id: string;
  dishName: string;
  dishType: "veg" | "non-veg";
  quantity: number;
  price: number;
  itemTotal: number;
  customization?: string;
  addedBy: string;
  addedByName: string;
  addedAt: number;
}

interface CollaborativeOrderState {
  circleId: string;
  tenantId: string;
  sessionId: string;
  initiatedBy: string;
  participants: Participant[];
  items: OrderItem[];
  total: number;
  splitType: "equal" | "itemized" | "custom";
  status: "active" | "finalized";
  createdAt: number;
  updatedAt: number;
}

export default class CollaborativeOrderServer implements Party.Server {
  orderState: CollaborativeOrderState | null = null;

  constructor(readonly room: Party.Room) {}

  async onStart() {
    // Load order state from storage if exists
    const stored = await this.room.storage.get<CollaborativeOrderState>("orderState");

    if (stored) {
      this.orderState = stored;
      console.log(`[PartyKit] Loaded order state for room: ${this.room.id}`);
    } else {
      console.log(`[PartyKit] No existing order state for room: ${this.room.id}`);
    }
  }

  async onConnect(connection: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(`[PartyKit] Connection ${connection.id} joined room ${this.room.id}`);

    // Send current order state to newly connected client
    if (this.orderState) {
      connection.send(
        JSON.stringify({
          type: "sync",
          data: this.orderState,
          timestamp: Date.now()
        })
      );
    }
  }

  async onMessage(message: string, sender: Party.Connection) {
    try {
      const msg: OrderMessage = JSON.parse(message);
      console.log(`[PartyKit] Received message:`, msg.type, `from`, msg.participantId);

      switch (msg.type) {
        case "join":
          await this.handleJoin(msg, sender);
          break;

        case "leave":
          await this.handleLeave(msg);
          break;

        case "add_item":
          await this.handleAddItem(msg);
          break;

        case "remove_item":
          await this.handleRemoveItem(msg);
          break;

        case "update_quantity":
          await this.handleUpdateQuantity(msg);
          break;

        case "update_split":
          await this.handleUpdateSplit(msg);
          break;

        case "finalize":
          await this.handleFinalize(msg);
          break;

        default:
          console.log(`[PartyKit] Unknown message type: ${msg.type}`);
      }
    } catch (error) {
      console.error("[PartyKit] Error processing message:", error);
      sender.send(
        JSON.stringify({
          type: "error",
          error: "Failed to process message",
          timestamp: Date.now()
        })
      );
    }
  }

  async onClose(connection: Party.Connection) {
    console.log(`[PartyKit] Connection ${connection.id} left room ${this.room.id}`);

    // Optionally clean up participant when connection closes
    if (this.orderState) {
      this.orderState.participants = this.orderState.participants.filter(
        (p) => p.connectionId !== connection.id
      );
      await this.saveState();
      await this.broadcast({
        type: "sync",
        data: this.orderState,
        timestamp: Date.now()
      });
    }
  }

  // Handler: Join collaborative order
  async handleJoin(msg: OrderMessage, sender: Party.Connection) {
    if (!this.orderState) {
      // Initialize new order
      this.orderState = {
        circleId: msg.data.circleId,
        tenantId: msg.data.tenantId,
        sessionId: this.room.id,
        initiatedBy: msg.participantId,
        participants: [],
        items: [],
        total: 0,
        splitType: "equal",
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }

    // Add participant if not already present
    const existing = this.orderState.participants.find(
      (p) => p.id === msg.participantId
    );

    if (!existing) {
      this.orderState.participants.push({
        id: msg.participantId,
        name: msg.participantName,
        phone: msg.data.phone,
        connectionId: sender.id,
        joinedAt: Date.now()
      });

      this.orderState.updatedAt = Date.now();
      await this.saveState();

      // Broadcast updated state
      await this.broadcast({
        type: "participant_joined",
        participantId: msg.participantId,
        participantName: msg.participantName,
        data: this.orderState,
        timestamp: Date.now()
      });
    } else {
      // Update connection ID if reconnecting
      existing.connectionId = sender.id;
      await this.saveState();
    }
  }

  // Handler: Leave collaborative order
  async handleLeave(msg: OrderMessage) {
    if (!this.orderState) return;

    this.orderState.participants = this.orderState.participants.filter(
      (p) => p.id !== msg.participantId
    );

    this.orderState.updatedAt = Date.now();
    await this.saveState();

    await this.broadcast({
      type: "participant_left",
      participantId: msg.participantId,
      participantName: msg.participantName,
      data: this.orderState,
      timestamp: Date.now()
    });
  }

  // Handler: Add item to order
  async handleAddItem(msg: OrderMessage) {
    if (!this.orderState) return;

    const item: OrderItem = {
      id: msg.data.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dishName: msg.data.dishName,
      dishType: msg.data.dishType,
      quantity: msg.data.quantity,
      price: msg.data.price,
      itemTotal: msg.data.price * msg.data.quantity,
      customization: msg.data.customization,
      addedBy: msg.participantId,
      addedByName: msg.participantName,
      addedAt: Date.now()
    };

    this.orderState.items.push(item);
    this.orderState.total = this.calculateTotal();
    this.orderState.updatedAt = Date.now();

    await this.saveState();

    await this.broadcast({
      type: "item_added",
      participantId: msg.participantId,
      participantName: msg.participantName,
      data: {
        item,
        orderState: this.orderState
      },
      timestamp: Date.now()
    });
  }

  // Handler: Remove item from order
  async handleRemoveItem(msg: OrderMessage) {
    if (!this.orderState) return;

    const itemId = msg.data.itemId;
    this.orderState.items = this.orderState.items.filter((item) => item.id !== itemId);
    this.orderState.total = this.calculateTotal();
    this.orderState.updatedAt = Date.now();

    await this.saveState();

    await this.broadcast({
      type: "item_removed",
      participantId: msg.participantId,
      participantName: msg.participantName,
      data: {
        itemId,
        orderState: this.orderState
      },
      timestamp: Date.now()
    });
  }

  // Handler: Update item quantity
  async handleUpdateQuantity(msg: OrderMessage) {
    if (!this.orderState) return;

    const { itemId, quantity } = msg.data;
    const item = this.orderState.items.find((i) => i.id === itemId);

    if (item) {
      item.quantity = quantity;
      item.itemTotal = item.price * quantity;
      this.orderState.total = this.calculateTotal();
      this.orderState.updatedAt = Date.now();

      await this.saveState();

      await this.broadcast({
        type: "quantity_updated",
        participantId: msg.participantId,
        participantName: msg.participantName,
        data: {
          itemId,
          quantity,
          orderState: this.orderState
        },
        timestamp: Date.now()
      });
    }
  }

  // Handler: Update split type
  async handleUpdateSplit(msg: OrderMessage) {
    if (!this.orderState) return;

    this.orderState.splitType = msg.data.splitType;
    this.orderState.updatedAt = Date.now();

    await this.saveState();

    await this.broadcast({
      type: "split_updated",
      participantId: msg.participantId,
      participantName: msg.participantName,
      data: {
        splitType: msg.data.splitType,
        orderState: this.orderState
      },
      timestamp: Date.now()
    });
  }

  // Handler: Finalize order
  async handleFinalize(msg: OrderMessage) {
    if (!this.orderState) return;

    this.orderState.status = "finalized";
    this.orderState.updatedAt = Date.now();

    await this.saveState();

    await this.broadcast({
      type: "order_finalized",
      participantId: msg.participantId,
      participantName: msg.participantName,
      data: this.orderState,
      timestamp: Date.now()
    });
  }

  // Calculate total from items
  calculateTotal(): number {
    if (!this.orderState) return 0;
    return this.orderState.items.reduce((sum, item) => sum + item.itemTotal, 0);
  }

  // Save state to PartyKit storage
  async saveState() {
    if (this.orderState) {
      await this.room.storage.put("orderState", this.orderState);
    }
  }

  // Broadcast message to all connections
  async broadcast(message: any) {
    this.room.broadcast(JSON.stringify(message));
  }

  // Static method for HTTP requests (optional)
  static async onFetch(request: Party.Request, lobby: Party.FetchLobby) {
    // Enable CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    return new Response("PartyKit Collaborative Orders Server", {
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
