# Gemini File Search Integration

## Overview

This project uses Gemini File Search to provide scalable, semantic menu retrieval for restaurant ordering. File Search is a fully managed RAG (Retrieval-Augmented Generation) solution that enables AI to intelligently search over private documents without managing embeddings, vector stores, or chunking strategies.

**Updated for @google/genai SDK v1.30.0+ with TypeScript support**

## Why File Search?

### The Problem
- **Token Limits**: Direct menu injection into prompts consumes ~8,250 tokens for 55 items
- **Scalability**: Large restaurants (100+ items) exceed context window limits
- **Inefficiency**: Full menu loaded even when only specific items needed

### The Solution
- **Hybrid Architecture**: Pre-load menu via REST API at session init, then use WebSocket for conversation
- **Semantic Search**: File Search intelligently retrieves relevant menu items based on natural language queries
- **Multi-tenant**: Each restaurant gets dedicated File Search store
- **Caching**: Menu context cached for 30 minutes to reduce API calls

## Architecture

```
Session Init (REST API):
  ↓
FileSearchService.getMenuContext(tenantId, language)
  ↓
Gemini File Search Query → Returns semantic menu context
  ↓
Inject into System Prompt
  ↓
WebSocket Conversation (Vertex AI Live API)
  ↓
Real-time voice ordering
```

## Setup Instructions

### 1. Get Gemini API Key

File Search uses the Gemini API (not Vertex AI), so you need a Gemini API key:

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Click "Get API Key"
3. Copy your key
4. Add to your `.env` file:
   ```bash
   GEMINI_API_KEY="your-api-key-here"
   ```

### 2. Generate Menu Document

Run the setup script to generate a structured markdown menu:

```bash
node scripts/setup-file-search-store.js demo
```

This will:
- Transform `staticMenu.js` to markdown format
- Save to `scripts/menu-demo.md`
- Provide instructions for next steps

### 3. Create File Search Store

#### Option A: Via Google AI Studio (Recommended)

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Navigate to "File Search" section
3. Click "Create Store"
4. Name: `menu-demo` (or your tenant ID)
5. Upload file: `scripts/menu-demo.md`
6. Wait for indexing to complete (~1-2 minutes)
7. Copy the Store ID (format: `projects/*/fileSearchStores/*`)

#### Option B: Via REST API

```bash
# Create store
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/fileSearchStores" \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: YOUR_API_KEY" \
  -d '{
    "display_name": "menu-demo"
  }'

# Upload file (use returned store ID)
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/STORE_ID/documents" \
  -H "x-goog-api-key: YOUR_API_KEY" \
  -F "file=@scripts/menu-demo.md"
```

### 4. Configure Environment

Add the store ID to your `.env` file:

```bash
# Enable File Search
FILE_SEARCH_ENABLED=true

# Store IDs for each tenant
FILE_SEARCH_STORE_DEMO="projects/.../fileSearchStores/abc123"
FILE_SEARCH_STORE_TCFC="projects/.../fileSearchStores/def456"
FILE_SEARCH_STORE_TEST="projects/.../fileSearchStores/ghi789"

# Fallback behavior (default: true)
FILE_SEARCH_FALLBACK=true
```

### 5. Test Integration

Start the server and test:

```bash
npm start
```

Check logs for:
```
[VertexAILive] Pre-loading menu from File Search...
[FileSearchService] Querying File Search store for tenant: demo
[VertexAILive] File Search menu loaded: 9332 characters
```

If File Search fails, the system automatically falls back to static menu.

## How It Works

### At Session Creation

1. **Check Availability**: `fileSearchService.isAvailableForTenant(tenantId)`
2. **Query File Search**: REST API call to Gemini with semantic query
3. **Cache Results**: Menu context cached for 30 minutes
4. **Inject to Prompt**: Menu context passed to `buildRestaurantSystemPrompt`
5. **Start WebSocket**: Real-time voice conversation begins

### During Conversation

- **No File Search Calls**: WebSocket uses pre-loaded menu context
- **Fast Responses**: No API latency for menu retrieval
- **Full Capabilities**: All Live API features (voice, vision, function calling)

## Multi-Language Support

File Search queries are language-aware:

```javascript
// English
fileSearchService.getMenuContext('demo', 'en')

// Hindi
fileSearchService.getMenuContext('demo', 'hi')

// Kannada
fileSearchService.getMenuContext('demo', 'kn')
```

