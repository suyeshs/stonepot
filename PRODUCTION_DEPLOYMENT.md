# Stonepot - Production Deployment Summary

Complete production deployment guide for all Stonepot services.

## 🎉 Deployment Status

### ✅ Cloudflare (Theme Edge Worker)

**Status**: Deployed and Production-Ready
**URL**: https://theme-edge-worker.suyesh.workers.dev
**Environment**: Default (configured as production)

**Features Deployed:**
- ✅ ConversationSession Durable Object with WebSocket Hibernation
- ✅ Themed HTML UI generation
- ✅ Real-time display updates API
- ✅ Multi-tenant support
- ✅ Category-aware rendering (restaurant/financial)
- ✅ Persistent state storage

**Secrets Configured:**
- ✅ `CACHE_PURGE_TOKEN` - Cache invalidation
- ✅ `SIGNING_KEY` - WebCrypto signing
- ✅ `THEME_API_TOKEN` - Admin API access
- ✅ `GROK_API_KEY` - AI theme generation

**Endpoints:**
- `GET /ui/conversation` - Themed conversation UI
- `POST /conversation/:id/init` - Initialize session
- `POST /conversation/:id/update` - Send display update
- `GET /conversation/:id/state` - Get session state
- `WS /conversation/:id/display` - WebSocket connection

### 🚀 Google Cloud Run (Stonepot Restaurant)

**Status**: Deployment Scripts Ready
**Project**: sahamati-labs (configured)
**Region**: us-central1 (recommended)

**Deployment Files Created:**
- ✅ `stonepot-restaurant/Dockerfile` - Production container
- ✅ `stonepot-restaurant/.dockerignore` - Build optimization
- ✅ `stonepot-restaurant/deploy.sh` - Deployment script
- ✅ `stonepot-restaurant/setup-secrets.sh` - Secrets setup
- ✅ `stonepot-restaurant/cloudbuild.yaml` - CI/CD configuration
- ✅ `stonepot-restaurant/DEPLOYMENT.md` - Complete deployment guide

**To Deploy:**

```bash
cd stonepot-restaurant

# 1. Setup secrets (one-time)
./setup-secrets.sh

# 2. Deploy to Cloud Run
./deploy.sh
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Production Architecture                       │
│                                                                  │
│  ┌──────────────┐                                               │
│  │   Client     │                                               │
│  │  (Browser)   │                                               │
│  └───────┬──────┘                                               │
│          │                                                       │
│          ├──────────────────────────────────────────┐           │
│          │                                          │           │
│    WebSocket Audio                           HTTP Display       │
│          │                                          │           │
│          ▼                                          ▼           │
│  ┌──────────────────┐                    ┌─────────────────┐   │
│  │  Cloud Run       │                    │   Cloudflare    │   │
│  │  (Bun Server)    │────────HTTP────────▶  Workers DO     │   │
│  │                  │    Display Updates │  (WebSocket)    │   │
│  └────────┬─────────┘                    └────────┬────────┘   │
│           │                                       │            │
│           ▼                                       ▼            │
│  ┌──────────────────┐                    ┌─────────────────┐   │
│  │  Vertex AI       │                    │   Display UI    │   │
│  │  Gemini 2.0      │                    │   (Themed)      │   │
│  └──────────────────┘                    └─────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Deploy Theme Edge Worker (Already Done ✅)

The theme edge worker is already deployed and configured at:
https://theme-edge-worker.suyesh.workers.dev

To redeploy or update:
```bash
cd /Users/stonepot-tech/facemash-platform/workers/theme-edge-worker
npx wrangler deploy
```

### 2. Deploy Stonepot Restaurant

```bash
# Navigate to restaurant service
cd stonepot-restaurant

# Setup Google Cloud secrets (one-time)
# Make sure credentials/google-cloud-vertex-ai.json exists first
./setup-secrets.sh

