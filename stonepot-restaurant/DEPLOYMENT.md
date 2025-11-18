# Stonepot Restaurant - Production Deployment Guide

Complete guide for deploying Stonepot Restaurant to Google Cloud Run with Cloudflare integration.

## Prerequisites

- [x] Google Cloud account with billing enabled
- [x] gcloud CLI installed and configured
- [x] Cloudflare account (for theme edge worker)
- [x] Vertex AI API enabled
- [x] Service account credentials ready

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Production Architecture                 │
│                                                          │
│  Client (WebSocket) ──▶ Cloud Run (Bun Server)          │
│         │                      │                        │
│         │                      ├──▶ Vertex AI (Gemini)  │
│         │                      │                        │
│         │                      └──▶ Cloudflare Worker   │
│         │                             (Theme Display)   │
│         │                                  │            │
│         └──────────────────────────────────┘            │
│                 (Display WebSocket)                     │
└─────────────────────────────────────────────────────────┘
```

## Step 1: Setup Google Cloud Project

```bash
# Set your project ID
export GOOGLE_CLOUD_PROJECT=your-project-id

# Set default project
gcloud config set project $GOOGLE_CLOUD_PROJECT

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  secretmanager.googleapis.com \
  aiplatform.googleapis.com
```

## Step 2: Create Service Account and Credentials

```bash
# Create service account for Vertex AI
gcloud iam service-accounts create vertex-ai-restaurant \
  --display-name="Vertex AI Restaurant Service"

# Grant Vertex AI User role
gcloud projects add-iam-policy-binding $GOOGLE_CLOUD_PROJECT \
  --member="serviceAccount:vertex-ai-restaurant@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# Create and download credentials
gcloud iam service-accounts keys create \
  ../../../credentials/google-cloud-vertex-ai.json \
  --iam-account=vertex-ai-restaurant@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com
```

## Step 3: Setup Secrets

Run the setup script to create Google Cloud secrets:

```bash
./setup-secrets.sh
```

This will:
- Create `vertex-ai-credentials` secret from your service account JSON
- Create `cloudflare-auth-token` secret (optional)
- Grant Cloud Run service account access to these secrets

**Manual secret creation (alternative):**

```bash
# Create Vertex AI credentials secret
gcloud secrets create vertex-ai-credentials \
  --data-file=../../../credentials/google-cloud-vertex-ai.json \
  --replication-policy="automatic"

# Create Cloudflare auth token secret (optional)
echo "your-cloudflare-token" | gcloud secrets create cloudflare-auth-token \
  --data-file=- \
  --replication-policy="automatic"

# Grant access to Cloud Run service account
PROJECT_NUMBER=$(gcloud projects describe $GOOGLE_CLOUD_PROJECT --format='value(projectNumber)')
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding vertex-ai-credentials \
  --member="serviceAccount:$COMPUTE_SA" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding cloudflare-auth-token \
  --member="serviceAccount:$COMPUTE_SA" \
  --role="roles/secretmanager.secretAccessor"
```

## Step 4: Deploy to Cloud Run

### Option A: Using deploy script (Recommended)

```bash
./deploy.sh
```

The script will:
1. Build Docker image using Cloud Build
2. Push to Google Container Registry
3. Deploy to Cloud Run with all configurations
4. Display the service URL

### Option B: Using Cloud Build trigger (CI/CD)

Set up automated deployments on git push:

```bash
# Create Cloud Build trigger
gcloud builds triggers create github \
  --name=stonepot-restaurant-deploy \
  --repo-name=stonepot \
  --repo-owner=your-github-username \
  --branch-pattern=^main$ \
  --build-config=stonepot-restaurant/cloudbuild.yaml
```

### Option C: Manual deployment

```bash
# Build image
gcloud builds submit --tag gcr.io/$GOOGLE_CLOUD_PROJECT/stonepot-restaurant

