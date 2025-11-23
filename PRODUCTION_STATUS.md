# Stonepot Production Deployment Status

## 🚀 Deployed Services

### 1. Backend API (Cloud Run)
- **URL**: https://stonepot-restaurant-334610188311.us-central1.run.app
- **Revision**: stonepot-restaurant-00032-rst
- **Status**: ✅ Deployed
- **Features**:
  - Voice ordering with Gemini Live API
  - WebSocket audio streaming
  - Function calling (add_item, show_cart, create_circle, etc.)
  - Collaborative ordering support
  - CORS: Allows all origins (development mode)
  - Display worker integration: `stonepot-restaurant-display.suyesh.workers.dev`

### 2. Display Worker (Cloudflare Workers)
- **URL**: https://stonepot-restaurant-display.suyesh.workers.dev
- **Version**: b317dc85-3594-42fb-aff3-7635f0616f54
- **Status**: ✅ Deployed
- **Features**:
  - WebSocket connections for real-time display updates
  - Durable Objects for session management
  - Handles dish cards, menu displays, cart summaries

### 3. Client App (Cloudflare Pages)
- **URL**: https://stonepot-restaurant-client.suyesh.workers.dev
- **Version**: 0970f547-b537-4871-987a-9db59eadb246
- **Status**: ✅ Deployed
- **Features**:
  - Voice ordering interface
  - Real-time display updates
  - Cart management
  - Collaborative ordering UI
  - VAD (commented out - pending fix)
  - Environment:
    - `NEXT_PUBLIC_WORKER_URL`: https://stonepot-restaurant-display.suyesh.workers.dev
    - `NEXT_PUBLIC_API_URL`: https://stonepot-restaurant-334610188311.us-central1.run.app

### 4. PartyKit Collaborative Server
- **URL**: https://stonepot-collaborative-orders.suyeshs.partykit.dev
- **WebSocket Path**: `wss://stonepot-collaborative-orders.suyeshs.partykit.dev/party/main/{roomId}`
- **Status**: ✅ Deployed
- **Features**:
  - Real-time collaborative ordering
  - Multi-participant sync
  - WebSocket message types: join, leave, add_item, remove_item, update_quantity, finalize
- **Test**: `bun run test-ws.ts` (in stonepot-partykit directory)

## 🔧 Recent Fixes

### CORS Issue (Fixed)
- **Problem**: Client couldn't connect to backend API
- **Fix**: Updated backend config to allow all origins with wildcard `*`
- **File**: `stonepot-restaurant/src/config/index.js`

### Display Worker URL (Fixed)
- **Problem**: Backend was pointing to wrong display worker
- **Fix**: Changed from `theme-edge-worker` to `stonepot-restaurant-display`
- **File**: `stonepot-restaurant/src/config/index.js`

### PartyKit WebSocket Path (Fixed)
- **Problem**: WebSocket connections failing with code 1006
- **Fix**: Discovered correct path is `/party/main/{roomId}` (not `/{roomId}`)
- **Test**: Created `test-ws.ts` for verification

### Console Logs (Cleaned)
- Commented out `[Audio] Speech detected` and `[Audio] RMS silence detected` logs
- **File**: `stonepot-restaurant-client/app/page.tsx`

## 📝 Known Issues

### VAD (Voice Activity Detection)
- **Status**: ⚠️ Disabled
- **Issue**: Model not detecting speech (probability stuck at 0.001)
- **Files**: 
  - `stonepot-restaurant-client/app/config/vad.ts`
  - `stonepot-restaurant-client/app/services/VADService.ts`
  - Code commented out in `page.tsx`
- **Model**: Silero VAD (2.2MB) deployed but not active

### Display Not Working (Investigating)
- **Status**: ⚠️ Reported by user after PartyKit deployment
- **Last Working**: Before PartyKit changes
- **Next Steps**: Check browser console errors

## 🧪 Testing

### Test PartyKit
```bash
cd stonepot-partykit
bun run test-ws.ts
```

### Test Display Worker
```bash
curl https://stonepot-restaurant-display.suyesh.workers.dev/health
# Expected: "Session ID required"
```

### Test Backend
```bash
curl https://stonepot-restaurant-334610188311.us-central1.run.app/health
# Expected: {"status":"healthy","service":"stonepot-restaurant","timestamp":"..."}
```

## 📚 Documentation

- [Quick Start Collaborative](QUICK_START_COLLABORATIVE.md)
- [VAD Success](VAD_SUCCESS.md)
- [Codebase Analysis](CODEBASE_ANALYSIS.md)

---

**Last Updated**: November 20, 2025
**Status**: ✅ All services deployed | ⚠️ Display issue under investigation
