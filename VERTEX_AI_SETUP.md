# Vertex AI Live Setup Guide

## Prerequisites

Before deploying, you need to set up Vertex AI in your Google Cloud Project.

## Step 1: Enable Required APIs

```bash
# Set your project
gcloud config set project sahamati-labs

# Enable required APIs
gcloud services enable aiplatform.googleapis.com
gcloud services enable compute.googleapis.com
gcloud services enable run.googleapis.com
```

## Step 2: Grant Service Account Permissions

The Cloud Run service account needs permission to access Vertex AI:

```bash
# Get the Cloud Run service account
PROJECT_ID="sahamati-labs"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant Vertex AI User role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/aiplatform.user"

# Grant additional permissions if needed
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/ml.developer"
```

## Step 3: Verify Environment Variables

Make sure these environment variables are set in your Cloud Run service:

```bash
PROJECT_ID=sahamati-labs
GOOGLE_CLOUD_PROJECT_ID=sahamati-labs
LOCATION=us-central1
VERTEX_AI_LOCATION=us-central1
VERTEX_AI_MODEL=gemini-2.0-flash-lite
VERTEX_AI_LIVE_MODEL=gemini-2.0-flash-exp
VERTEX_AI_VOICE_NAME=Kore
```

## Step 4: Test Vertex AI Access

Create a test script to verify access:

```bash
# Test if Vertex AI API is accessible
curl -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  "https://us-central1-aiplatform.googleapis.com/v1/projects/sahamati-labs/locations/us-central1/publishers/google/models/gemini-2.0-flash-exp"
```

## Step 5: Deploy

After setup, deploy with:

```bash
./deploy.sh
```

## Troubleshooting

### Error: "Session start timeout"

**Cause:** Vertex AI API not enabled or service account lacks permissions

**Fix:**
```bash
# Enable Vertex AI API
gcloud services enable aiplatform.googleapis.com

# Check service account permissions
gcloud projects get-iam-policy sahamati-labs \
  --flatten="bindings[].members" \
  --format="table(bindings.role)" \
  --filter="bindings.members:*compute@developer.gserviceaccount.com"
```

### Error: "403 Permission Denied"

**Cause:** Service account doesn't have Vertex AI User role

**Fix:**
```bash
gcloud projects add-iam-policy-binding sahamati-labs \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/aiplatform.user"
```

### Error: "Model not found"

**Cause:** The Gemini 2.0 Flash Exp model may not be available in your region

**Fix:** Use a different model:
```bash
# Update deploy.sh to use stable model
VERTEX_AI_LIVE_MODEL=gemini-2.0-flash-exp
```

## Available Models

- `gemini-2.0-flash-exp` - Latest experimental (recommended)
- `gemini-2.0-flash-lite` - Lightweight, faster
- `gemini-1.5-flash` - Stable, production-ready

## Checking Logs

```bash
# View Cloud Run logs
gcloud run services logs read stonepot-api \
  --region=us-central1 \
  --limit=50

# Filter for Vertex AI errors
gcloud run services logs read stonepot-api \
  --region=us-central1 \
  --filter="VertexAI"
```

## Cost Considerations

Vertex AI Live API pricing:
- Input audio: ~$0.125 per minute
- Output audio: ~$0.125 per minute
- Total: ~$0.25 per minute of conversation

Estimate for 1000 conversations (avg 2 min each):
- Usage: 2000 minutes
- Cost: ~$500/month

## Alternative: Use Gemini Live API (Simpler Setup)

If Vertex AI setup is too complex, you can use the simpler Gemini Live API:

1. Get an API key from Google AI Studio: https://aistudio.google.com/apikey
2. Set environment variable: `GOOGLE_API_KEY=your_api_key`
3. The app will automatically use Gemini Live instead of Vertex AI

**Note:** Gemini Live API doesn't require service accounts or IAM roles, just an API key.

## Production Recommendations

1. **Use Vertex AI** for production (better security, audit logs, quotas)
2. **Use Gemini Live API** for development/testing (simpler setup)
3. **Enable audit logs** for compliance
4. **Set up monitoring** with Cloud Monitoring
5. **Configure quotas** to control costs
