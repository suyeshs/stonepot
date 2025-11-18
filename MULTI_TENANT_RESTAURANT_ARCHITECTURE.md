# Multi-Tenant Restaurant Architecture

**Version:** 1.0
**Date:** November 13, 2025
**Category:** Food-Restaurant Use Case

---

## Executive Summary

This document defines the architecture for transforming Stonepot into a **multi-tenant SaaS platform** where restaurant owners can:
- Sign up and provision their own subdomain (e.g., `tajrestaurant.thestonepot.pro`)
- Upload menus, dish descriptions, marketing content, policies
- Enable voice-powered conversational AI for customers
- Have complete data isolation using Cloudflare Workers + Google File Search

---

## 1. System Architecture Overview

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Layer                                │
│  Restaurant Owner Portal  |  Customer Voice Interface           │
└─────────────────┬────────────────────────┬──────────────────────┘
                  │                        │
┌─────────────────▼────────────────────────▼──────────────────────┐
│               Cloudflare Workers (Edge)                          │
│          facemash-domain-service (Multi-Tenant Router)          │
│                                                                  │
│  • Subdomain routing (tajrestaurant.thestonepot.pro)           │
│  • Tenant authentication & isolation                            │
│  • Per-tenant storage: KV, D1, R2 buckets                      │
│  • Admin API for tenant management                              │
└─────────────────┬────────────────────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────────────────────┐
│                   Stonepot Backend (Cloud Run)                   │
│                    Bun + Express + WebSockets                    │
│                                                                  │
│  • Voice AI orchestration (Vertex AI Live)                      │
│  • Session management (Firestore)                               │
│  • Knowledge retrieval (Google File Search)                     │
│  • Content management API                                        │
│  • Category-specific guardrails & prompts                       │
└─────────────────┬────────────────────────┬─────────────────────┘
                  │                        │
      ┌───────────▼──────────┐  ┌─────────▼────────────┐
      │  Python Processor    │  │  Google Cloud        │
      │   (scraper-pod)      │  │                      │
      │                      │  │  • File Search API   │
      │  • BeautifulSoup     │  │  • Vertex AI Live    │
      │  • PDF parsing       │  │  • Firestore         │
      │  • HTML → Markdown   │  │  • Cloud Storage     │
      │  • File Search upload│  │                      │
      └──────────────────────┘  └──────────────────────┘
```

### Key Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Edge Router** | Cloudflare Workers | Multi-tenant routing, isolated storage per tenant |
| **Voice Backend** | Bun + Vertex AI Live | Real-time voice conversations |
| **Content Processor** | Python + BeautifulSoup | Heavy-duty HTML/PDF parsing |
| **Knowledge Store** | Google File Search API | Tenant-isolated RAG datastores |
| **Session DB** | Firestore | User sessions, conversation history |
| **Tenant Storage** | Cloudflare KV/D1/R2 | Per-tenant metadata, cache, files |

---

## 2. Multi-Tenant Data Model

### 2.1 Cloudflare Workers Storage (Per Tenant)

Each restaurant gets **completely isolated** Cloudflare resources:

#### KV Namespaces

```typescript
// {subdomain}_data - Main tenant configuration
{
  "tenant:config": {
    "tenantId": "restaurant_123",
    "subdomain": "tajrestaurant",
    "category": "restaurant",
    "businessType": "fine_dining",
    "status": "active",
    "features": {
      "voiceAgent": true,
      "orderTaking": true,
      "reservations": true
    },
    "voiceConfig": {
      "language": "en",
      "voiceName": "Kore",
      "greeting": "Welcome to Taj Restaurant! How may I help you today?"
    },
    "googleFileSearchStoreId": "fileSearchStores/abc123xyz",
    "createdAt": "2025-11-13T00:00:00Z"
  }
}

// {subdomain}_cache - Temporary data (TTL)
{
  "menu:popular_items": [...],  // Cached for quick access
  "analytics:daily_calls": 42
}

// {subdomain}_sessions - User session state
{
  "session_456": {
    "userId": "user_789",
    "language": "en",
    "context": {...}
  }
}
```

#### D1 Database (Per Tenant)

```sql
-- {subdomain}_db

