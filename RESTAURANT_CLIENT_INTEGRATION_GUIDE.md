# Stonepot Restaurant Client - Integration Guide for Admin Dashboard

## Overview

The Stonepot Restaurant system is a **voice-enabled ordering platform** with three main components:

1. **Restaurant Client** (Next.js/Cloudflare Workers) - Customer-facing voice interface
2. **Backend API** (Cloud Run) - Vertex AI Live, session management, content
3. **Display Worker** (Cloudflare Durable Objects) - Real-time multimodal display updates

This document outlines the configuration, theming, and API integration points for building an admin dashboard.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CUSTOMER JOURNEY                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Customer visits: stonepot-restaurant-client.workers.dev  │
│     ├─ Requests microphone permission                        │
│     ├─ Starts voice conversation                             │
│     └─ Sees dual-panel UI: Conversation + Order Display      │
│                                                               │
│  2. Voice Conversation (Vertex AI Live)                      │
│     ├─ AudioWorklet captures 16kHz PCM audio                 │
│     ├─ WebSocket streams to backend                          │
│     ├─ AI responds with native audio (24kHz PCM)             │
│     └─ Real-time audio visualization (idle/listening/speaking)│
│                                                               │
│  3. Visual Display Updates                                   │
│     ├─ AI triggers dish_card display with image              │
│     ├─ Display worker broadcasts to all connected clients    │
│     └─ Browser renders dish photo, description, price        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Restaurant Client (stonepot-restaurant-client)

**Technology Stack:**
- Next.js 14.2.33 (App Router)
- Deployed on Cloudflare Workers via OpenNext
- Real-time WebSocket audio streaming
- Dual WebSocket connections: Voice + Display

**Key Features:**
- **Voice Interface**: AudioWorklet-based microphone capture (16kHz PCM)
- **Audio Playback**: Scheduled PCM audio playback (24kHz)
- **Visual Display**: Real-time dish cards, menu sections, order summaries
- **Audio Visualization**: Idle animation, listening/thinking/speaking states
- **Session Management**: Automatic session creation and reconnection

**File Structure:**
```
stonepot-restaurant-client/
├── app/
│   ├── page.tsx                    # Main voice interface (510 lines)
│   ├── layout.tsx                  # Root layout with metadata
│   ├── services/
│   │   ├── VertexAILiveService.ts  # WebSocket to backend API
│   │   └── DisplayWebSocketService.ts # WebSocket to display worker
│   ├── components/
│   │   └── AudioVisualizer.tsx     # Waveform visualization
│   └── hooks/
│       └── useAudioVisualization.ts # Audio level tracking
├── public/
│   ├── audio-processor.js          # AudioWorklet for voice capture
│   └── sahamati-logo-1.png         # Branding assets
└── wrangler.toml                   # Cloudflare Worker config
```

**Current Theme/Branding:**
```typescript
// From app/page.tsx
const branding = {
  name: "Stonepot Restaurant",
  tagline: "Voice-enabled ordering system",
  logo: "/sahamati-logo-1.png",

  colors: {
    background: "gradient-to-b from-[#f8f9fa] via-[#e9ecef] to-[#0a0a0a]",
    text: "#e5e5e5",
    borders: "#2a2a2a",
    cardBackground: "#1e1e1e/80",
    accent: {
      blue: "blue-500/10",
      green: "green-500/10",
      red: "red-500/10"
    }
  },

  features: [
    { icon: "⚡", title: "Real-time", desc: "Instant voice responses" },
    { icon: "🎨", title: "Visual Display", desc: "See your order as you speak" },
    { icon: "🌍", title: "Multilingual", desc: "Order in your language" }
  ]
};
```

**Environment Variables (wrangler.toml):**
```toml
[vars]
NEXT_PUBLIC_WORKER_URL = "https://theme-edge-worker.suyesh.workers.dev"
NEXT_PUBLIC_API_URL = "https://stonepot-restaurant-334610188311.us-central1.run.app"
```

