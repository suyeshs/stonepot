# Stonepot Restaurant - Bun Server

Voice-powered restaurant ordering system with multimodal display capabilities.

## Architecture

- **Voice Processing**: Vertex AI Live for audio-to-audio conversations (Gemini 2.0 Flash)
- **Agent Logic**: Restaurant ordering agent with menu knowledge
- **Display Updates**: Sends real-time updates to Theme Edge Worker (Cloudflare Durable Objects)
- **Multi-Tenant**: Supports multiple restaurants with isolated data
- **Multimodal UI**: Integrated with [theme-edge-worker.suyesh.workers.dev](https://theme-edge-worker.suyesh.workers.dev) for themed conversation displays

## Directory Structure

```
src/
├── agents/              # Restaurant agent implementation
│   └── RestaurantAgent.js
├── services/           # Core services
│   ├── VertexAILiveService.js
│   ├── RestaurantContentService.js
│   ├── OrganizationService.js
│   ├── SessionPersistenceService.js
│   └── DisplayApiClient.js
├── middleware/         # Request middleware
│   ├── restaurantGuardrails.js
│   └── tenantContext.js
├── templates/          # Display template generators
│   ├── DishCard.js
│   ├── MenuSection.js
│   ├── OrderSummary.js
│   └── ConfirmationPage.js
├── routes/            # API routes
│   ├── restaurantRoutes.js
│   └── organizationRoutes.js
├── config/            # Configuration
│   └── index.js
├── utils/             # Utilities
│   └── firebase.js
└── index.js           # Entry point
```

## Setup

1. Install dependencies:
   ```bash
   bun install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. Run development server:
   ```bash
   bun run dev
   ```

## Environment Variables

```
# Vertex AI
VERTEX_PROJECT_ID=your-gcp-project
VERTEX_LOCATION=us-central1
VERTEX_MODEL_ID=gemini-2.0-flash-exp

# Firebase
FIREBASE_PROJECT_ID=your-firebase-project
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json

# Cloudflare Display API
CLOUDFLARE_WORKER_URL=https://your-worker.workers.dev
CLOUDFLARE_AUTH_TOKEN=your-secret-token

# Server
PORT=3001
NODE_ENV=development
```

## API Endpoints

### Voice Session
- `POST /api/restaurant/sessions` - Create new voice session
  - Body: `{ "tenantId": "restaurant-id", "userId": "optional", "language": "en" }`
  - Returns: `{ "sessionId", "displayUrl", "websocketUrl" }`
- `GET /api/restaurant/sessions/:id` - Get session status
- `DELETE /api/restaurant/sessions/:id` - Close session
- `POST /api/restaurant/sessions/:id/display` - Send display update
  - Body: `{ "type": "dish_card|menu_section|order_summary", "data": {...} }`
- `WS /ws/restaurant/:id` - WebSocket audio streaming (bidirectional PCM audio)

### Menu Management (Coming Soon)
- `POST /api/menu/upload` - Upload menu document
- `GET /api/menu` - Get current menu
- `PUT /api/menu/items/:itemId` - Update menu item

### Organization (Coming Soon)
- `POST /api/organizations` - Create restaurant tenant
- `GET /api/organizations/:orgId` - Get tenant details

## Theme Edge Worker Integration

The service integrates with the Theme Edge Worker for multimodal conversation displays:

### Display Update Types

1. **dish_card** - Show dish details with image, price, dietary info
2. **menu_section** - Display a section of the menu
3. **order_summary** - Current order with items, prices, total
4. **order_update** - Item added/removed notification
5. **confirmation** - Order confirmation with details
6. **transcription** - Real-time conversation text
7. **advice_card** - Recommendations or tips

### Usage Example

```javascript
// 1. Create session
const res = await fetch('http://localhost:3001/api/restaurant/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenantId: 'restaurant-123',
    userId: 'user-456',
    language: 'en'
  })
});

const { sessionId, displayUrl } = await res.json();

// 2. Open display UI in browser
window.open(displayUrl); // Shows themed conversation interface

// 3. Connect WebSocket for audio
const ws = new WebSocket(`ws://localhost:3001/ws/restaurant/${sessionId}`);

ws.onmessage = (event) => {
  // Play audio response from AI
  playAudio(event.data);
};

// Send user's audio
microphoneStream.on('data', (audioChunk) => {
  ws.send(audioChunk); // Binary PCM audio (16kHz, mono, 16-bit)
});
```

### Services

**DisplayApiClient** - Handles communication with Theme Edge Worker:
```javascript
import { DisplayApiClient } from './services/DisplayApiClient.js';

const client = new DisplayApiClient(config);
await client.initializeSession(sessionId, tenantId, 'restaurant');
await client.sendDishCard(sessionId, { name: 'Pizza', price: 12.99, ... });
```

**VertexAILiveService** - Manages Vertex AI conversations with display integration:
```javascript
import { VertexAILiveService } from './services/VertexAILiveService.js';

const service = new VertexAILiveService(config);
const session = await service.createSession(sessionId, { tenantId, userId });
```

## Development

- Uses Bun runtime for fast performance
- ESM modules throughout
- TypeScript definitions included
- Hot reload in development mode
- Integrated with Cloudflare Durable Objects for real-time display

## Deployment

Deploy to Google Cloud Run:
```bash
./deploy.sh
```

Make sure to set environment variable `CLOUDFLARE_WORKER_URL=https://theme-edge-worker.suyesh.workers.dev`