-- Restaurant profile
CREATE TABLE restaurant_profile (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  business_hours JSONB,
  cuisine_types JSONB,
  price_range TEXT,
  capacity INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Menu items
CREATE TABLE menu_items (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,  -- appetizer, main_course, dessert, beverage
  name TEXT NOT NULL,
  description TEXT,
  price_inr DECIMAL(10,2),
  allergens JSONB,
  dietary_tags JSONB,  -- vegan, gluten_free, etc.
  spice_level TEXT,
  availability BOOLEAN DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Staff & roles
CREATE TABLE staff (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,  -- owner, manager, staff
  permissions JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer orders (if order-taking enabled)
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  items JSONB,
  total_amount DECIMAL(10,2),
  status TEXT,  -- pending, confirmed, preparing, completed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conversation logs
CREATE TABLE conversation_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  customer_id TEXT,
  transcript JSONB,
  sentiment TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### R2 Bucket (Per Tenant)

```
{subdomain}-files/
  ├── menu/
  │   ├── menu.pdf
  │   ├── menu-chinese.pdf
  │   └── seasonal-menu-winter.pdf
  ├── images/
  │   ├── dishes/
  │   │   ├── butter-chicken.jpg
  │   │   └── biryani.jpg
  │   └── restaurant/
  │       └── interior.jpg
  └── documents/
      ├── policies.pdf
      └── faq.md
```

### 2.2 Firestore Collections (Shared, Tenant-Scoped)

Firestore is used for **real-time session state** and **cross-session user data**:

```javascript
// organizations (new collection)
{
  "restaurant_123": {
    tenantId: "restaurant_123",
    subdomain: "tajrestaurant",
    name: "Taj Restaurant",
    category: "restaurant",
    googleFileSearchStoreId: "fileSearchStores/abc123xyz",
    cloudflareStorageConfig: {
      kvData: "abc123...",
      kvCache: "def456...",
      kvSessions: "ghi789...",
      d1DatabaseId: "jkl012...",
      r2BucketName: "tajrestaurant-files"
    },
    subscriptionTier: "premium",
    status: "active",
    createdAt: "2025-11-13T00:00:00Z"
  }
}

// user_profiles (extend existing)
{
  "user_789": {
    userId: "user_789",
    tenantId: "restaurant_123",  // NEW: Associate user with tenant
    role: "customer",  // customer, staff, admin
    conversationHistory: [...],  // Last 50 messages
    preferences: {
      dietaryRestrictions: ["vegetarian"],
      spicePreference: "mild"
    },
    createdAt: "...",
    lastUpdated: "..."
  }
}

// sessions (extend existing)
{
  "session_456": {
    id: "session_456",
    userId: "user_789",
    tenantId: "restaurant_123",  // NEW: Scope session to tenant
    language: "en",
    context: {
      customerName: "Rahul",
      tableNumber: null,
      orderInProgress: null
    },
    isActive: true,
    createdAt: "...",
    lastActivity: "..."
  }
}

// tenant_content (new collection - replaces global knowledge_base)
{
  "doc_123": {
    id: "doc_123",
    tenantId: "restaurant_123",  // TENANT ISOLATION
    type: "menu_item",
    category: "main_course",
    content: {
      name: "Butter Chicken",
      description: "Creamy tomato curry with tender chicken...",
      price: "₹450",
      allergens: ["dairy"],
      spiceLevel: "medium"
    },
    googleFileSearchFileId: "files/xyz789",  // Reference to File Search
    createdAt: "...",
    updatedAt: "..."
  }
}
```

### 2.3 Google File Search Stores (Per Tenant)

Each restaurant gets a **dedicated File Search Store**:

```
Store ID: fileSearchStores/abc123xyz
Display Name: "tajrestaurant_knowledge"

Files:
  ├── files/menu-main.md (from menu.pdf)
  ├── files/menu-beverages.md
  ├── files/about-restaurant.md (from website scrape)
  ├── files/chef-specials.md
  ├── files/policies.md
  └── files/faq.md

Metadata per file:
{
  "source_url": "https://tajrestaurant.com/menu",
  "title": "Main Course Menu",
  "category": "menu",
  "scraped_at": "2025-11-13T10:30:00Z",
  "tenantId": "restaurant_123"
}
```

---

## 3. Restaurant Onboarding Flow

### Step 1: Restaurant Owner Signup

```
User visits: https://thestonepot.pro/signup
↓
Fills form:
  - Restaurant Name: "Taj Restaurant"
  - Business Type: "Fine Dining"
  - Desired Subdomain: "tajrestaurant" (auto-validates availability)
  - Owner Email/Phone
  - Category: "Restaurant"
↓
Backend validates & provisions tenant
```

### Step 2: Automatic Tenant Provisioning

```typescript
// POST /api/tenants/provision
{
  "restaurantName": "Taj Restaurant",
  "subdomain": "tajrestaurant",
  "category": "restaurant",
  "ownerEmail": "owner@tajrestaurant.com"
}

// Backend flow:
async function provisionRestaurantTenant(request) {
  // 1. Create tenant ID
  const tenantId = `restaurant_${generateId()}`;

  // 2. Call Cloudflare Workers to provision storage
  const cfResponse = await fetch('https://api.thestonepot.pro/api/subdomains/assign', {
    method: 'POST',
    body: JSON.stringify({
      tenantId,
      tenantSlug: request.subdomain,
      provisionStorage: true
    })
  });

  const { storage } = cfResponse.data;

  // 3. Create Google File Search Store via Python Processor
  const storeResponse = await fetch('http://python-processor:8080/gemini/store', {
    method: 'POST',
    body: JSON.stringify({
      store_name: `${request.subdomain}_knowledge`,
      description: `Knowledge base for ${request.restaurantName}`
    })
  });

  const { store_id } = storeResponse;

  // 4. Save tenant configuration to Firestore
  await firebaseService.setDocument('organizations', tenantId, {
    tenantId,
    subdomain: request.subdomain,
    name: request.restaurantName,
    category: 'restaurant',
    googleFileSearchStoreId: store_id,
    cloudflareStorageConfig: storage,
    status: 'active',
    createdAt: new Date().toISOString()
  });

  // 5. Initialize tenant KV config in Cloudflare
  await cfKV.put(`tenant:config`, JSON.stringify({
    tenantId,
    subdomain: request.subdomain,
    googleFileSearchStoreId: store_id,
    features: {
      voiceAgent: true,
      orderTaking: false,  // Disabled by default
      reservations: false
    }
  }));

  // 6. Return credentials & admin portal link
  return {
    tenantId,
    subdomain: request.subdomain,
    fullDomain: `${request.subdomain}.thestonepot.pro`,
    adminPortalUrl: `https://${request.subdomain}.thestonepot.pro/admin`,
    voiceInterfaceUrl: `https://${request.subdomain}.thestonepot.pro`,
    apiKey: generateApiKey(tenantId)
  };
}
```

### Step 3: Content Upload & Ingestion

Restaurant owner accesses admin portal at `https://tajrestaurant.thestonepot.pro/admin`

#### Content Upload Options

**Option A: URL Scraping**
```
Owner enters: https://tajrestaurant.com/menu
↓
Stonepot calls Python Processor:
  POST /parse
  { "html": "...", "url": "...", "options": { "extractTables": true } }
↓
Python Processor returns structured data:
  { "title": "Menu", "paragraphs": [...], "tables": [...] }
↓
Convert to markdown & upload to Google File Search:
  POST /gemini/upload
  { "store_id": "fileSearchStores/abc123xyz", "scrape_data": {...} }
↓
Save reference in Firestore tenant_content collection
```

**Option B: PDF Upload**
```
Owner uploads: menu.pdf
↓
Store in R2 bucket: tajrestaurant-files/menu/menu.pdf
↓
Python Processor parses PDF (future enhancement)
↓
Upload to Google File Search
```

**Option C: Manual Entry**
```
Owner uses form to add menu items:
  - Name: "Butter Chicken"
  - Category: "Main Course"
  - Price: "₹450"
  - Description: "..."
  - Allergens: ["dairy"]
↓
Save to D1 database (menu_items table)
↓
Generate markdown from structured data
↓
Upload to Google File Search
```

---

## 4. Content Ingestion Pipeline

### Detailed Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  Step 1: Content Source                                      │
│  • Restaurant website URL                                    │
│  • PDF documents (menu, policies)                           │
│  • Manual form entry                                         │
└────────────────────┬─────────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────────┐
│  Step 2: Stonepot Backend (Content Management API)          │
│                                                              │
│  POST /api/tenant/:tenantId/content/ingest                  │
│  {                                                           │
│    "source": "url",                                          │
│    "url": "https://restaurant.com/menu",                    │
│    "category": "menu"                                        │
│  }                                                           │
│                                                              │
│  → Fetch HTML content                                        │
│  → Validate tenant ownership                                 │
│  → Forward to Python Processor                               │
└────────────────────┬─────────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────────┐
│  Step 3: Python Processor (scraper-pod)                     │
│                                                              │
│  POST /parse                                                 │
│  {                                                           │
│    "html": "<html>...</html>",                              │
│    "url": "...",                                             │
│    "options": {                                              │
│      "extractTables": true,                                  │
│      "extractImages": true                                   │
│    }                                                         │
│  }                                                           │
│                                                              │
│  → BeautifulSoup parses HTML                                 │
│  → Extracts: title, headings, paragraphs, tables, images    │
│  → Returns structured JSON                                   │
└────────────────────┬─────────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────────┐
│  Step 4: Convert to Markdown                                 │
│                                                              │
│  convert_to_markdown(data, url, title)                      │
│                                                              │
│  Output:                                                     │
│  # Menu - Taj Restaurant                                     │
│  **Source:** https://restaurant.com/menu                    │
│                                                              │
│  ## Main Course                                              │
│  - Butter Chicken - ₹450                                     │
│  - Paneer Tikka Masala - ₹380                               │
│  ...                                                         │
└────────────────────┬─────────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────────┐
│  Step 5: Upload to Google File Search                       │
│                                                              │
│  POST /gemini/upload                                         │
│  {                                                           │
│    "store_id": "fileSearchStores/abc123xyz",                │
│    "scrape_data": {...},                                     │
│    "url": "...",                                             │
│    "title": "Menu"                                           │
│  }                                                           │
│                                                              │
│  → Upload markdown as file to Gemini Files API               │
│  → Import file into tenant's File Search Store               │
│  → Returns file_id                                           │
└────────────────────┬─────────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────────┐
│  Step 6: Save Metadata to Firestore                         │
│                                                              │
│  Collection: tenant_content                                  │
│  {                                                           │
│    "tenantId": "restaurant_123",                            │
│    "type": "menu",                                           │
│    "sourceUrl": "...",                                       │
│    "googleFileSearchFileId": "files/xyz789",                │
│    "title": "Menu",                                          │
│    "createdAt": "2025-11-13T..."                            │
│  }                                                           │
│                                                              │
│  → Enables tracking of uploaded content                      │
│  → Allows content refresh/update                             │
└──────────────────────────────────────────────────────────────┘
```

### API Contract: Stonepot ↔ Python Processor

```typescript
// Content Parsing
POST http://python-processor:8080/parse
Request: {
  html: string;
  url: string;
  options?: {
    extractTables?: boolean;
    extractImages?: boolean;
  };
}
Response: {
  url: string;
  title: string;
  description?: string;
  headings: string[];
  paragraphs: string[];
  tables?: Array<{
    headers: string[];
    rows: string[][];
  }>;
  images?: Array<{
    src: string;
    alt: string;
  }>;
}

// Google File Search Store Creation
POST http://python-processor:8080/gemini/store
Request: {
  store_name: string;
  description?: string;
}
Response: {
  success: boolean;
  store_id: string;  // e.g., "fileSearchStores/abc123"
  project_id: string;
}

// Upload to File Search
POST http://python-processor:8080/gemini/upload
Request: {
  store_id: string;
  scrape_data: object;
  url: string;
  title: string;
}
Response: {
  success: boolean;
  file_id: string;  // e.g., "files/xyz789"
  file_uri: string;
}
```

---

## 5. Voice Conversation Flow (Customer Experience)

### Customer Journey

```
Customer visits: https://tajrestaurant.thestonepot.pro
↓
Landing page loads with "Start Voice Conversation" button
↓
Customer clicks → Microphone permission granted
↓
Frontend establishes WebSocket connection:
  wss://stonepot-api-334610188311.us-central1.run.app/api/gemini-live-stream

  Sends:
  {
    "type": "start_session",
    "language": "en",
    "userId": "user_789",
    "tenantId": "restaurant_123"  // NEW: Identifies tenant
  }
↓
Backend receives session start
```

### Backend Session Initialization (Extended)

```javascript
// src/services/VertexAILiveService.js

async createSession(sessionId, config = {}) {
  const { language = 'en', userId, tenantId } = config;  // ADD tenantId

  // 1. Load tenant configuration from Firestore
  const tenant = await firebaseService.getDocument('organizations', tenantId);

  if (!tenant || tenant.status !== 'active') {
    throw new Error('Tenant not found or inactive');
  }

  // 2. Get tenant's Google File Search Store ID
  const fileSearchStoreId = tenant.googleFileSearchStoreId;

  // 3. Load previous conversation history (user-specific, tenant-scoped)
  const profile = await sessionPersistenceService.getUserProfile(userId);
  const previousContext = profile?.conversationHistory
    ?.filter(msg => msg.tenantId === tenantId)  // Filter by tenant
    ?.slice(-10)
    ?.map(msg => `${msg.role}: ${msg.content}`)
    ?.join('\n');

  // 4. Build category-specific system prompt
  const systemInstruction = SharedFunctionSchema.buildSystemPrompt({
    category: 'restaurant',
    tenantConfig: tenant,
    previousContext,
    language
  });

  // 5. Configure Vertex AI Live with File Search grounding
  const tools = [{
    googleSearch: { disable: true }  // Disable public search
  }, {
    fileSearch: {
      fileSearchStoreId: fileSearchStoreId  // Use tenant's File Search Store
    }
  }];

  // 6. Build setup message with tenant context
  const setupMessage = {
    setup: {
      model: this.model,
      generation_config: {
        response_modalities: ['AUDIO'],
        speech_config: {
          voice_config: {
            prebuilt_voice_config: {
              voice_name: tenant.voiceConfig?.voiceName || 'Kore'
            }
          }
        }
      },
      system_instruction: {
        parts: [{ text: systemInstruction }]
      },
      tools: tools
    }
  };

  // 7. Send setup to Vertex AI
  ws.send(JSON.stringify(setupMessage));

  // Store session with tenant association
  await sessionPersistenceService.createSession({
    sessionId,
    userId,
    tenantId,  // NEW
    language,
    startedAt: new Date().toISOString()
  });
}
```

### Real-Time Conversation

```
Customer speaks: "What vegetarian dishes do you have?"
↓
Audio streamed to Vertex AI Live
↓
Vertex AI Live:
  1. Transcribes audio (speech-to-text)
  2. Queries File Search Store (fileSearchStores/abc123xyz)
     → Finds relevant content from menu.md
  3. Generates response using grounded information
  4. Converts to speech (text-to-speech)
↓
Audio response streamed back to customer:
  "We have several delicious vegetarian options!
   Our most popular are Paneer Tikka Masala for ₹380,
   Vegetable Biryani for ₹320, and Dal Makhani for ₹280.
   All are available today. Would you like to hear more about any of these?"
↓
Customer can continue conversation, ask follow-ups, place order (if enabled)
```

---

## 6. Category-Specific Configuration: Restaurant

### 6.1 Restaurant System Prompt Template

```javascript
// src/services/SharedFunctionSchema.js

static buildSystemPrompt(context) {
  const { category, tenantConfig, previousContext, language } = context;

  if (category === 'restaurant') {
    return `You are a friendly and knowledgeable restaurant assistant for ${tenantConfig.name}.

🍽️ RESTAURANT INFORMATION:
- Name: ${tenantConfig.name}
- Cuisine: ${tenantConfig.cuisineTypes?.join(', ')}
- Business Hours: ${formatBusinessHours(tenantConfig.businessHours)}
- Address: ${tenantConfig.address}

👨‍🍳 YOUR ROLE:
- Help customers explore the menu and make informed dining choices
- Provide accurate information about dishes, ingredients, and allergens
- Suggest dishes based on customer preferences and dietary needs
- Answer questions about pricing, portion sizes, and preparation
- ${tenantConfig.features?.orderTaking ? 'Take orders and confirm details' : 'Provide information only (ordering not enabled)'}
- ${tenantConfig.features?.reservations ? 'Help with table reservations' : 'Direct to phone for reservations'}

📋 MENU KNOWLEDGE:
- You have access to our complete menu, including descriptions, prices, and allergen information
- Always mention prices in INR (₹) when discussing dishes
- Clearly communicate any dietary information (vegetarian, vegan, gluten-free, allergens)
- Inform about spice levels (mild, medium, hot, extra hot)

🎯 CONVERSATION GUIDELINES:
1. **Warm Welcome**: Greet warmly and ask how you can help
2. **Active Listening**: Understand customer needs (dietary restrictions, preferences, budget)
3. **Personalized Suggestions**: Recommend dishes that match their preferences
4. **Clear Communication**: Provide dish names, descriptions, and prices clearly
5. **Allergen Awareness**: ALWAYS ask about allergies and dietary restrictions
6. **Upselling**: Suggest complementary items (drinks, desserts) naturally
7. **Order Confirmation**: Repeat orders back for confirmation before finalizing

🚨 GUARDRAILS:
- NEVER suggest items not on the menu
- NEVER quote incorrect prices
- NEVER ignore allergen information
- ALWAYS ask about dietary restrictions before recommending
- NEVER make medical claims about food (e.g., "this cures...")
- If ordering is disabled, politely direct to alternative methods
- For complex requests, offer to transfer to staff

🗣️ LANGUAGE & TONE:
- Speak in ${language === 'hi' ? 'Hindi' : language === 'ta' ? 'Tamil' : 'English'}
- Use a warm, friendly, professional tone
- Be conversational, not robotic
- Use food-related enthusiasm ("delicious", "popular", "chef's special")

${previousContext ? `\n📝 PREVIOUS CONTEXT:\n${previousContext}` : ''}

Remember: Your goal is to make the customer's dining experience delightful, starting with this conversation!`;
  }

  // Other categories (financial, etc.)
  return this.buildFinancialSystemPrompt(context);
}
```

### 6.2 Restaurant Function Schema

```javascript
// src/services/SharedFunctionSchema.js

static getRestaurantFunctionDeclarations() {
  return [{
    name: "respond_to_customer",
    description: "Respond to customer inquiries about the restaurant, menu, or orders",
    parameters: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          enum: [
            "menu_inquiry",        // Customer asking about dishes
            "dietary_restrictions", // Asking about vegan/gluten-free/etc
            "price_inquiry",        // Asking about pricing
            "allergen_check",       // Checking for allergens
            "recommendation",       // Asking for suggestions
            "order_placement",      // Placing an order
            "reservation",          // Making a reservation
            "business_info",        // Hours, location, parking, etc
            "complaint",            // Issue with food/service
            "general_conversation"  // Chitchat
          ],
          description: "The primary intent of the customer's message"
        },
        response: {
          type: "string",
          description: "Your natural, conversational response to the customer"
        },
        mentioned_dishes: {
          type: "array",
          items: { type: "string" },
          description: "List of menu items mentioned in your response"
        },
        requires_staff_intervention: {
          type: "boolean",
          description: "Set to true if the request needs staff assistance"
        },
        sentiment: {
          type: "string",
          enum: ["positive", "neutral", "negative"],
          description: "Customer's sentiment based on their message"
        }
      },
      required: ["intent", "response"]
    }
  }, {
    name: "place_order",
    description: "Place or modify a customer order (only if ordering is enabled)",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["add_item", "remove_item", "modify_item", "confirm_order", "cancel_order"],
          description: "The order action to perform"
        },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              dish_name: { type: "string" },
              quantity: { type: "integer" },
              customizations: { type: "string" },  // "no onions", "extra spicy"
              price: { type: "number" }
            }
          },
          description: "Items in the order"
        },
        special_instructions: {
          type: "string",
          description: "Any special requests or notes"
        },
        estimated_total: {
          type: "number",
          description: "Calculated order total in INR"
        }
      },
      required: ["action", "items"]
    }
  }, {
    name: "check_availability",
    description: "Check if a dish or table is available",
    parameters: {
      type: "object",
      properties: {
        check_type: {
          type: "string",
          enum: ["dish", "table"],
          description: "What to check availability for"
        },
        item: {
          type: "string",
          description: "Dish name or table size"
        },
        date_time: {
          type: "string",
          description: "For reservations, the requested date/time"
        }
      },
      required: ["check_type", "item"]
    }
  }];
}
```

### 6.3 Restaurant Guardrails

```javascript
// src/middleware/restaurantGuardrails.js