---

### 2. Backend API (stonepot-restaurant)

**Technology Stack:**
- Bun runtime
- Express.js
- Vertex AI Live API (gemini-2.0-flash-live-preview-04-09)
- Firestore (planned for content storage)
- Google File Search (planned for RAG)

**Key Services:**
```
src/services/
├── VertexAILiveService.js         # Vertex AI WebSocket management
├── DisplayApiClient.js            # Sends updates to display worker
├── Guardrails.js                  # Input validation, rate limiting
├── LLMConfigService.js            # Response tone, length, generation config
├── PromptService.js               # System prompt construction
├── CloudflareImageService.js      # (Planned) Dish image upload
├── MenuManagementService.js       # (Planned) CRUD for menu items
└── RestaurantKnowledgeService.js  # (Planned) RAG context building
```

**Current Configuration (src/config/index.js):**
```javascript
{
  vertexAI: {
    projectId: 'sahamati-labs',
    location: 'us-central1',
    modelId: 'gemini-2.0-flash-live-preview-04-09',
    audio: {
      voiceName: 'Kore',              // Female, warm, natural voice
      responseModalities: ['AUDIO']
    },
    automaticActivityDetection: {
      enabled: true,
      voiceActivityTimeout: 0.6       // seconds
    },
    generation: {
      temperature: 0.7,
      maxOutputTokens: 2048
    }
  },

  guardrails: {
    maxResponseLength: 500,
    maxHistoryLength: 50,
    allowedLanguages: ['en', 'hi', 'ta', 'te', 'bn'],
    rateLimitWindow: 60000,           // 1 minute
    maxRequestsPerWindow: 30,
    contentFilters: {
      offensive: true,
      personal_info: true,
      food_allergy_disclaimer: true
    }
  },

  promptConfig: {
    tone: {
      style: 'friendly',              // professional, friendly, casual, formal
      personality: 'helpful',
      formality: 'balanced'
    },
    responseLength: {
      preference: 'concise',          // concise, moderate, detailed, comprehensive
      maxTokens: 2048,
      targetSentences: 3
    },
    restaurantContext: {
      role: 'restaurant ordering assistant',
      capabilities: ['menu browsing', 'order taking', 'recommendations', 'dietary guidance']
    }
  },

  cloudflare: {
    workerUrl: 'https://theme-edge-worker.suyesh.workers.dev',
    authToken: process.env.CLOUDFLARE_AUTH_TOKEN
  },

  restaurant: {
    defaultVoice: 'Kore',
    defaultLanguage: 'en-US',
    multimodal: {
      enabled: true,
      allowedDisplayTypes: [
        'dish_card',
        'menu_section',
        'order_summary',
        'confirmation',
        'webpage',
        'snippet'
      ]
    }
  }
}
```

---

### 3. Display Worker (stonepot-restaurant-display)

**Technology Stack:**
- Cloudflare Workers
- Durable Objects (SessionManager)
- WebSocket broadcasting
- Real-time state synchronization

**Display Update Types:**
```typescript
// dish_card - Single dish with image
{
  type: 'dish_card',
  data: {
    name: "Butter Chicken",
    description: "Creamy tomato curry...",
    price: 450,
    image: "https://imagedelivery.net/.../public",
    dietary: ["non-vegetarian", "gluten-free"],
    spiceLevel: "medium",
    available: true,
    preparationTime: "20-25 minutes"
  }
}

// menu_section - Multiple items
{
  type: 'menu_section',
  data: {
    section: "Main Course",
    items: [...]
  }
}

// order_summary - Current order
{
  type: 'order_summary',
  data: {
    items: [...],
    subtotal: 1200,
    tax: 144,
    total: 1344
  }
}

// transcription - Conversation history
{
  type: 'transcription',
  speaker: 'user' | 'assistant',
  text: "I'd like butter chicken please",
  timestamp: "2025-11-15T10:30:00Z"
}
```

