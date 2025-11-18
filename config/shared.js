import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

/**
 * Shared configuration for all Stonepot projects
 * This provides common paths and credential locations
 */

export const paths = {
  root: rootDir,
  credentials: join(rootDir, 'credentials'),
  config: join(rootDir, 'config')
};

/**
 * Get path to Firebase Admin SDK credentials
 */
export function getFirebaseCredentialsPath() {
  const credPath = join(paths.credentials, 'firebase-admin-sdk.json');

  if (!existsSync(credPath)) {
    console.warn('⚠️  Firebase credentials not found at:', credPath);
    console.warn('   Please place firebase-admin-sdk.json in the credentials/ directory');
    console.warn('   See credentials/README.md for instructions');
    return null;
  }

  return credPath;
}

/**
 * Get path to Google Cloud (Vertex AI) credentials
 */
export function getVertexAICredentialsPath() {
  const credPath = join(paths.credentials, 'google-cloud-vertex-ai.json');

  if (!existsSync(credPath)) {
    console.warn('⚠️  Vertex AI credentials not found at:', credPath);
    console.warn('   Please place google-cloud-vertex-ai.json in the credentials/ directory');
    console.warn('   See credentials/README.md for instructions');
    return null;
  }

  return credPath;
}

/**
 * Get Cloudflare API token
 */
export function getCloudflareApiToken() {
  const tokenPath = join(paths.credentials, 'cloudflare-api-token.txt');

  if (!existsSync(tokenPath)) {
    console.warn('⚠️  Cloudflare API token not found at:', tokenPath);
    return null;
  }

  try {
    const fs = await import('fs');
    return fs.readFileSync(tokenPath, 'utf8').trim();
  } catch (error) {
    console.error('Error reading Cloudflare API token:', error);
    return null;
  }
}

/**
 * Validate that required credentials exist
 */
export function validateCredentials(required = ['firebase', 'vertexai']) {
  const missing = [];

  if (required.includes('firebase') && !getFirebaseCredentialsPath()) {
    missing.push('Firebase Admin SDK (firebase-admin-sdk.json)');
  }

  if (required.includes('vertexai') && !getVertexAICredentialsPath()) {
    missing.push('Vertex AI credentials (google-cloud-vertex-ai.json)');
  }

  if (required.includes('cloudflare') && !getCloudflareApiToken()) {
    missing.push('Cloudflare API token (cloudflare-api-token.txt)');
  }

  if (missing.length > 0) {
    console.error('❌ Missing required credentials:');
    missing.forEach(cred => console.error(`   - ${cred}`));
    console.error('\nSee credentials/README.md for setup instructions\n');
    return false;
  }

  console.log('✅ All required credentials found');
  return true;
}

/**
 * Common configuration shared across all projects
 */
export const sharedConfig = {
  // Firebase configuration
  firebase: {
    credentialsPath: getFirebaseCredentialsPath(),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  },

  // Vertex AI configuration
  vertexAI: {
    credentialsPath: getVertexAICredentialsPath(),
    projectId: process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.VERTEX_LOCATION || 'us-central1'
  },

  // Cloudflare configuration
  cloudflare: {
    apiToken: process.env.CLOUDFLARE_API_TOKEN || getCloudflareApiToken(),
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID
  },

  // Environment
  environment: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production'
};

export default sharedConfig;