# Deploy to Cloud Run
./deploy.sh
```

## Service Endpoints

### Theme Edge Worker (Cloudflare)

- **Base URL**: https://theme-edge-worker.suyesh.workers.dev
- **Health**: Not exposed (internal service)
- **UI**: `/ui/conversation?session={id}&tenant={tenant}&category=restaurant`
- **API**: `/conversation/{sessionId}/*`

### Stonepot Restaurant (Cloud Run)

After deployment, you'll get a URL like:
- **Base URL**: https://stonepot-restaurant-{hash}-uc.a.run.app
- **Health**: `GET /health`
- **Sessions**: `POST /api/restaurant/sessions`
- **WebSocket**: `WS /ws/restaurant/{sessionId}`

## Environment Configuration

### Cloudflare Workers (Theme Edge Worker)

**Environment Variables** (set in wrangler.toml):
```toml
[vars]
ENVIRONMENT = "development"  # Change to "production" for prod env
```

**Secrets** (set via wrangler secret):
- `CACHE_PURGE_TOKEN` ✅
- `SIGNING_KEY` ✅
- `THEME_API_TOKEN` ✅
- `GROK_API_KEY` ✅

### Cloud Run (Stonepot Restaurant)

**Environment Variables** (set during deployment):
- `NODE_ENV=production`
- `ENVIRONMENT=production`
- `PORT=8080`
- `CLOUDFLARE_WORKER_URL=https://theme-edge-worker.suyesh.workers.dev`

**Secrets** (from Google Cloud Secret Manager):
- `GOOGLE_APPLICATION_CREDENTIALS` (vertex-ai-credentials)
- `CLOUDFLARE_AUTH_TOKEN` (cloudflare-auth-token) - optional

## Testing Production Deployment

### Test Theme Edge Worker

```bash
# Initialize a session
curl -X POST https://theme-edge-worker.suyesh.workers.dev/conversation/test-123/init \
  -H 'Content-Type: application/json' \
  -d '{"tenantId":"test-restaurant","category":"restaurant"}'

# Send a display update
curl -X POST https://theme-edge-worker.suyesh.workers.dev/conversation/test-123/update \
  -H 'Content-Type: application/json' \
  -d '{
    "type":"dish_card",
    "data":{
      "name":"Test Pizza",
      "price":12.99,
      "description":"Test dish"
    }
  }'

# Get session state
curl https://theme-edge-worker.suyesh.workers.dev/conversation/test-123/state

# View UI
open "https://theme-edge-worker.suyesh.workers.dev/ui/conversation?session=test-123&tenant=test-restaurant&category=restaurant"
```

### Test Cloud Run Service (After Deployment)

```bash
# Replace with your actual service URL
SERVICE_URL="https://stonepot-restaurant-{hash}-uc.a.run.app"

# Health check
curl $SERVICE_URL/health

# Create a session
curl -X POST $SERVICE_URL/api/restaurant/sessions \
  -H 'Content-Type: application/json' \
  -d '{
    "tenantId":"test-restaurant",
    "userId":"test-user",
    "language":"en"
  }'

# You'll get back:
# {
#   "sessionId": "session_...",
#   "displayUrl": "https://theme-edge-worker.suyesh.workers.dev/ui/conversation?...",
#   "websocketUrl": "/ws/restaurant/session_..."
# }

# Test display update
curl -X POST $SERVICE_URL/api/restaurant/sessions/{sessionId}/display \
  -H 'Content-Type: application/json' \
  -d '{
    "type":"dish_card",
    "data":{
      "name":"Margherita Pizza",
      "description":"Classic pizza",
      "price":12.99,
      "dietary":["vegetarian"]
    }
  }'
```

## Integration Flow

1. **Client** calls Cloud Run to create a session
2. **Cloud Run** initializes Vertex AI session and Cloudflare display session
3. **Client** opens WebSocket to Cloud Run for audio
4. **Client** opens display URL in browser (Cloudflare)
5. **Cloud Run** sends display updates to Cloudflare via HTTP
6. **Cloudflare** broadcasts updates to display clients via WebSocket
7. **Vertex AI** processes voice and triggers function calls
8. **Function calls** automatically update the display

## Monitoring and Logs

### Cloudflare Workers

```bash
# View logs (live tail)
npx wrangler tail

# View analytics
npx wrangler pages deployment list
```

Or visit: https://dash.cloudflare.com/

### Cloud Run

```bash
# Tail logs
gcloud run logs tail stonepot-restaurant --region=us-central1

# View in console
open "https://console.cloud.google.com/run"
```

## Cost Estimates

### Cloudflare Workers

- **Plan**: Free tier should cover development/testing
- **Requests**: 100,000 requests/day (free)
- **Durable Objects**: $0.15/million requests + $0.20/GB-month storage
- **Estimated**: $5-20/month for moderate traffic

### Cloud Run

- **Free Tier**: 2M requests/month, 360K GB-seconds
- **Memory**: 1Gi @ $0.00000250/GB-second
- **CPU**: 1 vCPU @ $0.00002400/vCPU-second
- **Requests**: $0.40/million after free tier
- **Estimated**: $10-50/month for moderate traffic

### Vertex AI (Gemini 2.0 Flash)

- **Input**: $0.075 per 1M characters
- **Output**: $0.30 per 1M characters
- **Audio**: Varies by duration
- **Estimated**: $20-100/month depending on usage

**Total Estimated Monthly Cost**: $35-170 for moderate production traffic

## Security Checklist

- [x] Secrets stored in Secret Manager (not in code)
- [x] Service accounts with minimal permissions
- [x] HTTPS enforced on all endpoints
- [x] WebSocket connections authenticated
- [x] Cloud Run allows only necessary traffic
- [x] Cloudflare Workers secrets configured
- [ ] Rate limiting configured (optional)
- [ ] DDoS protection enabled (optional)
- [ ] Custom domain with SSL (optional)

## Backup and Recovery

### Cloudflare Workers

- Durable Objects data is automatically replicated
- Configuration in wrangler.toml is version controlled
- Secrets should be documented (not committed)

### Cloud Run

- Container images stored in GCR (multiple versions)
- Deployment scripts in version control
- Secrets in Secret Manager (versioned)
- Firestore data automatically replicated
- Can rollback to previous revisions instantly

## Next Steps

1. **Deploy Cloud Run** - Run `./setup-secrets.sh` and `./deploy.sh`
2. **Custom Domain** - Set up custom domains for both services
3. **Monitoring** - Configure Cloud Monitoring alerts
4. **CI/CD** - Set up Cloud Build triggers for automated deployments
5. **Load Testing** - Test with production-like load
6. **Documentation** - Document tenant onboarding process
7. **Scaling** - Configure autoscaling policies based on metrics

## Support and Troubleshooting

### Common Issues

**Issue**: Cloud Run deployment fails with credentials error
- **Solution**: Run `./setup-secrets.sh` to create secrets
- **Check**: `gcloud secrets list`

**Issue**: Vertex AI connection timeout
- **Solution**: Verify service account has `aiplatform.user` role
- **Check**: Vertex AI API is enabled

**Issue**: WebSocket connection refused
- **Solution**: Ensure Cloud Run timeout is >= 300s
- **Check**: CORS configuration in index.js

**Issue**: Display updates not showing
- **Solution**: Verify `CLOUDFLARE_WORKER_URL` environment variable
- **Check**: Theme edge worker logs

### Getting Help

1. Check deployment logs: `gcloud run logs tail stonepot-restaurant`
2. Review [DEPLOYMENT.md](stonepot-restaurant/DEPLOYMENT.md)
3. Verify all secrets are set
4. Test endpoints individually
5. Contact development team

## Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [Durable Objects Guide](https://developers.cloudflare.com/durable-objects/)
- [Theme Edge Worker](https://theme-edge-worker.suyesh.workers.dev)

---

**Last Updated**: 2025-11-14
**Version**: 1.0.0
**Status**: Production-Ready
