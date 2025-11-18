# Credentials Directory

This directory contains shared credentials used across all Stonepot projects.

## Required Files

Place the following credential files in this directory:

### 1. Firebase Admin SDK Service Account
**File**: `firebase-admin-sdk.json`

Download from:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings → Service Accounts
4. Click "Generate New Private Key"
5. Save as `firebase-admin-sdk.json` in this directory

Used by:
- stonepot-financial
- stonepot-restaurant

### 2. Google Cloud Service Account (for Vertex AI)
**File**: `google-cloud-vertex-ai.json`

Download from:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to IAM & Admin → Service Accounts
3. Create a service account with these roles:
   - Vertex AI User
   - Vertex AI Service Agent
4. Create a JSON key
5. Save as `google-cloud-vertex-ai.json` in this directory

Used by:
- stonepot-financial
- stonepot-restaurant

### 3. Cloudflare API Token (Optional)
**File**: `cloudflare-api-token.txt`

Create from:
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to My Profile → API Tokens
3. Create Token with permissions:
   - Account: Workers Scripts (Edit)
   - Account: Workers KV Storage (Edit)
   - Account: D1 (Edit)
4. Save the token in `cloudflare-api-token.txt`

Used by:
- stonepot-restaurant-display (for deployment)

## Security Notes

⚠️ **IMPORTANT**:
- These files contain sensitive credentials
- They are excluded from git via `.gitignore`
- Never commit these files to version control
- Never share these files publicly
- Rotate credentials regularly

## File Permissions

Set appropriate permissions on credential files:

```bash
chmod 600 credentials/*.json
chmod 600 credentials/*.txt
```

## Verification

After placing files, verify they exist:

```bash
ls -la credentials/
```

You should see:
- `firebase-admin-sdk.json`
- `google-cloud-vertex-ai.json`
- `cloudflare-api-token.txt` (optional)

## Environment Variables

The shared config will automatically load these credentials. You still need to set other environment variables in each project's `.env` file.

See:
- `/config/shared.env.example` for common variables
- Each project's `.env.example` for project-specific variables