class RestaurantGuardrails {
  static async validateResponse(tenantId, response, functionCall) {
    const violations = [];

    // 1. Menu item validation
    if (functionCall?.mentioned_dishes) {
      const validItems = await this.getValidMenuItems(tenantId);
      const invalidItems = functionCall.mentioned_dishes.filter(
        dish => !validItems.includes(dish.toLowerCase())
      );

      if (invalidItems.length > 0) {
        violations.push({
          type: 'invalid_menu_item',
          items: invalidItems,
          message: 'AI mentioned dishes not on menu'
        });
      }
    }

    // 2. Price accuracy check
    const pricePattern = /₹\s?(\d+)/g;
    const mentionedPrices = [...response.matchAll(pricePattern)];

    for (const [_, price] of mentionedPrices) {
      const isValid = await this.validatePrice(tenantId, price);
      if (!isValid) {
        violations.push({
          type: 'incorrect_price',
          price,
          message: 'Incorrect price quoted'
        });
      }
    }

    // 3. Allergen awareness check
    const allergenKeywords = ['allergy', 'allergic', 'allergen', 'intolerance'];
    const containsAllergenQuery = allergenKeywords.some(kw =>
      response.toLowerCase().includes(kw)
    );

    if (containsAllergenQuery && !response.toLowerCase().includes('allergen')) {
      violations.push({
        type: 'allergen_not_addressed',
        message: 'Customer asked about allergens but response did not address it'
      });
    }

    // 4. Order placement without confirmation
    if (functionCall?.name === 'place_order' &&
        functionCall.action === 'confirm_order') {
      if (!response.includes('confirm') && !response.includes('correct')) {
        violations.push({
          type: 'order_not_confirmed',
          message: 'Order placed without explicit confirmation'
        });
      }
    }

    // 5. Medical claims check
    const medicalClaims = [
      'cure', 'treat', 'heal', 'medicine', 'diagnosis',
      'prevents disease', 'lowers cholesterol'
    ];
    const hasMedicalClaim = medicalClaims.some(claim =>
      response.toLowerCase().includes(claim)
    );

    if (hasMedicalClaim) {
      violations.push({
        type: 'medical_claim',
        message: 'Response contains medical claims'
      });
    }

    // 6. Feature availability check
    const tenant = await this.getTenantConfig(tenantId);

    if (functionCall?.name === 'place_order' && !tenant.features?.orderTaking) {
      violations.push({
        type: 'feature_not_enabled',
        feature: 'orderTaking',
        message: 'Attempted to place order but feature is disabled'
      });
    }

    return {
      valid: violations.length === 0,
      violations
    };
  }

