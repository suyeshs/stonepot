export interface Env {
  SESSION_MANAGER: DurableObjectNamespace;
  RPC_SESSION_MANAGER: DurableObjectNamespace;  // CapnWeb RPC-enabled session manager
  DB?: D1Database;
  IMAGES?: R2Bucket;
  TENANT_CONFIG?: KVNamespace;
  ALLOWED_ORIGINS: string;
  AUTH_SECRET?: string;
  BACKEND_URL?: string;  // Backend URL for action forwarding
}

export interface DisplayClient {
  connectedAt: number;
  clientId: string;
  userAgent: string;
}

export interface Transcription {
  text: string;
  speaker: 'user' | 'assistant';
  timestamp: number;
}

export interface Order {
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  estimatedTime?: number;
}

export interface OrderItem {
  dishName: string;
  quantity: number;
  customizations: string[];
  itemPrice: number;
}

export interface Dish {
  name: string;
  description: string;
  price: number;
  image: string;
  allergens: string[];
  dietary: string[];
  spiceLevel?: number;
  customizations?: string[];
  nutritionalInfo?: Record<string, any>;
}

export interface DisplayUpdate {
  type: 'transcription' | 'dish_card' | 'menu_section' | 'order_summary' | 'confirmation' | 'webpage' | 'snippet' | 'order_update';
  text?: string;
  speaker?: 'user' | 'assistant';
  displayData?: any;
  order?: Order;
  timestamp: number;
}

export interface ConversationState {
  sessionId: string;
  tenantId: string;
  currentOrder: Order | null;
  transcriptions: Transcription[];
  displayUpdates: DisplayUpdate[];
  startedAt: number;
}

export interface SessionInit {
  sessionId: string;
  tenantId: string;
}