Each language gets optimized query and cached results.

## Monitoring & Debugging

### Check File Search Status

```typescript
import { FileSearchService } from './src/services/FileSearchService.ts';
import config from './src/config/index.js';

const service = new FileSearchService(config);

// Check if enabled for tenant
console.log(service.isAvailableForTenant('demo'));

// Get menu context
const context = await service.getMenuContext('demo', 'en');
console.log(context);
```

**Note:** The FileSearchService is now implemented in TypeScript for better type safety and IDE support. Bun natively supports TypeScript, so no compilation step is needed.

### Logs to Watch

```
[FileSearchService] Querying File Search store: projects/.../fileSearchStores/abc123
[FileSearchService] Query: List all menu items with following information...
[FileSearchService] Received 9332 characters from File Search
[FileSearchService] Cached menu context for demo:en
```

### Common Issues

**Issue**: `File Search failed, will use static menu fallback`
- **Cause**: API key missing, store ID invalid, or network error
- **Solution**: Check `GEMINI_API_KEY` and store ID in `.env`

**Issue**: `Menu context empty`
- **Cause**: Store not indexed yet or no documents uploaded
- **Solution**: Wait for indexing, verify document upload in AI Studio

**Issue**: `Cache not working`
- **Cause**: Different tenant/language combinations
- **Solution**: Cache is per `tenantId:language` - this is expected

## Performance

### Metrics

- **Menu Generation**: ~50ms (transform to markdown)
- **File Search Query**: ~800ms (first time)
- **Cache Hit**: <1ms (subsequent queries within 30 min using node-cache)
- **Token Savings**: ~8,250 tokens per session (for 55 items)
- **Memory Footprint**: Reduced with node-cache's automatic cleanup

### Cost Optimization

- **Caching**: Reduces File Search API calls by >95%
- **Smart Queries**: Language-specific queries minimize response size
- **Fallback**: Static menu costs $0 (no API calls)

## Future Enhancements

### Dynamic Search (Optional)

Currently File Search runs once at session init. Future version could support mid-conversation queries:

```javascript
// User: "Tell me more about your desserts"
const dessertInfo = await fileSearchService.searchMenuDetails(
  'demo',
  'desserts with chocolate',
  'en'
);
```

### Multi-Document Support

Future: Support multiple documents per tenant (menu, allergen info, nutritional data):

```javascript
fileSearch: {
  stores: {
    'demo-menu': 'projects/.../fileSearchStores/abc123',
    'demo-allergens': 'projects/.../fileSearchStores/def456',
    'demo-nutrition': 'projects/.../fileSearchStores/ghi789'
  }
}
```

## TypeScript Implementation (v2.0)

### What's New in TypeScript Version

1. **Type Safety**: Full TypeScript types from @google/genai SDK
2. **Better Caching**: Using `node-cache` with automatic TTL management
3. **Improved API**: Using `GoogleGenAI` class with proper method calls
4. **Native Support**: Bun runs TypeScript natively without compilation

### API Structure Changes

**Old (JavaScript):**
```javascript
const client = new GoogleGenAI({ apiKey });
const response = await client.models.generateContent({...});
```

**New (TypeScript):**
```typescript
const genAI = new GoogleGenAI({ apiKey });

// For File Search queries
const result = await genAI.models.generateContent({
  model: 'gemini-1.5-flash',
  contents: [...],
  tools: [{
    fileSearch: {
      fileSearchStoreNames: [storeId]
    }
  }]
});

// For File Search store management
await genAI.fileSearchStores.create({ displayName });
await genAI.fileSearchStores.uploadFile({...});
await genAI.fileSearchStores.list();
await genAI.fileSearchStores.delete({ name });
```

### Migration from JavaScript

The TypeScript version is a drop-in replacement:

1. Import stays the same (Bun handles .ts automatically)
2. All public methods have identical signatures
3. Config structure unchanged
4. Caching behavior improved (automatic expiry with node-cache)

No code changes needed in consuming services!

## References

- [Gemini File Search Documentation](https://ai.google.dev/gemini-api/docs/file-search)
- [Google AI Studio](https://aistudio.google.com/)
- [@google/genai SDK](https://www.npmjs.com/package/@google/genai)
- [node-cache Package](https://www.npmjs.com/package/node-cache)