  static async getValidMenuItems(tenantId) {
    // Query D1 database for current menu items
    const tenant = await getTenantConfig(tenantId);
    const db = tenant.d1Database;

    const result = await db
      .prepare('SELECT name FROM menu_items WHERE availability = true')
      .all();

    return result.results.map(row => row.name.toLowerCase());
  }

  static async validatePrice(tenantId, price) {
    const tenant = await getTenantConfig(tenantId);
    const db = tenant.d1Database;

    const result = await db
      .prepare('SELECT COUNT(*) as count FROM menu_items WHERE price_inr = ?')
      .bind(parseFloat(price))
      .first();

    return result.count > 0;
  }
}
```

---

## 7. User Journeys

### Journey 1: Restaurant Owner (Taj Restaurant)

```
Day 1: Onboarding
-----------------
1. Visits thestonepot.pro/signup
2. Fills form:
   - Name: "Taj Restaurant"
   - Subdomain: "tajrestaurant"
   - Business type: "Fine Dining"
   - Cuisine: "North Indian"
3. System provisions:
   - Subdomain: tajrestaurant.thestonepot.pro
   - Cloudflare storage (KV, D1, R2)
   - Google File Search Store
   - Admin credentials
4. Receives email with:
   - Admin portal link: https://tajrestaurant.thestonepot.pro/admin
   - API key
   - Quick start guide