---

## API Endpoints (Current & Planned)

### Current Endpoints

**Session Management:**
```
POST /api/restaurant/sessions
Body: { tenantId, userId, language }
Response: {
  success: true,
  sessionId: "session_123",
  displayUrl: "https://theme-edge-worker.../ui/conversation?session=...",
  websocketUrl: "/ws/restaurant/session_123",
  tenantId: "demo-restaurant",
  language: "en"
}

WebSocket: /ws/restaurant/{sessionId}
- Bidirectional audio streaming
- Control messages (ping, start_session)
- Rate limiting via guardrails
```

**Display Updates:**
```
POST /api/restaurant/display/update
Body: {
  sessionId: "session_123",
  type: "dish_card",
  data: { name, description, price, image, ... }
}
```

### Planned Endpoints (for Admin Dashboard)

**Restaurant Profile Management:**
```
POST   /api/restaurant/profile
GET    /api/restaurant/:tenantId/profile
PUT    /api/restaurant/:tenantId/profile
DELETE /api/restaurant/:tenantId/profile

Body: {
  tenantId: "restaurant_123",
  subdomain: "tajrestaurant",           # URL: tajrestaurant.thestonepot.pro
  name: "Taj Restaurant",
  about: "Traditional Indian cuisine since 1982...",
  cuisine: "North Indian",
  address: "123 Main St, City",
  phone: "+91-1234567890",
  hours: "11:00 AM - 11:00 PM",
  logo: "https://imagedelivery.net/.../logo.png",
  theme: {
    primaryColor: "#ff6b35",
    secondaryColor: "#004e89",
    accentColor: "#f77f00"
  }
}
```

**Menu Management:**
```
POST   /api/restaurant/:tenantId/menu/items
GET    /api/restaurant/:tenantId/menu/items
GET    /api/restaurant/:tenantId/menu/items/:itemId
PUT    /api/restaurant/:tenantId/menu/items/:itemId
DELETE /api/restaurant/:tenantId/menu/items/:itemId

# Single Item
Body: {
  name: "Butter Chicken",
  description: "Creamy tomato curry...",
  price: 450,
  category: "main_course",              # appetizer, main_course, dessert, beverage
  subcategory: "curry",
  allergens: ["dairy", "nuts"],
  dietaryTags: ["non-vegetarian", "gluten-free"],
  spiceLevel: "medium",                 # mild, medium, hot, extra-hot
  available: true,
  preparationTime: "20-25 minutes",
  servingSize: "Serves 1",
  image: <file upload>                  # Multipart form-data
}

Response: {
  success: true,
  menuItem: {
    id: "menu_item_123",
    imageUrl: "https://imagedelivery.net/.../public",
    imageId: "cf-image-123",
    googleFileSearchFileId: "files/xyz789"
  }
}
```

**Bulk Menu Import:**
```
POST /api/restaurant/:tenantId/menu/import
Content-Type: multipart/form-data

Body: {
  file: <menu.xlsx>
}

Excel Format:
Columns: Dish Name | Description | Price | Category | Allergens |
         Dietary Tags | Spice Level | Preparation Time | Image URL

Response: {
  success: true,
  imported: 45,
  failed: 2,
  results: {
    success: [...],
    failed: [
      { item: {...}, error: "Invalid price" }
    ]
  }
}
```

**Image Management:**
```
POST   /api/restaurant/:tenantId/images/upload
DELETE /api/restaurant/:tenantId/images/:imageId

# Upload (multipart/form-data)
Body: {
  image: <file>,
  dishId: "menu_item_123",          # Optional: link to menu item
  metadata: {
    alt: "Butter Chicken",
    category: "main_course"
  }
}

Response: {
  success: true,
  imageId: "cf-image-123",
  imageUrl: "https://imagedelivery.net/{hash}/{id}/public",
  variants: {
    thumbnail: "https://imagedelivery.net/{hash}/{id}/thumbnail",
    medium: "https://imagedelivery.net/{hash}/{id}/medium",
    public: "https://imagedelivery.net/{hash}/{id}/public"
  }
}
```

