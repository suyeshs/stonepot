# Stonepot Restaurant Display - Cloudflare Durable Objects

Real-time WebSocket server for multimodal display synchronization using Cloudflare Durable Objects.

## Architecture

- **Durable Objects**: WebSocket server with built-in state persistence
- **WebSocket Hibernation**: Zero cost during idle periods
- **Global Edge**: Low latency connections worldwide
- **Multi-Client**: Broadcast updates to all connected displays

## Features

- Real-time transcription display
- Multimodal content (dish cards, menus, order summaries)
- Session state persistence
- Automatic reconnection handling
- CORS support for browser clients

## Directory Structure

```
src/
├── index.ts       # Worker gateway/router
├── session.ts     # SessionManager Durable Object
└── types.ts       # TypeScript type definitions
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure wrangler.toml with your settings

3. Create required resources:
   ```bash
   # Optional: Create D1 database
   npx wrangler d1 create restaurant-sessions

   # Optional: Create R2 bucket
   npx wrangler r2 bucket create restaurant-menu-images

   # Optional: Create KV namespace
   npx wrangler kv:namespace create TENANT_CONFIG
   ```

4. Set secrets:
   ```bash
   npx wrangler secret put AUTH_SECRET
   # Enter your secret token when prompted
   ```

5. Run development server:
   ```bash
   npm run dev
   ```

## Deployment

Deploy to Cloudflare:
```bash
npm run deploy
```

View logs:
```bash
npm run tail
```

## API Endpoints

All endpoints are prefixed with `/session/{sessionId}/`

### WebSocket Connection
- `GET /session/{sessionId}/display` - WebSocket upgrade for display clients
  - Returns 101 Switching Protocols
  - Sends initial state on connection
  - Receives real-time updates

### HTTP Endpoints
- `POST /session/{sessionId}/init` - Initialize session with tenant ID
- `POST /session/{sessionId}/update` - Send update from Bun server (requires auth)
- `GET /session/{sessionId}/state` - Get current conversation state

## WebSocket Message Format

### Server → Client

**Initial State:**
```json
{
  "type": "initial_state",
  "state": {
    "sessionId": "abc123",
    "tenantId": "org_xyz",
    "currentOrder": null,
    "transcriptions": [],
    "displayUpdates": [],
    "startedAt": 1234567890
  },
  "timestamp": 1234567890
}
```

**Update:**
```json
{
  "type": "update",
  "update": {
    "type": "dish_card",
    "displayData": { "dish": {...} },
    "timestamp": 1234567890
  },
  "timestamp": 1234567890
}
```

**Pong:**
```json
{
  "type": "pong",
  "timestamp": 1234567890
}
```

### Client → Server

**Ping:**
```json
{
  "type": "ping"
}
```

## Authentication

Requests to `/update` endpoint require Bearer token authentication:
```bash
Authorization: Bearer YOUR_AUTH_SECRET
```

Set via:
```bash
npx wrangler secret put AUTH_SECRET
```

## Cost Optimization

- **WebSocket Hibernation**: No charges when connections are idle
- **Durable Storage**: Persist conversation state automatically
- **Edge Caching**: Use KV for tenant configuration

## Durable Objects Limits

- Max WebSocket connections per object: 10,000+
- Attachment size limit: 2 KB per WebSocket
- Storage: 50 GB per object
- Request timeout: 30 seconds (can extend with alarms)

## Development Tips

- Use `wrangler dev` for local testing
- Use `wrangler tail` to view live logs
- Test WebSocket connections with browser console or `wscat`
- Monitor costs in Cloudflare dashboard

## Testing WebSocket Connection

Using browser console:
```javascript
const ws = new WebSocket('ws://localhost:8787/session/test123/display');
ws.onmessage = (e) => console.log('Received:', JSON.parse(e.data));
ws.send(JSON.stringify({ type: 'ping' }));
```

Using wscat:
```bash
npm install -g wscat
wscat -c ws://localhost:8787/session/test123/display
```