Day 2: Content Upload
---------------------
1. Logs into admin portal
2. Navigates to "Menu Management"
3. Uploads menu PDF → System processes via Python Processor → Uploaded to File Search
4. Scrapes website URL: https://tajrestaurant.com
   - About page
   - Chef specials
   - Policies
5. Manually adds/edits menu items in form:
   - Butter Chicken, ₹450, Main Course, Dairy allergen, Medium spice
   - (Saved to D1 database)
6. System syncs all content to File Search Store

Day 3: Configuration
--------------------
1. Configures voice settings:
   - Voice: "Kore" (female, warm)
   - Language: English
   - Greeting: "Welcome to Taj Restaurant! How may I assist you?"
2. Enables features:
   - ✅ Voice Agent
   - ❌ Order Taking (disabled for now)
   - ❌ Reservations (phone only)
3. Reviews & publishes

Day 4: Testing
--------------
1. Opens customer interface: https://tajrestaurant.thestonepot.pro
2. Tests voice conversations:
   - "What vegetarian dishes do you have?"
   - "Do you have anything gluten-free?"
   - "What are your hours?"
3. Reviews conversation logs in admin dashboard
4. Makes adjustments to menu descriptions

Day 5: Launch
-------------
1. Embeds voice widget on main website (tajrestaurant.com)
2. Promotes to customers: "Try our voice assistant!"
3. Monitors usage analytics in dashboard
```

### Journey 2: Customer (Rahul)

```
Evening: Discovering the Restaurant
-----------------------------------
1. Rahul googles "fine dining north indian mumbai"
2. Finds Taj Restaurant website
3. Sees "Ask our Voice Assistant" widget
4. Clicks → Microphone permission granted

Conversation:
-------------
AI: "Welcome to Taj Restaurant! How may I assist you this evening?"

Rahul: "Hi, I'm looking for a vegetarian meal. What do you recommend?"

AI: "Wonderful! We have several delicious vegetarian options.
     Are you comfortable with spicy food, or do you prefer mild flavors?"

Rahul: "I can handle medium spice. Also, I'm lactose intolerant."

AI: "Thank you for letting me know! I'll suggest dairy-free options.
     Our Dal Tadka is excellent - it's medium spice with no dairy, ₹280.
     We also have Baingan Bharta, which is smoky eggplant curry, ₹320.
     And for mains, our Vegetable Biryani is dairy-free and very popular, ₹340.
     Would any of these interest you?"

Rahul: "The Biryani sounds great. What about appetizers?"

AI: "Perfect choice! For appetizers, I'd recommend our Tandoori Vegetables
     - assorted veggies marinated and grilled, ₹250, completely dairy-free.
     Or our Paneer-free Samosas with mint chutney, ₹180.
     Both pair beautifully with the Biryani!"

Rahul: "How big is the Biryani portion?"

AI: "Our Vegetable Biryani is a generous single serving - about 350 grams
     - that most guests find filling. It comes with raita on the side,
     but we can skip that for you since you're lactose intolerant.
     We'll also include a small salad. Would you like to place an order,
     or would you prefer to call us directly to book a table?"