**Content Management (About, Policies, FAQ):**
```
POST   /api/restaurant/:tenantId/content
GET    /api/restaurant/:tenantId/content
PUT    /api/restaurant/:tenantId/content/:contentId
DELETE /api/restaurant/:tenantId/content/:contentId

Body: {
  type: "about" | "policy" | "faq" | "dietary_info",
  title: "About Us",
  content: "We've been serving authentic Indian cuisine...",
  category: "general",
  tags: ["about", "history"]
}
```

**AI Configuration:**
```
PUT /api/restaurant/:tenantId/ai-config

Body: {
  vertexAI: {
    voiceName: "Kore" | "Aoede" | "Charon",    # Voice selection
    temperature: 0.7,                          # 0.0 - 1.0
    maxOutputTokens: 2048
  },

  promptConfig: {
    tone: {
      style: "friendly" | "professional" | "casual",
      personality: "helpful" | "enthusiastic",
      formality: "balanced" | "formal" | "casual"
    },
    responseLength: {
      preference: "concise" | "moderate" | "detailed",
      targetSentences: 3
    }
  },

  guardrails: {
    maxResponseLength: 500,
    allowedLanguages: ["en", "hi", "ta"],
    maxRequestsPerWindow: 30
  },

  systemPrompt: "You are a friendly assistant for {restaurantName}..."
}
```

**Analytics & Sessions:**
```
GET /api/restaurant/:tenantId/sessions
Query: ?startDate=2025-11-01&endDate=2025-11-15&status=completed

GET /api/restaurant/:tenantId/analytics
Response: {
  totalSessions: 1234,
  avgDuration: 180,              # seconds
  totalOrders: 890,
  avgOrderValue: 850,            # INR
  popularDishes: [
    { name: "Butter Chicken", orders: 234 },
    ...
  ],
  peakHours: [18, 19, 20],       # Hours (0-23)
  languageBreakdown: {
    "en": 60,
    "hi": 30,
    "ta": 10
  }
}
```

---

## Variables Managed via Admin Dashboard

### 1. Restaurant Profile
```javascript
{
  // Basic Info (REQUIRED)
  tenantId: string,              // Unique identifier
  subdomain: string,             // URL subdomain
  name: string,                  // Display name
  about: string,                 // Description (for AI context)

  // Contact & Location
  cuisine: string,               // "North Indian", "Italian", etc.
  address: string,
  phone: string,
  hours: string,

  // Branding
  logo: string,                  // Cloudflare Images URL
  theme: {
    primaryColor: string,        // Hex color
    secondaryColor: string,
    accentColor: string
  },

  // Integration IDs
  googleFileSearchStoreId: string,    // Auto-created
  cloudflareImageAccount: string,     // Auto-linked

  // Status
  status: "active" | "inactive" | "suspended"
}
```

