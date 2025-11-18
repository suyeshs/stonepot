# Stonepot - Voice-Powered AI Services

Monorepo containing multiple voice-powered AI services using Vertex AI Live.

## Projects

### 1. stonepot-financial
Financial advisory service with voice interface.
- Voice-first financial advice
- Multi-language support
- Fraud detection
- Conversation persistence

[View Documentation](./stonepot-financial/README.md)

### 2. stonepot-restaurant
Restaurant ordering service with multimodal display.
- Voice ordering
- Menu information
- Dish recommendations
- Real-time display updates

**Components:**
- **stonepot-restaurant**: Bun server with Vertex AI integration
- **stonepot-restaurant-display**: Cloudflare Durable Objects for WebSocket
- **stonepot-restaurant-client**: Next.js frontend

[View Documentation](./stonepot-restaurant/README.md)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Financial Service                         │
│  ┌──────────────┐     ┌──────────────┐                      │
│  │ Bun Server   │────▶│  Vertex AI   │                      │
│  │  + Agent     │     │    Live      │                      │
│  └──────────────┘     └──────────────┘                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   Restaurant Service                         │
│  ┌──────────────┐     ┌──────────────┐    ┌──────────────┐ │
│  │ Bun Server   │────▶│  Vertex AI   │    │  Cloudflare  │ │
│  │  + Agent     │     │    Live      │    │   Durable    │ │
│  └──────┬───────┘     └──────────────┘    │   Objects    │ │
│         │                                  │ (WebSocket)  │ │
│         └──────────────────────────────────▶              │ │
│                                            └──────┬───────┘ │
│                                                   │         │
│                                            ┌──────▼───────┐ │
│                                            │   Next.js    │ │
│                                            │   Frontend   │ │
│                                            └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Runtime**: Bun (fast JavaScript runtime)
- **Voice AI**: Google Vertex AI Live (Gemini 2.0)
- **Real-Time**: Cloudflare Durable Objects + WebSocket Hibernation
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Database**: Firestore (session persistence)
- **Deployment**: Google Cloud Run + Cloudflare Workers

## Quick Start

📚 **[Complete Setup Guide →](./SETUP.md)**

### Prerequisites
- Bun runtime >= 1.0.0
- Node.js >= 18.0.0
- Google Cloud account with billing
- Firebase project
- Cloudflare account (for restaurant service)

### Credentials Setup

All credentials are stored in the centralized `/credentials/` directory:

```bash
# Run the setup script
./scripts/setup-credentials.sh
```

**Required files:**
- `credentials/firebase-admin-sdk.json` - Firebase Admin SDK
- `credentials/google-cloud-vertex-ai.json` - Vertex AI credentials
- `credentials/cloudflare-api-token.txt` - Cloudflare token (optional)

See [credentials/README.md](./credentials/README.md) for detailed instructions.

### Financial Service

```bash
cd stonepot-financial
bun install
cp .env.example .env
# Configure .env
bun run dev
```

### Restaurant Service

**1. Backend (Bun Server):**
```bash
cd stonepot-restaurant
bun install
cp .env.example .env
# Configure .env
bun run dev
```

**2. Display WebSocket (Cloudflare):**
```bash
cd stonepot-restaurant-display
npm install
# Configure wrangler.toml
npm run dev
```

**3. Frontend (Next.js):**
```bash
cd stonepot-restaurant-client
npm install
cp .env.example .env.local
# Configure .env.local
npm run dev
```

## Development Workflow

### Adding a New Feature to Financial Service
1. Modify agent in `stonepot-financial/src/agents/`
2. Update function schemas in `src/services/`
3. Test locally
4. Deploy to Cloud Run

### Adding a New Feature to Restaurant Service
1. Update restaurant agent in `stonepot-restaurant/src/agents/`
2. Add display templates if needed
3. Update Durable Object logic in `stonepot-restaurant-display/`
4. Update frontend components in `stonepot-restaurant-client/`
5. Deploy all three components

## Deployment

### Financial Service
```bash
cd stonepot-financial
./deploy.sh
```

### Restaurant Service
```bash
# Deploy Bun server
cd stonepot-restaurant
./deploy.sh

# Deploy Cloudflare Worker
cd ../stonepot-restaurant-display
npm run deploy

# Deploy Frontend
cd ../stonepot-restaurant-client
vercel deploy
```

## Environment Variables

Each project has its own `.env.example` file. Copy and configure:
- `stonepot-financial/.env`
- `stonepot-restaurant/.env`
- `stonepot-restaurant-display/wrangler.toml`
- `stonepot-restaurant-client/.env.local`

## Documentation

### Setup & Configuration
- **[Complete Setup Guide](./SETUP.md)** - Full installation and configuration
- [Credentials Setup](./credentials/README.md) - Setting up service accounts
- [Shared Configuration](./config/shared.js) - Common configuration reference

### Architecture
- [Multi-Agent Architecture](./MULTI_AGENT_CONVERSATION_ARCHITECTURE.md)
- [Multi-Tenant Restaurant Architecture](./MULTI_TENANT_RESTAURANT_ARCHITECTURE.md)
- [Multi-Voice Options](./MULTI_VOICE_MULTI_AGENT_OPTIONS.md)

### Platform Setup
- [Vertex AI Setup](./VERTEX_AI_SETUP.md)
- [Firestore Setup](./FIRESTORE_SETUP.md)

## License

Proprietary - All rights reserved

## Support

For issues or questions, contact the development team.
