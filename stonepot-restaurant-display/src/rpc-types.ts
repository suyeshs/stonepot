/**
 * CapnWeb RPC Interface Definitions for Display Operations
 *
 * These interfaces define the RPC methods exposed by the Display Worker
 * and consumed by both the backend and frontend clients.
 */

export interface DishCardData {
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  type?: 'veg' | 'non-veg';
  category?: string;
  dietary?: string[];
  spiceLevel?: number;
  available?: boolean;
  preparationTime?: string;
  choices?: Array<{
    id: string;
    name: string;
    description?: string;
    imageUrl?: string;
    price?: number;
  }>;
  rating?: number;
  tag?: string;
  actions?: Array<{
    id: string;
    label: string;
    type: string;
  }>;
}

export interface TranscriptionData {
  text: string;
  speaker: 'user' | 'agent';
  timestamp: number;
  isFinal?: boolean;
}

export interface OrderSummaryData {
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    choices?: string[];
  }>;
  subtotal: number;
  tax?: number;
  total: number;
}

export interface CartItemData {
  id: string;
  name: string;
  quantity: number;
  price: number;
  choices?: string[];
}

/**
 * Display RPC Interface
 * Methods that can be called remotely on the Display Worker
 */
export interface DisplayRPC {
  /**
   * Show a dish card on the display
   */
  showDish(dish: DishCardData): Promise<void>;

  /**
   * Add a transcription to the display
   */
  addTranscription(transcription: TranscriptionData): Promise<void>;

  /**
   * Show order summary
   */
  showOrderSummary(summary: OrderSummaryData): Promise<void>;

  /**
   * Show cart item added notification
   */
  showCartItemAdded(item: CartItemData): Promise<void>;

  /**
   * Update cart display
   */
  updateCart(items: CartItemData[]): Promise<void>;

  /**
   * Clear current display
   */
  clearDisplay(): Promise<void>;

  /**
   * Get current conversation state
   */
  getState(): Promise<ConversationState>;
}

/**
 * Client Display Callback Interface
 * Methods that the display worker calls back on connected clients
 */
export interface ClientDisplayCallback {
  /**
   * Receive initial state when connecting
   */
  onInitialState(state: ConversationState): void;

  /**
   * Receive display update
   */
  onDisplayUpdate(update: DisplayUpdate): void;

  /**
   * Handle connection error
   */
  onError(error: string): void;
}

/**
 * Conversation state stored in Durable Object
 */
export interface ConversationState {
  sessionId: string;
  tenantId: string;
  category: string;
  transcriptions: TranscriptionData[];
  displayUpdates: DisplayUpdate[];
  currentOrder?: OrderSummaryData;
  createdAt: number;
  lastActivity: number;
}

/**
 * Display update structure
 */
export interface DisplayUpdate {
  type: 'dish_card' | 'menu_item' | 'combo_item' | 'order_summary' | 'cart_item_added' | 'cart_updated' | 'transcription';
  data?: any;
  text?: string;
  speaker?: 'user' | 'agent';
  timestamp: number;
  isFinal?: boolean;
}

/**
 * Backend to Display RPC Interface
 * Methods exposed for backend services
 */
export interface BackendDisplayRPC extends DisplayRPC {
  /**
   * Initialize a new session
   */
  initSession(tenantId: string, category: string): Promise<{ success: boolean }>;

  /**
   * Register a client callback for receiving updates
   */
  registerClient(callback: ClientDisplayCallback): Promise<void>;

  /**
   * Unregister a client callback
   */
  unregisterClient(): Promise<void>;
}