Rahul: "I'll call to book a table. What's your number?"

AI: "You can reach us at +91-22-1234-5678. We're open today until 11 PM.
     I'd recommend mentioning your dairy restriction when you call so
     our chef can prepare your meal carefully. Looking forward to
     serving you at Taj Restaurant!"

Rahul: "Thanks so much!"

AI: "My pleasure, Rahul! Have a wonderful evening!"

[Rahul calls, books table, visits restaurant, has great experience]
```

---

## 8. API Architecture & Integration Points

### 8.1 System Communication Flow

```typescript
// Cloudflare Workers → Stonepot Backend
POST https://stonepot-api-334610188311.us-central1.run.app/api/tenant/:tenantId/config
Authorization: Bearer <service_token>

// Get tenant configuration for routing
Response: {
  tenantId: "restaurant_123",
  subdomain: "tajrestaurant",
  googleFileSearchStoreId: "fileSearchStores/abc123",
  voiceConfig: {...},
  features: {...}
}

// Stonepot Backend → Python Processor
POST http://python-processor:8080/parse
Content-Type: application/json

// Parse HTML for content ingestion
Request: {
  html: "<html>...</html>",
  url: "https://restaurant.com/menu",
  options: { extractTables: true }
}

// Stonepot Backend → Python Processor → Google File Search
POST http://python-processor:8080/gemini/upload
Content-Type: application/json

// Upload content to tenant's File Search Store
Request: {
  store_id: "fileSearchStores/abc123",
  scrape_data: {...},
  url: "https://restaurant.com/menu",
  title: "Menu"
}

// Cloudflare Workers → Cloudflare KV/D1/R2
// Direct access via bindings (no HTTP)
await env.TENANT_DATA_KV.get('tenant:config');
await env.TENANT_DB.prepare('SELECT * FROM menu_items').all();
```

### 8.2 New API Endpoints Required

#### Tenant Management

```typescript
// Create tenant (combines Cloudflare + Stonepot + File Search provisioning)
POST /api/tenants/provision
Request: {
  restaurantName: string;
  subdomain: string;
  category: string;
  ownerEmail: string;
}
Response: {
  tenantId: string;
  subdomain: string;
  fullDomain: string;
  adminPortalUrl: string;
  apiKey: string;
}

// Get tenant configuration
GET /api/tenants/:tenantId
Response: {
  tenantId: string;
  name: string;
  subdomain: string;
  category: string;
  googleFileSearchStoreId: string;
  cloudflareStorageConfig: {...};
  features: {...};
  status: string;
}

// Update tenant configuration
PATCH /api/tenants/:tenantId
Request: {
  voiceConfig?: {...};
  features?: {...};
  businessHours?: {...};
}

// Delete tenant (cascading delete: CF storage + File Search + Firestore)
DELETE /api/tenants/:tenantId
```

#### Content Management (Tenant-Scoped)

```typescript
// Ingest content from URL
POST /api/tenant/:tenantId/content/ingest
Request: {
  source: "url";
  url: string;
  category: string;  // menu, about, policies, faq
}
Response: {
  success: boolean;
  fileId: string;
  title: string;
  summary: string;
}

// Upload PDF
POST /api/tenant/:tenantId/content/upload
Content-Type: multipart/form-data
FormData: {
  file: File;
  category: string;
  metadata?: object;
}

// List tenant content
GET /api/tenant/:tenantId/content/list
Response: {
  items: Array<{
    id: string;
    type: string;
    title: string;
    sourceUrl?: string;
    fileSearchFileId: string;
    createdAt: string;
  }>;
}

// Delete content
DELETE /api/tenant/:tenantId/content/:contentId
```

#### Menu Management (Restaurant-Specific)

```typescript
// Add menu item
POST /api/tenant/:tenantId/menu
Request: {
  name: string;
  category: string;
  description: string;
  price: number;
  allergens?: string[];
  dietaryTags?: string[];
  spiceLevel?: string;
  imageUrl?: string;
}

// Bulk import menu
POST /api/tenant/:tenantId/menu/import
Request: {
  format: "csv" | "json";
  data: string | object[];
}

// Get menu items
GET /api/tenant/:tenantId/menu?category=main_course&available=true

// Update menu item
PATCH /api/tenant/:tenantId/menu/:itemId

// Delete menu item
DELETE /api/tenant/:tenantId/menu/:itemId
```

#### Session Management (Extended)

```typescript
// Create session (tenant-scoped)
POST /api/session/create
Request: {
  userId: string;
  tenantId: string;  // NEW
  language: string;
}
Response: {
  sessionId: string;
  wsUrl: string;
  token: string;
}

// WebSocket connection (tenant-aware)
WS /api/gemini-live-stream?tenantId=restaurant_123