# Deploy to Cloud Run
gcloud run deploy stonepot-restaurant \
  --image=gcr.io/$GOOGLE_CLOUD_PROJECT/stonepot-restaurant \
  --platform=managed \
  --region=us-central1 \
  --allow-unauthenticated \
  --port=8080 \
  --memory=1Gi \
  --cpu=1 \
  --timeout=300 \
  --concurrency=80 \
  --min-instances=0 \
  --max-instances=10 \
  --set-env-vars="NODE_ENV=production,ENVIRONMENT=production,PORT=8080,CLOUDFLARE_WORKER_URL=https://theme-edge-worker.suyesh.workers.dev" \
  --set-secrets="GOOGLE_APPLICATION_CREDENTIALS=vertex-ai-credentials:latest,CLOUDFLARE_AUTH_TOKEN=cloudflare-auth-token:latest"
```

## Step 5: Verify Deployment

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe stonepot-restaurant \
  --region=us-central1 \
  --format='value(status.url)')

echo "Service URL: $SERVICE_URL"

# Test health endpoint
curl $SERVICE_URL/health

# Expected response:
# {"status":"healthy","service":"stonepot-restaurant","timestamp":"2025-11-14T..."}
```

## Step 6: Test the API

### Create a session

```bash
curl -X POST $SERVICE_URL/api/restaurant/sessions \
  -H 'Content-Type: application/json' \
  -d '{
    "tenantId": "test-restaurant",
    "userId": "test-user",
    "language": "en"
  }'
```

Expected response:
```json
{
  "success": true,
  "sessionId": "session_1234567890_abc123",
  "displayUrl": "https://theme-edge-worker.suyesh.workers.dev/ui/conversation?session=...",
  "websocketUrl": "/ws/restaurant/session_1234567890_abc123"
}
```

### Send a display update

```bash
curl -X POST $SERVICE_URL/api/restaurant/sessions/{sessionId}/display \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "dish_card",
    "data": {
      "name": "Margherita Pizza",
      "description": "Classic tomato, mozzarella, and fresh basil",
      "price": 12.99,
      "image": "https://example.com/pizza.jpg",
      "dietary": ["vegetarian"],
      "spiceLevel": 0
    }
  }'
```

## Step 7: Monitor and Debug

### View logs

```bash
# Tail logs in real-time
gcloud run logs tail stonepot-restaurant --region=us-central1

# Follow specific request
gcloud run logs read stonepot-restaurant \
  --region=us-central1 \
  --limit=50
```

### Monitor metrics

```bash
# Open Cloud Run console
gcloud run services describe stonepot-restaurant \
  --region=us-central1 \
  --format="value(status.url)"
```

Visit: https://console.cloud.google.com/run

### Debug issues

```bash
# Check service details
gcloud run services describe stonepot-restaurant \
  --region=us-central1

# Verify secrets are accessible
gcloud run services describe stonepot-restaurant \
  --region=us-central1 \
  --format="value(spec.template.spec.containers[0].env)"
```

## Configuration Options

### Environment Variables

Set via `--set-env-vars` in deployment:

- `NODE_ENV=production` - Runtime environment
- `ENVIRONMENT=production` - Application environment
- `PORT=8080` - Server port (Cloud Run requirement)
- `CLOUDFLARE_WORKER_URL` - Theme edge worker URL
- `VERTEX_PROJECT_ID` - Override GCP project
- `VERTEX_LOCATION` - Vertex AI region (default: us-central1)
- `VERTEX_MODEL_ID` - Model to use (default: gemini-2.0-flash-exp)

### Secrets

Mounted from Google Cloud Secret Manager:

- `GOOGLE_APPLICATION_CREDENTIALS` - Service account JSON
- `CLOUDFLARE_AUTH_TOKEN` - Optional auth token for Cloudflare API

### Resource Limits

Adjust in deploy.sh or Cloud Build config:

- `--memory=1Gi` - Memory allocation
- `--cpu=1` - CPU allocation
- `--timeout=300` - Request timeout (5 minutes)
- `--concurrency=80` - Max concurrent requests per instance
- `--min-instances=0` - Minimum instances (0 for cost savings)
- `--max-instances=10` - Maximum instances for scaling