### 2. Menu Items
```javascript
{
  // Core Info (REQUIRED)
  name: string,
  description: string,           // Rich context for AI
  price: number,                 // INR
  category: "appetizer" | "main_course" | "dessert" | "beverage",

  // Optional Details
  subcategory: string,           // "curry", "tandoor", "biryani", etc.
  allergens: string[],           // ["dairy", "nuts", "gluten"]
  dietaryTags: string[],         // ["vegetarian", "vegan", "gluten-free"]
  spiceLevel: "mild" | "medium" | "hot" | "extra-hot",

  // Operational
  available: boolean,
  preparationTime: string,       // "20-25 minutes"
  servingSize: string,           // "Serves 1-2"

  // Media
  imageUrl: string,              // Cloudflare Images URL
  imageId: string,               // For image management

  // Metadata
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### 3. AI Behavior Configuration
```javascript
{
  // Voice Settings
  voiceName: "Kore" | "Aoede" | "Charon",

  // Response Style
  tone: {
    style: "friendly" | "professional" | "casual" | "formal" | "empathetic",
    personality: "helpful" | "enthusiastic" | "calm" | "authoritative",
    formality: "formal" | "balanced" | "casual"
  },

  // Response Length
  responseLength: {
    preference: "concise" | "moderate" | "detailed" | "comprehensive",
    maxTokens: number,           // 50-8192
    targetSentences: number      // 1-10
  },

  // Generation Parameters
  generation: {
    temperature: number,         // 0.0-1.0 (creativity vs consistency)
    topP: number,                // 0.0-1.0 (diversity)
    topK: number                 // Top tokens to consider
  },

  // Safety & Limits
  guardrails: {
    maxResponseLength: number,   // Characters
    maxHistoryLength: number,    // Messages
    allowedLanguages: string[],  // ["en", "hi", "ta", "te", "bn"]
    rateLimitWindow: number,     // Milliseconds
    maxRequestsPerWindow: number
  },

  // Custom System Prompt (Advanced)
  systemPromptOverride: string   // Optional custom prompt
}
```

### 4. Display Configuration
```javascript
{
  // Multimodal Settings
  multimodal: {
    enabled: boolean,
    allowedDisplayTypes: [
      "dish_card",
      "menu_section",
      "order_summary",
      "confirmation"
    ],
    autoShowImages: boolean,     // Auto-display when AI mentions dish
    imageVariant: "thumbnail" | "medium" | "public"
  },

  // Display Worker URL
  displayWorkerUrl: string       // Cloudflare Worker endpoint
}
```

### 5. Content Documents
```javascript
{
  type: "about" | "policy" | "faq" | "dietary_info",
  title: string,
  content: string,               // Markdown or plain text
  category: string,
  tags: string[],

  // These are indexed by Google File Search for AI retrieval
  googleFileSearchFileId: string
}
```

---

## Integration Points for Admin Dashboard

### Required API Endpoints to Build

1. **Authentication & Tenant Management**
   - Create/login restaurant owner
   - Multi-tenant isolation
   - Role-based access (owner, staff, viewer)

2. **Restaurant CRUD**
   - Create profile with subdomain
   - Update branding/theme
   - Upload logo

3. **Menu Management**
   - Single item CRUD
   - Bulk Excel import
   - Drag-and-drop image upload
   - Category organization

4. **Content Management**
   - About Us editor
   - Policies, FAQ
   - Dietary information

5. **AI Configuration**
   - Voice selection
   - Tone/personality sliders
   - System prompt editor
   - Testing playground

6. **Analytics Dashboard**
   - Session metrics
   - Popular dishes
   - Peak hours
   - Language breakdown

---

## Theme/Branding Customization

### Client-Side Theme Variables (can be injected via API)

```typescript
// These can be fetched from /api/restaurant/:tenantId/theme
interface RestaurantTheme {
  // Colors
  primaryColor: string,           // Main brand color
  secondaryColor: string,
  accentColor: string,
  backgroundColor: string,        // Gradient or solid
  textColor: string,
  borderColor: string,

  // Typography
  fontFamily: string,             // Google Fonts
  fontSize: {
    heading: string,
    body: string,
    small: string
  },

  // Branding Assets
  logo: string,                   // URL to logo image
  favicon: string,

  // Layout
  conversationPanelWidth: string, // "50%", "60%", etc.
  displayPanelWidth: string,

  // Feature Flags
  showLogo: boolean,
  showTagline: boolean,
  showFeatures: boolean,

