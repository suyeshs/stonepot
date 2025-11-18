/**
 * Vertex AI Multimodal Live Service for Restaurant Ordering
 * Native audio-to-audio streaming with Gemini 2.0 Flash
 * Integrated with DisplayApiClient for multimodal UI updates
 */

import { GoogleAuth } from 'google-auth-library';
import WebSocket from 'ws';
import { DisplayApiClient } from './DisplayApiClient.js';
import { llmConfigService } from './LLMConfigService.js';

export class VertexAILiveService {
  constructor(config) {
    this.config = config;
    this.projectId = config.vertexAI.projectId;
    this.location = config.vertexAI.location;
    this.model = config.vertexAI.modelId;
    this.activeSessions = new Map();
    this.initialized = false;

    // Initialize Display API Client (HTTP POST to Durable Object)
    this.displayClient = new DisplayApiClient(config);

    // Initialize LLM Config Service
    this.llmConfigService = llmConfigService;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize Google Auth for access tokens
      this.auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        ...(this.config.vertexAI.credentialsPath && {
          keyFile: this.config.vertexAI.credentialsPath
        })
      });

      console.log('[VertexAILive] Initialized', {
        projectId: this.projectId,
        location: this.location,
        model: this.model
      });

      this.initialized = true;
    } catch (error) {
      console.error('[VertexAILive] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get access token for WebSocket authentication
   */
  async getAccessToken() {
    const client = await this.auth.getClient();
    const accessToken = await client.getAccessToken();
    return accessToken.token;
  }

  /**
   * Create WebSocket URL for Vertex AI Multimodal Live API
   */
  getWebSocketUrl() {
    return `wss://${this.location}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;
  }

  /**
   * Create a new Live API session for restaurant ordering
   */
  async createSession(sessionId, sessionConfig = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const { tenantId, language = 'en', userId } = sessionConfig;

      console.log('[VertexAILive] Creating session', { sessionId, tenantId, language, userId });

      // Initialize display session
      if (tenantId) {
        await this.displayClient.initializeSession(sessionId, tenantId, 'restaurant');
      }

      // Get access token for WebSocket auth
      const accessToken = await this.getAccessToken();

      // Create WebSocket connection
      const wsUrl = this.getWebSocketUrl();
      const ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Wait for connection to open
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.terminate();
          reject(new Error('WebSocket connection timeout'));
        }, 10000);

        ws.once('open', () => {
          clearTimeout(timeout);
          console.log('[VertexAILive] WebSocket connected', { sessionId });
          resolve();
        });

        ws.once('error', (error) => {
          clearTimeout(timeout);
          console.error('[VertexAILive] WebSocket connection error', { sessionId, error: error.message });
          reject(error);
        });
      });

      // Build system instruction for restaurant ordering
      const systemInstruction = this.buildRestaurantSystemPrompt(language, { ...sessionConfig, sessionId });

      // Get function declarations for restaurant operations
      const functionDeclarations = this.getRestaurantFunctionDeclarations();

      const session = {
        id: sessionId,
        tenantId,
        userId,
        ws,
        language,
        systemInstruction,
        functionDeclarations,

        // Enhanced order state for complete order management
        orderState: {
          customer: {
            name: null,
            phone: null,
            confirmedAt: null
          },
          cart: {
            items: [],
            subtotal: 0,
            tax: 0,
            total: 0,
            lastUpdated: null
          },
          dishCardCache: new Map(),  // Track shown dishes
          pendingConfirmations: new Set()  // Track awaiting confirmation
        },

        // Legacy support (deprecated)
        currentOrder: {
          items: [],
          subtotal: 0,
          tax: 0,
          total: 0
        },

        conversation: [],
        isActive: false,
        isSetupComplete: false,
        createdAt: Date.now(),
        lastActivityAt: Date.now(),

        // Service references (will be injected)
        menuService: null,
        firebaseService: null
      };

      // Setup WebSocket event handlers
      this.setupWebSocketHandlers(session);

      // Store session
      this.activeSessions.set(sessionId, session);

      // Send setup message
      await this.sendSetup(session);

      // Wait for setup to complete
      await new Promise((resolve, reject) => {
        const setupTimeout = setTimeout(() => {
          reject(new Error('Setup timeout'));
        }, 15000);

        session.setupResolve = () => {
          clearTimeout(setupTimeout);
          resolve();
        };
      });

      console.log('[VertexAILive] Session ready', { sessionId });

      return session;
    } catch (error) {
      console.error('[VertexAILive] Session creation failed', { sessionId, error: error.message });
      throw error;
    }
  }

  /**
   * Build system prompt for restaurant ordering
   */
  buildRestaurantSystemPrompt(language, sessionConfig) {
    const sessionId = sessionConfig.sessionId || 'default';

    // Get LLM config for this session
    const llmConfig = this.llmConfigService.getConfig(sessionId);

    // Build config-based instructions
    const configInstructions = this.llmConfigService.buildSystemInstructions(llmConfig);

    // Build menu context from menuItems
    let menuContext = '';
    if (sessionConfig.menuItems && sessionConfig.menuItems.length > 0) {
      menuContext = '\n\n**AVAILABLE MENU ITEMS:**\n';

      // Group by category for better organization
      const byCategory = {};
      sessionConfig.menuItems.forEach(item => {
        const cat = item.category || item.dishType || 'Other';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(item);
      });

      // Format menu items
      Object.entries(byCategory).forEach(([category, items]) => {
        menuContext += `\n${category.toUpperCase()}:\n`;
        items.forEach(item => {
          const dietary = item.dietary?.join(', ') || '';
          const spice = item.spiceLevel ? `🌶️ ${item.spiceLevel}/5` : '';
          menuContext += `- ${item.name} (₹${item.price})${dietary ? ` - ${dietary}` : ''}${spice ? ` ${spice}` : ''}\n`;
          if (item.description) {
            menuContext += `  ${item.description}\n`;
          }
        });
      });

      menuContext += `\nUse this menu to help customers discover dishes and answer questions about what's available.`;
    }

    const basePrompts = {
      en: `You are a warm, friendly ordering assistant for The Coorg Food Company (CFC), specializing in authentic Coorg cuisine.

**Conversation Style:**
- Be natural and conversational - avoid scripted phrases or repetitive questions
- Remember what the customer has already told you and build on it
- If they've already shared their name, preferences, or order details, DON'T ask again
- Listen more, talk less - let the customer guide the conversation
- Use their previous statements to make relevant suggestions

**Your Goals:**
- Help customers discover delicious Coorg dishes
- Take accurate orders and smoothly guide them to checkout
- Share your knowledge about ingredients, spices, and preparation when asked
- Make thoughtful recommendations based on what you learn about their preferences

**Conversation Flow:**
- Start with a simple greeting and let them tell you what they want
- If they mention a dish, show them the details and help them add it to cart
- Build their order naturally - no need to ask "anything else?" after every item
- When they seem ready, guide them toward checkout
- IMPORTANT: Track the conversation context - if they already answered a question, reference it instead of asking again

**Critical Safety Note:**
When dietary restrictions or allergies come up, remind customers to inform our kitchen staff directly for safe food preparation.

**Voice Guidelines:**
- Speak numbers and prices naturally: "three ninety-nine rupees" not "₹399"
- Keep responses concise and conversational
- Match their energy and pace
${menuContext}

${configInstructions}`,

      hi: `आप द कुर्ग फूड कंपनी (CFC) के लिए एक मित्रवत और सहायक रेस्तरां ऑर्डरिंग सहायक हैं। आपकी भूमिका है:
- ग्राहकों को मेनू ब्राउज़ करने और व्यंजन खोजने में मदद करें
- पूछे जाने पर व्यंजनों का विस्तृत विवरण प्रदान करें
- ऑर्डर सटीक रूप से लें और प्रत्येक आइटम की पुष्टि करें
- पूरक आइटम और लोकप्रिय विकल्पों का सुझाव दें
- सामग्री, आहार प्रतिबंध और तैयारी समय के बारे में प्रश्नों का उत्तर दें
- आवाज इंटरैक्शन के लिए उपयुक्त गर्मजोशी भरा, संवादात्मक स्वर बनाए रखें

महत्वपूर्ण दिशानिर्देश:
- आइटम जोड़ने से पहले हमेशा ऑर्डर परिवर्तनों की पुष्टि करें
- कस्टमाइज़ेशन और पोर्शन साइज़ के बारे में विशिष्ट रहें
- उपलब्ध होने पर अनुमानित तैयारी समय प्रदान करें
- आवश्यकतानुसार स्पष्टीकरण प्रश्न पूछें
- महत्वपूर्ण: आहार प्रतिबंध या एलर्जी पर चर्चा करते समय, ग्राहकों को सुरक्षित भोजन तैयारी के लिए स्टाफ को सूचित करने की याद दिलाएं
- संख्याओं और कीमतों का शब्दों में अनुवाद करें
${menuContext}

${configInstructions}`,

      ta: `நீங்கள் த கூர்க் ஃபுட் கம்பெனி (CFC) இன் நட்பு மற்றும் உதவிகரமான உணவக ஆர்டர் உதவியாளர். உங்கள் பங்கு:
- வாடிக்கையாளர்களுக்கு மெனுவை உலாவ மற்றும் உணவுகளைக் கண்டறிய உதவுங்கள்
- கேட்கப்படும்போது உணவுகளின் விரிவான விளக்கங்களை வழங்கவும்
- ஆர்டர்களை துல்லியமாக எடுத்து ஒவ்வொரு பொருளையும் உறுதிப்படுத்தவும்
- நிரப்பு பொருட்கள் மற்றும் பிரபலமான தேர்வுகளை பரிந்துரைக்கவும்
- பொருட்கள், உணவு கட்டுப்பாடுகள் மற்றும் தயாரிப்பு நேரம் பற்றிய கேள்விகளுக்கு பதிலளிக்கவும்
- குரல் தொடர்புக்கு ஏற்ற அன்பான, உரையாடல் தொனியை பராமரிக்கவும்

முக்கிய வழிகாட்டுதல்கள்:
- பொருட்களைச் சேர்ப்பதற்கு முன் எப்போதும் ஆர்டர் மாற்றங்களை உறுதிப்படுத்தவும்
- தனிப்பயனாக்கங்கள் மற்றும் பகுதி அளவுகள் பற்றி குறிப்பிட்டவராக இருங்கள்
- கிடைக்கும்போது மதிப்பிடப்பட்ட தயாரிப்பு நேரத்தை வழங்கவும்
- தேவைப்பட்டால் தெளிவுபடுத்தும் கேள்விகளைக் கேளுங்கள்
- முக்கியமானது: உணவு கட்டுப்பாடுகள் அல்லது ஒவ்வாமைகள் பற்றி விவாதிக்கும் போது, பாதுகாப்பான உணவு தயாரிப்புக்காக ஊழியர்களுக்கு தெரிவிக்குமாறு வாடிக்கையாளர்களுக்கு நினைவூட்டவும்
- எண்கள் மற்றும் விலைகளை சொற்களில் மொழிபெயர்க்கவும்
${menuContext}

${configInstructions}`,

      te: `మీరు ద కూర్గ్ ఫుడ్ కంపెనీ (CFC) కోసం స్నేహపూర్వక మరియు సహాయక రెస్టారెంట్ ఆర్డరింగ్ అసిస్టెంట్. మీ పాత్ర:
- కస్టమర్లకు మెనుని బ్రౌజ్ చేయడంలో మరియు వంటకాలను కనుగొనడంలో సహాయపడండి
- అడిగినప్పుడు వంటకాల వివరణాత్మక వివరణలను అందించండి
- ఆర్డర్లను ఖచ్చితంగా తీసుకొని ప్రతి అంశాన్ని నిర్ధారించండి
- పూరక అంశాలు మరియు ప్రసిద్ధ ఎంపికలను సూచించండి
- పదార్థాలు, ఆహార పరిమితులు మరియు తయారీ సమయం గురించి ప్రశ్నలకు సమాధానం ఇవ్వండి
- వాయిస్ ఇంటరాక్షన్‌కు అనువైన వెచ్చని, సంభాషణాత్మక స్వరాన్ని కొనసాగించండి

ముఖ్యమైన మార్గదర్శకాలు:
- అంశాలను జోడించడానికి ముందు ఎల్లప్పుడూ ఆర్డర్ మార్పులను నిర్ధారించండి
- అనుకూలీకరణలు మరియు భాగ పరిమాణాల గురించి నిర్దిష్టంగా ఉండండి
- అందుబాటులో ఉన్నప్పుడు అంచనా తయారీ సమయాన్ని అందించండి
- అవసరమైతే స్పష్టీకరణ ప్రశ్నలను అడగండి
- క్లిష్టమైనది: ఆహార పరిమితులు లేదా అలర్జీల గురించి చర్చించేటప్పుడు, సురక్షితమైన ఆహార తయారీ కోసం సిబ్బందికి తెలియజేయమని కస్టమర్లకు గుర్తు చేయండి
- సంఖ్యలు మరియు ధరలను పదాలలో అనువదించండి
${menuContext}

${configInstructions}`,

      bn: `আপনি দ্য কুর্গ ফুড কোম্পানি (CFC) এর জন্য একজন বন্ধুত্বপূর্ণ এবং সহায়ক রেস্তোরাঁ অর্ডারিং সহায়ক। আপনার ভূমিকা:
- গ্রাহকদের মেনু ব্রাউজ করতে এবং খাবার আবিষ্কার করতে সাহায্য করুন
- জিজ্ঞাসা করা হলে খাবারের বিস্তারিত বর্ণনা প্রদান করুন
- সঠিকভাবে অর্ডার নিন এবং প্রতিটি আইটেম নিশ্চিত করুন
- পরিপূরক আইটেম এবং জনপ্রিয় পছন্দগুলি সুপারিশ করুন
- উপাদান, খাদ্য বিধিনিষেধ এবং প্রস্তুতির সময় সম্পর্কে প্রশ্নের উত্তর দিন
- ভয়েস ইন্টারঅ্যাকশনের জন্য উপযুক্ত উষ্ণ, কথোপকথন স্বর বজায় রাখুন

গুরুত্বপূর্ণ নির্দেশিকা:
- আইটেম যোগ করার আগে সর্বদা অর্ডার পরিবর্তন নিশ্চিত করুন
- কাস্টমাইজেশন এবং পরিবেশন আকার সম্পর্কে নির্দিষ্ট হন
- উপলব্ধ থাকলে আনুমানিক প্রস্তুতির সময় প্রদান করুন
- প্রয়োজনে স্পষ্টীকরণ প্রশ্ন জিজ্ঞাসা করুন
- সমালোচনামূলক: খাদ্য বিধিনিষেধ বা অ্যালার্জি নিয়ে আলোচনা করার সময়, নিরাপদ খাদ্য প্রস্তুতির জন্য কর্মীদের জানাতে গ্রাহকদের মনে করিয়ে দিন
- সংখ্যা এবং মূল্য শব্দে অনুবাদ করুন
${menuContext}

${configInstructions}`,
    };

    return basePrompts[language] || basePrompts.en;
  }

  /**
   * Get function declarations for restaurant operations
   */
  getRestaurantFunctionDeclarations() {
    return [
      // Customer Information
      {
        name: 'capture_customer_info',
        description: 'Store customer name and phone number when provided during the conversation',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Customer full name'
            },
            phone: {
              type: 'string',
              description: 'Phone number (10 digits)'
            }
          },
          required: ['name', 'phone']
        }
      },

      // Dish Display
      {
        name: 'show_dish_details',
        description: 'Search menu and display dish card with image and "Add to Cart" button when customer mentions a dish',
        parameters: {
          type: 'object',
          properties: {
            dishName: {
              type: 'string',
              description: 'Name of dish mentioned by customer (will be fuzzy-matched against menu)'
            }
          },
          required: ['dishName']
        }
      },

      // Cart Operations
      {
        name: 'add_to_cart_verbal',
        description: 'Add item to cart when customer verbally confirms after seeing dish card',
        parameters: {
          type: 'object',
          properties: {
            dishName: {
              type: 'string',
              description: 'Name of the dish to add'
            },
            quantity: {
              type: 'number',
              description: 'Quantity to add (default 1)'
            },
            customizations: {
              type: 'array',
              items: { type: 'string' },
              description: 'Special requests or modifications'
            }
          },
          required: ['dishName', 'quantity']
        }
      },

      {
        name: 'update_cart_item',
        description: 'Modify quantity or remove item from cart',
        parameters: {
          type: 'object',
          properties: {
            itemId: {
              type: 'string',
              description: 'ID of the cart item to update'
            },
            action: {
              type: 'string',
              enum: ['increase', 'decrease', 'remove'],
              description: 'Action to perform on the item'
            },
            newQuantity: {
              type: 'number',
              description: 'New quantity (for direct quantity update)'
            }
          },
          required: ['itemId', 'action']
        }
      },

      {
        name: 'show_cart_summary',
        description: 'Display current cart with all items and total',
        parameters: {
          type: 'object',
          properties: {}
        }
      },

      // Legacy support (deprecated - use new functions above)
      {
        name: 'add_to_order',
        description: '[DEPRECATED] Use add_to_cart_verbal instead',
        parameters: {
          type: 'object',
          properties: {
            dishName: { type: 'string' },
            quantity: { type: 'number' },
            customizations: { type: 'string' }
          },
          required: ['dishName', 'quantity']
        }
      },

      {
        name: 'update_order_summary',
        description: '[DEPRECATED] Use show_cart_summary instead',
        parameters: {
          type: 'object',
          properties: {
            items: { type: 'array' },
            total: { type: 'number' }
          },
          required: ['items', 'total']
        }
      }
    ];
  }

  /**
   * Setup WebSocket event handlers
   */
  setupWebSocketHandlers(session) {
    const { ws, id: sessionId } = session;

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleServerMessage(session, message);
      } catch (error) {
        console.error('[VertexAILive] Message handling error:', error);
      }
    });

    ws.on('close', (code, reason) => {
      console.log('[VertexAILive] WebSocket closed', {
        sessionId,
        code,
        reason: reason.toString()
      });
      session.isActive = false;
      this.activeSessions.delete(sessionId);
    });

    ws.on('error', (error) => {
      console.error('[VertexAILive] WebSocket error:', {
        sessionId,
        error: error.message
      });
    });
  }

  /**
   * Send setup message to initialize session
   */
  async sendSetup(session) {
    const modelPath = `projects/${this.projectId}/locations/${this.location}/publishers/google/models/${this.model}`;

    // Get generation config from LLM Config Service
    const llmConfig = this.llmConfigService.getConfig(session.id);
    const generationConfig = this.llmConfigService.getGenerationConfig(llmConfig);

    // Get voice configuration
    const voiceName = this.config.vertexAI.audio?.voiceName || 'Puck';

    const setupMessage = {
      setup: {
        model: modelPath,
        generationConfig: {
          ...generationConfig,
          responseModalities: this.config.vertexAI.audio?.responseModalities || ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName
              }
            }
          }
        },
        systemInstruction: {
          parts: [{ text: session.systemInstruction }]
        },
        tools: [{
          functionDeclarations: session.functionDeclarations
        }]
      }
    };

    console.log('[VertexAILive] Sending setup', {
      sessionId: session.id,
      voice: voiceName
    });
    session.ws.send(JSON.stringify(setupMessage));
  }

  /**
   * Handle messages from Vertex AI server
   */
  async handleServerMessage(session, message) {
    const { id: sessionId } = session;

    // Setup complete
    if (message.setupComplete) {
      session.isSetupComplete = true;
      session.isActive = true;
      console.log('[VertexAILive] Setup complete', { sessionId });

      if (session.setupResolve) {
        session.setupResolve();
        session.setupResolve = null;
      }
      return;
    }

    // Server content (audio response)
    if (message.serverContent) {
      const { modelTurn, turnComplete } = message.serverContent;

      if (modelTurn && modelTurn.parts) {
        for (const part of modelTurn.parts) {
          // Audio response
          if (part.inlineData && part.inlineData.mimeType === 'audio/pcm') {
            const audioData = Buffer.from(part.inlineData.data, 'base64');

            console.log('[VertexAILive] Received audio chunk', {
              sessionId,
              size: audioData.length
            });

            // Send audio to client
            if (session.onAudioChunk) {
              session.onAudioChunk(audioData);
            }
          }

          // Text response (for transcription display)
          if (part.text) {
            console.log('[VertexAILive] Received text', {
              sessionId,
              text: part.text.substring(0, 100)
            });

            // Send transcription to display
            if (session.tenantId) {
              await this.displayClient.sendTranscription(
                sessionId,
                part.text,
                'assistant',
                true
              );
            }
          }
        }
      }

      if (turnComplete) {
        console.log('[VertexAILive] Turn complete', { sessionId });
      }
    }

    // Tool call (function calls)
    if (message.toolCall && message.toolCall.functionCalls) {
      console.log('[VertexAILive] Tool call received', {
        sessionId,
        functionCount: message.toolCall.functionCalls.length
      });

      for (const functionCall of message.toolCall.functionCalls) {
        await this.handleFunctionCall(session, functionCall);
      }
    }
  }

  /**
   * Handle function call from model
   */
  async handleFunctionCall(session, functionCall) {
    const { name, args, id } = functionCall;

    console.log('[VertexAILive] Processing function call', {
      sessionId: session.id,
      function: name,
      args
    });

    let result = {};

    try {
      switch (name) {
        case 'capture_customer_info':
          session.orderState.customer = {
            name: args.name,
            phone: args.phone,
            confirmedAt: Date.now()
          };

          // Persist to Firebase
          await this.persistSessionState(session);

          result = {
            success: true,
            message: `Customer info saved: ${args.name}`,
            customer: session.orderState.customer
          };
          break;

        case 'show_dish_details':
          result = await this.showDishDetails(session, args.dishName);
          break;

        case 'add_to_cart_verbal':
          result = await this.addItemToCart(session, args, 'voice');
          break;

        case 'update_cart_item':
          result = await this.updateCartItem(session, args);
          break;

        case 'show_cart_summary':
          if (session.tenantId) {
            await this.displayClient.sendOrderSummary(
              session.id,
              session.orderState.cart
            );
          }
          result = {
            success: true,
            cart: session.orderState.cart,
            message: `Cart has ${session.orderState.cart.items.length} items, total ₹${session.orderState.cart.total}`
          };
          break;

        // Legacy support
        case 'add_to_order':
          result = await this.addItemToCart(session, {
            dishName: args.dishName,
            quantity: args.quantity,
            customizations: args.customizations ? [args.customizations] : []
          }, 'voice_legacy');
          break;

        case 'update_order_summary':
          session.currentOrder = args;
          if (session.tenantId) {
            await this.displayClient.sendOrderSummary(session.id, args);
          }
          result = { success: true, message: 'Order summary updated' };
          break;

        default:
          result = { error: 'Unknown function', functionName: name };
      }
    } catch (error) {
      console.error('[VertexAILive] Function call error:', error);
      result = {
        error: 'Function execution failed',
        message: error.message
      };
    }

    // Send function response back to Vertex AI
    const functionResponse = {
      toolResponse: {
        functionResponses: [{
          id,
          name,
          response: { result }
        }]
      }
    };

    session.ws.send(JSON.stringify(functionResponse));
  }

  /**
   * Send audio chunk to model
   */
  async sendAudio(sessionId, audioData) {
    const session = this.activeSessions.get(sessionId);

    if (!session || !session.isActive) {
      throw new Error(`Session ${sessionId} not active`);
    }

    const base64Audio = audioData.toString('base64');

    const audioMessage = {
      realtimeInput: {
        mediaChunks: [{
          mimeType: 'audio/pcm',
          data: base64Audio
        }]
      }
    };

    session.ws.send(JSON.stringify(audioMessage));
    session.lastActivityAt = Date.now();
  }

  /**
   * Set audio chunk callback
   */
  setAudioCallback(sessionId, callback) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.onAudioChunk = callback;
    }
  }

  /**
   * Get session
   */
  getSession(sessionId) {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Handle interruption (user spoke while AI was speaking)
   */
  async handleInterruption(sessionId) {
    const session = this.activeSessions.get(sessionId);

    if (!session || !session.isActive) {
      console.warn('[VertexAILive] Cannot handle interruption - session not active', { sessionId });
      return;
    }

    console.log('[VertexAILive] Handling interruption', { sessionId });

    // Note: Vertex AI Live API handles interruption automatically when new audio is sent
    // We just log it here for monitoring purposes
    // The model will stop generating audio when new user speech is detected
  }

  /**
   * Close session
   */
  async closeSession(sessionId) {
    const session = this.activeSessions.get(sessionId);

    if (session) {
      if (session.ws) {
        session.ws.close();
      }

      session.isActive = false;
      this.activeSessions.delete(sessionId);
      console.log('[VertexAILive] Session closed', { sessionId });
    }
  }

  /**
   * Get Display API client
   */
  getDisplayClient() {
    return this.displayClient;
  }

  // ==================== HELPER METHODS FOR ORDER MANAGEMENT ====================

  /**
   * Show dish details by searching menu
   */
  async showDishDetails(session, dishName) {
    try {
      // Get menu service reference (will be injected from routes)
      if (!session.menuService) {
        console.warn('[VertexAILive] Menu service not available');
        return {
          success: false,
          message: 'Menu service not initialized'
        };
      }

      // Search for dish in menu
      const dishes = await session.menuService.searchMenuItems(
        session.tenantId,
        dishName
      );

      if (dishes.length === 0) {
        return {
          success: false,
          message: `Dish "${dishName}" not found in menu`
        };
      }

      // Get best match (first result)
      const dish = dishes[0];

      // Cache dish for future reference
      session.orderState.dishCardCache.set(dish.id, dish);

      // Send dish card with "Add to Cart" button
      // Pass complete dish object so all fields are available
      if (session.tenantId) {
        await this.displayClient.sendDishCard(session.id, {
          ...dish,  // Include all dish fields from static menu (type, category, choices, rating, tag, etc.)
          dishId: dish.id,
          price: dish.variantPrice || dish.price,
          image: dish.imageUrl,
          imageUrl: dish.imageUrl,  // Ensure both field names are present
          dietary: dish.dietaryTags || dish.dietary || [],
          spiceLevel: dish.spiceLevel || 0,
          available: dish.available !== false,
          actions: [
            {
              id: 'add_to_cart',
              label: 'Add to Cart',
              type: 'primary'
            }
          ]
        });

        console.log('[VertexAILive] Sent dish card for:', dish.name, 'to session:', session.id);
      }

      return {
        success: true,
        dish: dish.name,
        price: dish.variantPrice || dish.price,
        message: `Showing ${dish.name}`
      };
    } catch (error) {
      console.error('[VertexAILive] Show dish details error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Add item to cart
   */
  async addItemToCart(session, itemData, source = 'voice') {
    try {
      const { dishName, quantity, customizations } = itemData;

      // Find dish in cache or search menu
      let dish = null;

      // Check cache first
      for (const [id, cachedDish] of session.orderState.dishCardCache) {
        if (cachedDish.name.toLowerCase() === dishName.toLowerCase()) {
          dish = cachedDish;
          break;
        }
      }

      // If not in cache, search menu
      if (!dish && session.menuService) {
        const results = await session.menuService.searchMenuItems(
          session.tenantId,
          dishName
        );
        dish = results[0];
      }

      if (!dish) {
        return {
          success: false,
          message: `Dish "${dishName}" not found`
        };
      }

      // Check for recent duplicate (within 5 seconds)
      const recentDuplicate = session.orderState.cart.items.find(
        item => item.dishId === dish.id &&
                Date.now() - item.addedAt < 5000
      );

      if (recentDuplicate) {
        // Increment quantity instead of duplicating
        recentDuplicate.quantity += (quantity || 1);
        recentDuplicate.itemTotal = recentDuplicate.price * recentDuplicate.quantity;

        console.log('[VertexAILive] Merged duplicate add', {
          dishId: dish.id,
          newQuantity: recentDuplicate.quantity
        });
      } else {
        // Add new cart item
        const cartItem = {
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          dishId: dish.id,
          dishName: dish.name,
          quantity: quantity || 1,
          price: dish.variantPrice || dish.price,
          itemTotal: (dish.variantPrice || dish.price) * (quantity || 1),
          customizations: customizations || [],
          addedAt: Date.now(),
          confirmedBy: source
        };

        session.orderState.cart.items.push(cartItem);
      }

      // Recalculate cart totals
      this.recalculateCartTotals(session);

      // Persist to Firebase
      await this.persistSessionState(session);

      // Send cart update to display
      if (session.tenantId) {
        // Send toast notification
        await this.displayClient.sendUpdate(session.id, {
          type: 'cart_item_added',
          data: {
            item: {
              dishName: dish.name,
              quantity: quantity || 1,
              itemTotal: (dish.variantPrice || dish.price) * (quantity || 1)
            },
            cart: session.orderState.cart
          }
        });

        // Also send full cart update so UI shows the order summary
        await this.displayClient.sendUpdate(session.id, {
          type: 'cart_updated',
          data: session.orderState.cart
        });
      }

      return {
        success: true,
        message: `Added ${quantity || 1}x ${dish.name}`,
        cartTotal: session.orderState.cart.total,
        itemCount: session.orderState.cart.items.length
      };
    } catch (error) {
      console.error('[VertexAILive] Add to cart error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Update cart item (quantity or remove)
   */
  async updateCartItem(session, updateData) {
    try {
      const { itemId, action, newQuantity } = updateData;

      const itemIndex = session.orderState.cart.items.findIndex(
        item => item.id === itemId
      );

      if (itemIndex === -1) {
        return {
          success: false,
          message: 'Item not found in cart'
        };
      }

      const item = session.orderState.cart.items[itemIndex];

      switch (action) {
        case 'increase':
          item.quantity += 1;
          item.itemTotal = item.price * item.quantity;
          break;

        case 'decrease':
          if (item.quantity > 1) {
            item.quantity -= 1;
            item.itemTotal = item.price * item.quantity;
          } else {
            // Remove if quantity would be 0
            session.orderState.cart.items.splice(itemIndex, 1);
          }
          break;

        case 'remove':
          session.orderState.cart.items.splice(itemIndex, 1);
          break;

        default:
          if (newQuantity !== undefined && newQuantity > 0) {
            item.quantity = newQuantity;
            item.itemTotal = item.price * item.quantity;
          }
      }

      // Recalculate totals
      this.recalculateCartTotals(session);

      // Persist
      await this.persistSessionState(session);

      // Send update
      if (session.tenantId) {
        await this.displayClient.sendUpdate(session.id, {
          type: 'cart_updated',
          data: {
            cart: session.orderState.cart,
            action
          }
        });
      }

      return {
        success: true,
        message: 'Cart updated',
        cart: session.orderState.cart
      };
    } catch (error) {
      console.error('[VertexAILive] Update cart error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Recalculate cart totals
   */
  recalculateCartTotals(session) {
    const cart = session.orderState.cart;

    cart.subtotal = cart.items.reduce((sum, item) => sum + item.itemTotal, 0);
    cart.tax = Math.round(cart.subtotal * 0.05);  // 5% tax
    cart.total = cart.subtotal + cart.tax;
    cart.lastUpdated = Date.now();

    console.log('[VertexAILive] Cart totals recalculated', {
      sessionId: session.id,
      items: cart.items.length,
      total: cart.total
    });
  }

  /**
   * Persist session state to Firebase
   */
  async persistSessionState(session) {
    try {
      if (!session.firebaseService) {
        console.warn('[VertexAILive] Firebase service not available for persistence');
        return;
      }

      const sessionData = {
        tenantId: session.tenantId,
        userId: session.userId,
        orderState: {
          customer: session.orderState.customer,
          cart: session.orderState.cart
        },
        conversation: session.conversation, // Save conversation history
        updatedAt: new Date().toISOString(),
        status: session.isActive ? 'active' : 'inactive'
      };

      await session.firebaseService.createDocument(
        'sessions',
        sessionData,
        session.id
      );

      console.log('[VertexAILive] Session persisted to Firebase', {
        sessionId: session.id,
        cartItems: session.orderState.cart.items.length
      });
    } catch (error) {
      console.error('[VertexAILive] Persist session error:', error);
      // Don't throw - persistence failure shouldn't break the session
    }
  }

  /**
   * Restore session state from Firebase
   */
  async restoreSessionState(sessionId, firebaseService) {
    try {
      const sessionData = await firebaseService.getDocument('sessions', sessionId);

      if (!sessionData) {
        console.log('[VertexAILive] No stored session found', { sessionId });
        return null;
      }

      console.log('[VertexAILive] Session restored from Firebase', {
        sessionId,
        cartItems: sessionData.orderState?.cart?.items?.length || 0,
        customer: sessionData.orderState?.customer?.name || 'N/A'
      });

      return sessionData;
    } catch (error) {
      console.error('[VertexAILive] Restore session error:', error);
      return null;
    }
  }

  /**
   * Inject service dependencies into session
   */
  setSessionServices(sessionId, menuService, firebaseService) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.menuService = menuService;
      session.firebaseService = firebaseService;
      console.log('[VertexAILive] Services injected into session', { sessionId });
    }
  }

  /**
   * Cleanup
   */
  async cleanup() {
    for (const [sessionId, session] of this.activeSessions) {
      if (session.ws) {
        session.ws.close();
      }
    }
    this.activeSessions.clear();
    console.log('[VertexAILive] Cleanup completed');
  }
}

export default VertexAILiveService;