## Production Best Practices

### 1. Enable HTTPS Only

Cloud Run services are HTTPS-only by default. Ensure clients connect via HTTPS.

### 2. Set up Custom Domain

```bash
gcloud run domain-mappings create \
  --service=stonepot-restaurant \
  --domain=restaurant.yourdomain.com \
  --region=us-central1
```

### 3. Enable Cloud Armor (DDoS Protection)

```bash
# Create security policy
gcloud compute security-policies create stonepot-ddos-policy \
  --description="DDoS protection for Stonepot Restaurant"

# Add rate limiting rule
gcloud compute security-policies rules create 1000 \
  --security-policy=stonepot-ddos-policy \
  --expression="true" \
  --action=rate-based-ban \
  --rate-limit-threshold-count=100 \
  --rate-limit-threshold-interval-sec=60
```

### 4. Set up Monitoring and Alerts

```bash
# Create uptime check
gcloud monitoring uptime-checks create https-check \
  --display-name="Stonepot Restaurant Health" \
  --resource-type=uptime-url \
  --http-check-path=/health

# Create alert policy for errors
gcloud alpha monitoring policies create \
  --notification-channels=YOUR_CHANNEL_ID \
  --display-name="Stonepot Restaurant Errors" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=5 \
  --condition-threshold-duration=60s
```

### 5. Enable Cloud Trace and Profiling

Add to deployment:
```bash
--set-env-vars="GOOGLE_CLOUD_TRACE_ENABLED=true"
```

### 6. Backup and Disaster Recovery

- Firestore data is automatically replicated
- Store credentials in Secret Manager (versioned)
- Tag Docker images with git commit SHA
- Keep deployment scripts in version control

## Cost Optimization

### Free Tier Allocation

Cloud Run includes:
- 2 million requests/month
- 360,000 GB-seconds of memory
- 180,000 vCPU-seconds

### Cost Reduction Tips

1. **Set min-instances=0** - No idle costs
2. **Use appropriate memory** - Start with 512Mi, increase if needed
3. **Set request timeout** - Prevent long-running requests
4. **Monitor usage** - Use Cloud Billing reports
5. **Use caching** - Reduce Vertex AI API calls

## Troubleshooting

### Container fails to start

```bash
# Check build logs
gcloud builds log $(gcloud builds list --limit=1 --format='value(id)')

# Test locally with Docker
docker build -t stonepot-restaurant .
docker run -p 8080:8080 -e PORT=8080 stonepot-restaurant
```

### Vertex AI connection errors

```bash
# Verify credentials secret exists
gcloud secrets describe vertex-ai-credentials

# Check IAM permissions
gcloud projects get-iam-policy $GOOGLE_CLOUD_PROJECT \
  --filter="bindings.role:roles/aiplatform.user"

# Test Vertex AI API directly
gcloud ai models list --region=us-central1
```

### WebSocket connection issues

- Ensure Cloud Run timeout is sufficient (--timeout=300)
- Check client WebSocket URL format
- Verify CORS configuration in index.js
- Monitor connection logs in Cloud Run console

### High latency

- Check Vertex AI region matches Cloud Run region
- Monitor cold start metrics
- Consider increasing min-instances
- Use Cloud Run CPU always-allocated option

## Rollback

If deployment fails:

```bash
# List revisions
gcloud run revisions list --service=stonepot-restaurant --region=us-central1

# Rollback to previous revision
gcloud run services update-traffic stonepot-restaurant \
  --to-revisions=REVISION_NAME=100 \
  --region=us-central1
```

## Next Steps

1. ✅ Deploy theme-edge-worker to Cloudflare (completed)
2. ✅ Deploy stonepot-restaurant to Cloud Run
3. Set up custom domain
4. Configure monitoring and alerts
5. Set up CI/CD pipeline
6. Load test the service
7. Configure autoscaling policies

## Support

For issues:
- Check Cloud Run logs
- Review deployment guide
- Contact development team