  // Customization
  welcomeMessage: string,         // "Welcome to {restaurantName}"
  startButtonText: string,        // "Start Conversation" or custom
  endButtonText: string
}
```

### How Theme is Applied

```typescript
// In restaurant client, fetch theme on load
async function loadTheme(tenantId: string) {
  const theme = await fetch(`/api/restaurant/${tenantId}/theme`).then(r => r.json());

  // Apply CSS variables
  document.documentElement.style.setProperty('--primary-color', theme.primaryColor);
  document.documentElement.style.setProperty('--secondary-color', theme.secondaryColor);

  // Update branding
  document.querySelector('#logo').src = theme.logo;
  document.querySelector('#welcome-msg').textContent = theme.welcomeMessage;
}
```

---

## Database Schema (Firestore)

### Collections

**organizations** (tenants)
```javascript
{
  tenantId: string (doc ID),
  subdomain: string,
  name: string,
  about: string,
  cuisine: string,
  // ... all profile fields
  googleFileSearchStoreId: string,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**tenant_content** (menu + content)
```javascript
{
  id: string (doc ID),
  tenantId: string,
  type: "menu_item" | "about" | "policy" | "faq",

  // If menu_item
  name: string,
  description: string,
  price: number,
  category: string,
  imageUrl: string,
  // ... all menu fields

  // If content
  title: string,
  content: string,

  googleFileSearchFileId: string,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**sessions** (conversation sessions)
```javascript
{
  sessionId: string (doc ID),
  tenantId: string,
  userId: string,
  language: string,
  status: "active" | "completed" | "abandoned",

  currentOrder: {
    items: array,
    total: number
  },

  startTime: timestamp,
  endTime: timestamp,
  duration: number,

  transcriptions: array,
  analytics: {
    messagesCount: number,
    avgResponseTime: number
  }
}
```

**ai_config** (per-tenant AI settings)
```javascript
{
  tenantId: string (doc ID),
  vertexAI: {...},
  promptConfig: {...},
  guardrails: {...},
  systemPromptOverride: string,
  updatedAt: timestamp
}
```

---

## Quick Start for Admin Dashboard

### 1. API Base URL
```
Development: http://localhost:3001
Production:  https://stonepot-restaurant-334610188311.us-central1.run.app
```

### 2. Authentication Headers
```javascript
headers: {
  'Authorization': `Bearer ${apiToken}`,
  'Content-Type': 'application/json',
  'X-Tenant-ID': tenantId  // Multi-tenant isolation
}
```

### 3. Sample Admin Dashboard Flows

**Onboarding Flow:**
```
1. Create Restaurant → POST /api/restaurant/profile
2. Upload Logo → POST /api/restaurant/:tenantId/images/upload
3. Import Menu → POST /api/restaurant/:tenantId/menu/import (Excel)
4. Configure AI → PUT /api/restaurant/:tenantId/ai-config
5. Deploy → GET /api/restaurant/:tenantId/deploy-status
```

**Menu Management:**
```
1. List Items → GET /api/restaurant/:tenantId/menu/items
2. Add Item → POST /api/restaurant/:tenantId/menu/items (with image)
3. Edit Item → PUT /api/restaurant/:tenantId/menu/items/:itemId
4. Delete Item → DELETE /api/restaurant/:tenantId/menu/items/:itemId
```

**Analytics View:**
```
1. Fetch Sessions → GET /api/restaurant/:tenantId/sessions?startDate=...
2. Fetch Analytics → GET /api/restaurant/:tenantId/analytics
3. Export Data → GET /api/restaurant/:tenantId/export/csv
```

---

## Next Steps

1. **Deploy Backend API Updates** with menu management endpoints
2. **Setup Cloudflare Images** for dish photo uploads
3. **Create Firestore Collections** for organizations and tenant_content
4. **Implement Google File Search** integration for RAG
5. **Build Admin Dashboard** in facemash-platform/admin-app
6. **Add Authentication** (Firebase Auth or your existing system)
7. **Deploy Multi-Tenant Client** with dynamic theme loading

---

## Contact & Support

For implementation questions or API access, contact the Stonepot team.

Backend API: https://stonepot-restaurant-334610188311.us-central1.run.app
Display Worker: https://theme-edge-worker.suyesh.workers.dev
Client Demo: https://stonepot-restaurant-client.suyesh.workers.dev
