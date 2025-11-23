/**
 * Collaborative Order Store
 * MobX store for managing real-time collaborative ordering state
 */

import { makeAutoObservable } from 'mobx';

export interface Participant {
  id: string;
  name: string;
  phone: string;
  isOnline: boolean;
  avatar?: string;
  role?: 'owner' | 'member';
  joinedAt: number;
}

export interface CollaborativeItem {
  id: string;
  dishName: string;
  dishType: 'veg' | 'non-veg';
  quantity: number;
  price: number;
  itemTotal: number;
  customization?: string;
  addedBy: string;
  addedByName: string;
  addedAt: number;
}

export type SplitType = 'equal' | 'itemized' | 'custom';

export interface SplitAmount {
  participantId: string;
  participantName: string;
  amount: number;
  items?: string[]; // Item IDs for itemized split
}

class CollaborativeOrderStore {
  // Session info
  roomId: string | null = null;
  circleId: string | null = null;
  circleName: string | null = null;
  status: 'active' | 'finalized' = 'active';

  // Participants
  participants: Participant[] = [];
  currentUserId: string | null = null; // Current user's ID

  // Items
  items: CollaborativeItem[] = [];

  // Split
  splitType: SplitType = 'equal';
  splitAmounts: SplitAmount[] = [];

  // UI state
  isConnected: boolean = false;
  isReconnecting: boolean = false;
  lastItemAddedBy: string | null = null; // For flash animation

  constructor() {
    makeAutoObservable(this);
  }

  // ============ Computed Properties ============

  get total(): number {
    return this.items.reduce((sum, item) => sum + item.itemTotal, 0);
  }

  get participantCount(): number {
    return this.participants.length;
  }

  get onlineCount(): number {
    return this.participants.filter(p => p.isOnline).length;
  }

  get isOwner(): boolean {
    if (!this.currentUserId) return false;
    const currentParticipant = this.participants.find(p => p.id === this.currentUserId);
    return currentParticipant?.role === 'owner';
  }

  get myShare(): number {
    if (!this.currentUserId) return 0;
    const split = this.splitAmounts.find(s => s.participantId === this.currentUserId);
    return split?.amount || 0;
  }

