import dotenv from 'dotenv';

dotenv.config();

// In production, use ADC (Application Default Credentials) - no credential files needed
export const config = {
  // Vertex AI Live configuration
  vertexAILive: {
    projectId: process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'sahamati-labs',
    location: process.env.VERTEX_LOCATION || 'us-central1',
    modelId: process.env.VERTEX_MODEL_ID || 'gemini-2.0-flash-live-preview-04-09',
    // In Cloud Run, this is automatically set via ADC
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    // Audio settings for Vertex AI Live
    audio: {
      voiceName: process.env.VERTEX_AI_VOICE_NAME || 'Aoede', // Aoede: Female voice (warm, natural)
      responseModalities: ['AUDIO'] // Native AUDIO mode - fast, natural voice
    },
    // Automatic Activity Detection settings
    automaticActivityDetection: {
      enabled: process.env.VERTEX_VAD_ENABLED !== 'false', // Default: true
      voiceActivityTimeout: parseFloat(process.env.VERTEX_VAD_TIMEOUT || '0.6') // seconds
    },
    // Generation settings
    generation: {
      temperature: parseFloat(process.env.VERTEX_TEMPERATURE || '0.7'),
      maxOutputTokens: parseInt(process.env.VERTEX_MAX_TOKENS || '2048')
    },
    // Session timeout settings
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '600000') // 10 minutes default
  },

  // Gemini Live API configuration (alternative to Vertex AI Live)
  geminiLive: {
    apiKey: process.env.GEMINI_API_KEY,
    modelId: 'gemini-2.0-flash-live-preview-04-09',
    audio: {
      voiceName: 'Aoede', // Female voice
      responseModalities: ['AUDIO']
    },
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '600000')
  },

  // Legacy vertexAI config for backward compatibility
  vertexAI: {
    projectId: process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'sahamati-labs',
    location: process.env.VERTEX_LOCATION || 'us-central1',
    modelId: process.env.VERTEX_MODEL_ID || 'gemini-2.0-flash-live-preview-04-09',
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    audio: {
      voiceName: process.env.VERTEX_AI_VOICE_NAME || 'Aoede',
      responseModalities: ['AUDIO']
    },
    automaticActivityDetection: {
      enabled: process.env.VERTEX_VAD_ENABLED !== 'false',
      voiceActivityTimeout: parseFloat(process.env.VERTEX_VAD_TIMEOUT || '0.6')
    },
    generation: {
      temperature: parseFloat(process.env.VERTEX_TEMPERATURE || '0.7'),
      maxOutputTokens: parseInt(process.env.VERTEX_MAX_TOKENS || '2048')
    }
  },

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'sahamati-labs',
    // In Cloud Run, this is automatically set via ADC
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS
  },

  cloudflare: {
    workerUrl: process.env.CLOUDFLARE_WORKER_URL || 'https://theme-edge-worker.suyesh.workers.dev',
    authToken: process.env.CLOUDFLARE_AUTH_TOKEN
  },

  server: {
    port: parseInt(process.env.PORT || '3001'),
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development'
  },

  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(/[\s,]+/).filter(Boolean) || ['http://localhost:3000']
  },

  session: {
    timeout: parseInt(process.env.SESSION_TIMEOUT || '600000'),
    maxConversationHistory: parseInt(process.env.MAX_CONVERSATION_HISTORY || '50')
  },

  restaurant: {
    defaultVoice: 'Aoede', // Female voice (warm, natural) - Indian English
    defaultLanguage: 'en-IN', // Indian English locale
    // Available female voices: Aoede (warm), Kore (clear), Leda (soft), Zephyr (bright)
    // Available male voices: Puck, Charon, Fenrir, Orus
    multimodal: {
      enabled: true,
      allowedDisplayTypes: [
        'dish_card',
        'menu_section',
        'order_summary',
        'confirmation',
        'webpage',
        'snippet'
      ]
    }
  },

  // Guardrails configuration
  guardrails: {
    maxResponseLength: parseInt(process.env.MAX_RESPONSE_LENGTH || '500'),
    maxHistoryLength: parseInt(process.env.MAX_HISTORY_LENGTH || '50'),
    // All 24+ supported languages with native audio
    // Indian languages (8): Hindi, Bengali, Tamil, Telugu, Kannada, Malayalam, Gujarati, Marathi
    // International (16): Japanese, Korean, Chinese, Thai, Vietnamese, Spanish, French, Portuguese, German, Italian, Polish, Russian, Turkish, Dutch, Arabic, English
    allowedLanguages: (process.env.ALLOWED_LANGUAGES ||
      'en,hi,bn,ta,te,kn,ml,gu,mr,ja,ko,zh,th,vi,es,fr,pt,de,it,pl,ru,tr,nl,ar'
    ).split(','),
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'), // 1 minute
    maxRequestsPerWindow: parseInt(process.env.MAX_REQUESTS_PER_WINDOW || '30'),
    contentFilters: {
      offensive: true,
      personal_info: true,
      food_allergy_disclaimer: true
    }
  },

  // Prompt configuration
  promptConfig: {
    tone: {
      style: process.env.PROMPT_TONE_STYLE || 'friendly',
      personality: process.env.PROMPT_PERSONALITY || 'helpful',
      formality: process.env.PROMPT_FORMALITY || 'balanced'
    },
    responseLength: {
      preference: process.env.RESPONSE_LENGTH_PREFERENCE || 'concise',
      maxTokens: parseInt(process.env.MAX_OUTPUT_TOKENS || '2048'),
      targetSentences: parseInt(process.env.TARGET_SENTENCES || '3')
    },
    restaurantContext: {
      role: 'restaurant ordering assistant',
      capabilities: ['menu browsing', 'order taking', 'recommendations', 'dietary guidance']
    }
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

export default config;