// Get conversation history (tenant-scoped)
GET /api/tenant/:tenantId/conversations?userId=user_789
```

---

## 9. Implementation Phases

### Phase 1: Foundation (Week 1-2) - CRITICAL

**Goal:** Enable multi-tenant data model and basic tenant provisioning

#### Tasks:
1. **Database Schema Updates**
   - [ ] Add `organizations` collection to Firestore
   - [ ] Add `tenant_content` collection to Firestore
   - [ ] Extend `user_profiles` with `tenantId` field
   - [ ] Extend `sessions` with `tenantId` field
   - [ ] Migration script for existing data

2. **Cloudflare Integration**
   - [ ] Set up Cloudflare Workers API authentication
   - [ ] Implement tenant provisioning API calls
   - [ ] Test storage provisioning (KV, D1, R2)
   - [ ] Verify subdomain creation

3. **Python Processor Integration**
   - [ ] Deploy Python Processor to Cloud Run
   - [ ] Configure Application Default Credentials
   - [ ] Test HTML parsing endpoint
   - [ ] Test Google File Search store creation
   - [ ] Test file upload to File Search

4. **Tenant Provisioning Flow**
   - [ ] Create `POST /api/tenants/provision` endpoint
   - [ ] Orchestrate: Cloudflare + File Search + Firestore
   - [ ] Generate API keys per tenant
   - [ ] Return admin portal credentials

**Success Criteria:**
- ✅ Can provision a new restaurant tenant
- ✅ Tenant gets subdomain, storage, and File Search store
- ✅ Tenant data is isolated in Cloudflare + Firestore

---

### Phase 2: Content Pipeline (Week 3-4)

**Goal:** Enable restaurant owners to upload and manage content

#### Tasks:
1. **Content Management API**
   - [ ] `POST /api/tenant/:tenantId/content/ingest` (URL scraping)
   - [ ] `POST /api/tenant/:tenantId/content/upload` (PDF/file upload)
   - [ ] `GET /api/tenant/:tenantId/content/list`
   - [ ] `DELETE /api/tenant/:tenantId/content/:contentId`

2. **Python Processor Enhanced Parsing**
   - [ ] Add PDF parsing support (PyPDF2 or pdfplumber)
   - [ ] Add CSV menu import
   - [ ] Improve table extraction for pricing tables
   - [ ] Add image extraction and upload to R2

3. **Menu Management API**
   - [ ] `POST /api/tenant/:tenantId/menu` (add item)
   - [ ] `POST /api/tenant/:tenantId/menu/import` (bulk import)
   - [ ] `GET /api/tenant/:tenantId/menu`
   - [ ] `PATCH /api/tenant/:tenantId/menu/:itemId`
   - [ ] Store menu items in D1 database
   - [ ] Sync menu items to File Search as markdown

4. **Content Sync to File Search**
   - [ ] Auto-generate markdown from menu items
   - [ ] Upload to tenant's File Search store
   - [ ] Handle updates/deletions
   - [ ] Track file IDs in Firestore

**Success Criteria:**
- ✅ Restaurant owner can upload menu PDF → appears in File Search
- ✅ Restaurant owner can scrape website → appears in File Search
- ✅ Restaurant owner can manually add menu items → synced to File Search
- ✅ Content is searchable via File Search API

---

### Phase 3: Voice Agent Integration (Week 5-6)

**Goal:** Enable tenant-scoped voice conversations with restaurant knowledge

#### Tasks:
1. **Session Management Extensions**
   - [ ] Modify `VertexAILiveService.createSession()` to accept `tenantId`
   - [ ] Load tenant config from Firestore
   - [ ] Pass tenant's File Search store ID to Vertex AI
   - [ ] Filter conversation history by tenant
   - [ ] Save session with tenant association

2. **Restaurant System Prompts**
   - [ ] Create `buildRestaurantSystemPrompt()` in SharedFunctionSchema
   - [ ] Include tenant name, cuisine, business hours
   - [ ] Add allergen awareness instructions
   - [ ] Add dietary restriction handling
   - [ ] Add order-taking logic (if enabled)

3. **Restaurant Function Schemas**
   - [ ] `respond_to_customer` function
   - [ ] `place_order` function (conditional on tenant feature flag)
   - [ ] `check_availability` function
   - [ ] Intent classification (menu_inquiry, allergen_check, etc.)

4. **Guardrails Implementation**
   - [ ] Menu item validation
   - [ ] Price accuracy check
   - [ ] Allergen awareness enforcement
   - [ ] Medical claims detection
   - [ ] Feature availability check (order taking)
   - [ ] Log guardrail violations

5. **File Search Grounding**
   - [ ] Configure Vertex AI Live with `fileSearch` tool
   - [ ] Pass tenant's `fileSearchStoreId`
   - [ ] Test grounded responses (uses menu content)
   - [ ] Handle no-answer cases gracefully

**Success Criteria:**
- ✅ Customer visits tajrestaurant.thestonepot.pro
- ✅ Voice conversation uses Taj's menu and restaurant info
- ✅ AI accurately answers menu questions with prices
- ✅ AI respects dietary restrictions and allergens
- ✅ Conversation logs saved with tenant association

---

### Phase 4: Admin Portal (Week 7-8)

**Goal:** Build restaurant owner dashboard for content & config management

#### Tasks:
1. **Authentication**
   - [ ] Admin login flow (Firebase Auth)
   - [ ] Role-based access control (owner, manager, staff)
   - [ ] API key management

2. **Dashboard Pages**
   - [ ] Overview: Stats, recent conversations, popular dishes
   - [ ] Menu Management: CRUD for menu items, bulk import
   - [ ] Content Library: Uploaded files, scraped pages, sync status
   - [ ] Voice Configuration: Language, voice, greeting, features
   - [ ] Conversation Logs: Transcripts, sentiment, duration
   - [ ] Analytics: Call volume, popular queries, customer satisfaction

3. **Content Upload UI**
   - [ ] URL scraper form
   - [ ] PDF/file uploader with drag-drop
   - [ ] CSV menu importer
   - [ ] Manual menu item form
   - [ ] Preview before publish

4. **Settings**
   - [ ] Business profile (name, address, hours, cuisine)
   - [ ] Feature toggles (order taking, reservations)
   - [ ] Voice settings (language, voice, greeting)
   - [ ] Subdomain management
   - [ ] Billing (future)

**Success Criteria:**
- ✅ Restaurant owner can log in to admin portal
- ✅ Can upload menu content via multiple methods
- ✅ Can configure voice settings
- ✅ Can view conversation logs and analytics
- ✅ Changes reflect in voice agent immediately

---

### Phase 5: Customer Interface (Week 9-10)

**Goal:** Build beautiful customer-facing voice interface

#### Tasks:
1. **Landing Page**
   - [ ] Restaurant branding (logo, colors from config)
   - [ ] Hero section with restaurant name & cuisine
   - [ ] "Start Voice Conversation" prominent button
   - [ ] Business hours, address, phone
   - [ ] Menu preview (optional)

2. **Voice Interface**
   - [ ] Microphone permission flow
   - [ ] Real-time transcription display (optional)
   - [ ] Audio visualizer during conversation
   - [ ] Conversation history on screen
   - [ ] Mute/unmute, end conversation controls

3. **Embeddable Widget**
   - [ ] `<script>` tag integration for restaurant's main website
   - [ ] Floating voice assistant button
   - [ ] Popup modal with voice interface
   - [ ] Customizable colors/branding

4. **Mobile Responsiveness**
   - [ ] Works on iOS Safari, Android Chrome
   - [ ] Touch-friendly controls
   - [ ] Offline state handling

**Success Criteria:**
- ✅ Customer can easily start voice conversation
- ✅ Interface is polished and professional
- ✅ Works on desktop, mobile, tablet
- ✅ Widget can be embedded on restaurant website

---

### Phase 6: Analytics & Optimization (Week 11-12)

**Goal:** Provide insights and optimize performance

#### Tasks:
1. **Conversation Analytics**
   - [ ] Track call volume per tenant
   - [ ] Measure conversation duration
   - [ ] Detect common queries
   - [ ] Sentiment analysis
   - [ ] Customer satisfaction scoring

2. **Menu Insights**
   - [ ] Most asked-about dishes
   - [ ] Allergen-related queries frequency
   - [ ] Pricing feedback
   - [ ] Upsell opportunities

3. **Performance Optimization**
   - [ ] Cache tenant configs in memory
   - [ ] Optimize File Search queries
   - [ ] Reduce WebSocket latency
   - [ ] Minimize audio buffering

4. **Cost Tracking**
   - [ ] Track Vertex AI Live usage per tenant
   - [ ] Track File Search queries per tenant
   - [ ] Calculate cost per conversation
   - [ ] Usage-based billing preparation

**Success Criteria:**
- ✅ Restaurant owners see actionable insights
- ✅ Can identify popular dishes and optimize menu
- ✅ Voice conversations are fast and responsive
- ✅ Cost per tenant is tracked accurately

---

## 10. Security & Compliance

### Data Isolation

```
✅ Cloudflare Storage: Complete isolation per tenant (separate KV/D1/R2)
✅ Google File Search: Separate store per tenant
✅ Firestore: Document-level tenantId filtering
✅ API: Tenant authentication on every request
✅ Sessions: Tenant-scoped conversation history
```

### Access Control

```typescript
// Tenant API Key Authentication
async function authenticateTenantRequest(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const tenantId = req.params.tenantId;

  // Verify API key belongs to tenant
  const tenant = await getTenantByApiKey(apiKey);

  if (!tenant || tenant.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  req.tenant = tenant;
  next();
}

// User Role-Based Access
async function checkUserRole(userId, tenantId, requiredRole) {
  const userTenant = await firebaseService.queryCollection(
    'tenant_users',
    [
      { field: 'userId', operator: '==', value: userId },
      { field: 'tenantId', operator: '==', value: tenantId }
    ]
  );

  const roleHierarchy = { customer: 0, staff: 1, manager: 2, admin: 3 };

  return roleHierarchy[userTenant.role] >= roleHierarchy[requiredRole];
}
```

### GDPR Compliance

```typescript
// Right to Access
GET /api/tenant/:tenantId/user/:userId/data

// Right to Deletion
DELETE /api/tenant/:tenantId/user/:userId/data
- Delete conversation logs
- Remove personal data from File Search
- Clear session history

// Right to Portability
GET /api/tenant/:tenantId/user/:userId/export
- Export all conversations as JSON
- Export order history
- Export preferences
```

---

## 11. Cost Estimation

### Per Restaurant Tenant (Monthly)

| Service | Usage | Cost |
|---------|-------|------|
| **Cloudflare Workers** | Shared | $5 (amortized) |
| **Cloudflare KV** | 1M reads, 100K writes | $0.50 + $0.50 = $1 |
| **Cloudflare D1** | 10M reads | $5 + $1 = $6 |
| **Cloudflare R2** | 5GB storage | $0.08 |
| **Google File Search** | 1 store, 50 files | $0 (free tier) |
| **Vertex AI Live** | 100 conversations @ 3 min avg | ~$15 |
| **Firestore** | 100K reads, 10K writes | $0.04 + $0.18 = $0.22 |
| **Cloud Run (Stonepot)** | Shared | $10 (amortized) |
| **Cloud Run (Python Processor)** | Shared | $5 (amortized) |
| **Total per tenant** | | **~$43/month** |

### Pricing Model

- **Starter Plan:** $49/month - 200 conversations
- **Professional Plan:** $99/month - 500 conversations
- **Enterprise Plan:** $249/month - Unlimited conversations

**Margins:** 15-80% depending on usage

---

## 12. Success Metrics

### Technical Metrics

- **Provisioning Time:** < 2 minutes from signup to live subdomain
- **Content Sync Time:** < 30 seconds from upload to searchable
- **Voice Latency:** < 500ms round-trip audio
- **Uptime:** 99.9%
- **Guardrail Accuracy:** > 95%

### Business Metrics

- **Restaurant Onboarding:** 10 restaurants in first month
- **Conversation Volume:** 50 conversations per restaurant per month
- **Customer Satisfaction:** > 4.5/5 stars
- **Retention:** > 80% after 3 months

---

## 13. Future Enhancements

### Phase 7+ Ideas

1. **Order Integration**
   - [ ] POS system integration (Square, Clover)
   - [ ] Payment processing
   - [ ] Kitchen display system

2. **Reservation System**
   - [ ] OpenTable integration
   - [ ] Real-time table availability
   - [ ] Confirmation SMS/email

3. **Multi-Language**
   - [ ] Automatic language detection
   - [ ] Hindi, Tamil, Telugu support
   - [ ] Voice synthesis per language

4. **Advanced Analytics**
   - [ ] Customer journey mapping
   - [ ] Cohort analysis
   - [ ] A/B testing for prompts

5. **Marketing Automation**
   - [ ] Follow-up SMS after conversation
   - [ ] Promotional campaigns
   - [ ] Loyalty program integration

6. **AI Training**
   - [ ] Restaurant-specific fine-tuning
   - [ ] Learn from conversation feedback
   - [ ] Personalized recommendations per customer

---

## 14. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Vertex AI costs spiral** | High | Implement per-tenant usage caps, timeout conversations at 5 min |
| **File Search store limit** | Medium | Request quota increase, plan for multiple projects |
| **Cloudflare storage costs** | Medium | Monitor usage, implement data retention policies |
| **Guardrail failures** | High | Multiple validation layers, human-in-loop for complex queries |
| **Low adoption** | High | Pilot with 5 restaurants, iterate based on feedback |
| **Voice recognition accuracy** | Medium | Fall back to text chat, offer transcript corrections |

---

## Conclusion

This architecture provides a **scalable, isolated, multi-tenant platform** for restaurants to offer voice-powered conversational AI to their customers. Key strengths:

✅ **Complete Data Isolation:** Each tenant has dedicated storage (Cloudflare) and knowledge base (File Search)
✅ **Proven Components:** Leverages existing ContentManagementService, VertexAILiveService, and Firebase infrastructure
✅ **Extensible:** Category-specific prompts and guardrails can be added for other verticals (retail, healthcare, etc.)
✅ **Cost-Effective:** Shared compute, isolated storage keeps costs low
✅ **Fast Onboarding:** Automated provisioning gets restaurants live in < 2 minutes

**Next Steps:**
1. Review this architecture with the team
2. Prioritize Phase 1 tasks
3. Set up development/staging environments
4. Begin implementation

---

**Document Version:** 1.0
**Last Updated:** November 13, 2025
**Author:** Stonepot Engineering Team
**Status:** Ready for Implementation