  get itemCount(): number {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  // ============ Actions ============

  setRoomData(data: {
    roomId: string;
    circleId?: string;
    circleName?: string;
    currentUserId: string;
  }) {
    this.roomId = data.roomId;
    this.circleId = data.circleId || null;
    this.circleName = data.circleName || 'Group Order';
    this.currentUserId = data.currentUserId;
    this.status = 'active';
  }

  setConnectionStatus(connected: boolean, reconnecting: boolean = false) {
    this.isConnected = connected;
    this.isReconnecting = reconnecting;
  }

  // Participant management
  addParticipant(participant: Participant) {
    const existing = this.participants.find(p => p.id === participant.id);
    if (!existing) {
      this.participants.push(participant);
      this.calculateSplits(); // Recalculate when participants change
    }
  }

  removeParticipant(participantId: string) {
    this.participants = this.participants.filter(p => p.id !== participantId);
    this.calculateSplits();
  }

  updateParticipantStatus(participantId: string, isOnline: boolean) {
    const participant = this.participants.find(p => p.id === participantId);
    if (participant) {
      participant.isOnline = isOnline;
    }
  }

  setParticipants(participants: Participant[]) {
    this.participants = participants;
    this.calculateSplits();
  }

  // Item management
  addItem(item: CollaborativeItem) {
    this.items.push(item);
    this.lastItemAddedBy = item.addedBy;
    this.calculateSplits();

    // Clear flash indicator after animation
    setTimeout(() => {
      if (this.lastItemAddedBy === item.addedBy) {
        this.lastItemAddedBy = null;
      }
    }, 500);
  }

  removeItem(itemId: string) {
    this.items = this.items.filter(item => item.id !== itemId);
    this.calculateSplits();
  }

  updateQuantity(itemId: string, newQuantity: number) {
    const item = this.items.find(i => i.id === itemId);
    if (item) {
      item.quantity = newQuantity;
      item.itemTotal = item.price * newQuantity;
      this.calculateSplits();
    }
  }

  setItems(items: CollaborativeItem[]) {
    this.items = items;
    this.calculateSplits();
  }

  // Split management
  setSplitType(type: SplitType) {
    this.splitType = type;
    this.calculateSplits();
  }

  calculateSplits() {
    if (this.participants.length === 0) {
      this.splitAmounts = [];
      return;
    }

    switch (this.splitType) {
      case 'equal':
        this.calculateEqualSplit();
        break;
      case 'itemized':
        this.calculateItemizedSplit();
        break;
      case 'custom':
        // Custom splits are manually edited, only initialize if empty
        if (this.splitAmounts.length === 0) {
          this.initializeCustomSplit();
        }
        break;
    }
  }

  private calculateEqualSplit() {
    const perPerson = this.total / this.participants.length;
    this.splitAmounts = this.participants.map(p => ({
      participantId: p.id,
      participantName: p.name,
      amount: Math.round(perPerson * 100) / 100 // Round to 2 decimals
    }));
  }

  private calculateItemizedSplit() {
    // Each person pays for items they added
    const splitMap = new Map<string, { amount: number; items: string[] }>();

    // Initialize all participants
    this.participants.forEach(p => {
      splitMap.set(p.id, { amount: 0, items: [] });
    });

    // Assign items to their owners
    this.items.forEach(item => {
      const split = splitMap.get(item.addedBy);
      if (split) {
        split.amount += item.itemTotal;
        split.items.push(item.id);
      }
    });

    this.splitAmounts = this.participants.map(p => ({
      participantId: p.id,
      participantName: p.name,
      amount: splitMap.get(p.id)?.amount || 0,
      items: splitMap.get(p.id)?.items || []
    }));
  }

  private initializeCustomSplit() {
    // Start with equal split for custom editing
    const perPerson = this.total / this.participants.length;
    this.splitAmounts = this.participants.map(p => ({
      participantId: p.id,
      participantName: p.name,
      amount: Math.round(perPerson * 100) / 100
    }));
  }

  updateCustomSplit(participantId: string, amount: number) {
    const split = this.splitAmounts.find(s => s.participantId === participantId);
    if (split) {
      split.amount = amount;
    }
  }

  // Validation for custom splits
  get customSplitValid(): boolean {
    if (this.splitType !== 'custom') return true;
    const totalSplit = this.splitAmounts.reduce((sum, s) => sum + s.amount, 0);
    return Math.abs(totalSplit - this.total) < 0.01; // Allow 1 paisa difference for rounding
  }

  // Order finalization
  finalize() {
    this.status = 'finalized';
  }

  // Reset store
  clear() {
    this.roomId = null;
    this.circleId = null;
    this.circleName = null;
    this.status = 'active';
    this.participants = [];
    this.currentUserId = null;
    this.items = [];
    this.splitType = 'equal';
    this.splitAmounts = [];
    this.isConnected = false;
    this.isReconnecting = false;
    this.lastItemAddedBy = null;
  }

  // Sync entire state (from PartyKit 'sync' message)
  syncState(state: {
    circleId: string;
    tenantId: string;
    sessionId: string;
    participants: any[];
    items: any[];
    total: number;
    status: 'active' | 'finalized';
    splitType?: SplitType;
  }) {
    this.roomId = state.sessionId;
    this.circleId = state.circleId;
    this.status = state.status;

    // Convert participants
    this.participants = state.participants.map(p => ({
      id: p.customerId || p.id,
      name: p.name,
      phone: p.phone,
      isOnline: true, // Assume online if in sync
      role: p.role,
      joinedAt: p.joinedAt || Date.now()
    }));

    // Convert items
    this.items = state.items.map(item => ({
      id: item.id,
      dishName: item.dishName,
      dishType: item.dishType,
      quantity: item.quantity,
      price: item.price,
      itemTotal: item.itemTotal,
      customization: item.customization,
      addedBy: item.addedBy,
      addedByName: item.addedByName,
      addedAt: item.addedAt || Date.now()
    }));

    if (state.splitType) {
      this.splitType = state.splitType;
    }

    this.calculateSplits();
  }
}

// Export singleton instance
export const collaborativeOrderStore = new CollaborativeOrderStore();
