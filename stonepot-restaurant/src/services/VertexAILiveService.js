/**
 * Vertex AI Multimodal Live Service for Restaurant Ordering
 * Native audio-to-audio streaming with Gemini 2.0 Flash
 * Integrated with DisplayApiClient for multimodal UI updates
 */

import { GoogleAuth } from 'google-auth-library';
import WebSocket from 'ws';
import { DisplayApiClient } from './DisplayApiClient.js';
import { llmConfigService } from './LLMConfigService.js';
import { getCustomerService } from './CustomerService.js';
import { getCircleService } from './CircleService.js';
import { GoogleMapsService } from './GoogleMapsService.js';
import { DeliveryService } from './DeliveryService.js';
import { PaymentService } from './PaymentService.js';
import { MockPaymentService } from './MockPaymentService.js';
import { TaxService } from './TaxService.js';
import { FileSearchService } from './FileSearchService.ts';

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

    // Initialize File Search Service for scalable menu retrieval
    this.fileSearchService = new FileSearchService(config);

    // Initialize LLM Config Service
    this.llmConfigService = llmConfigService;

    // Initialize Customer Service
    this.customerService = getCustomerService(config);

    // Initialize Circle Service
    this.circleService = getCircleService(config);

    // Initialize Google Maps Service
    this.googleMapsService = new GoogleMapsService(config);

    // Initialize Delivery Service
    this.deliveryService = new DeliveryService(config, this.googleMapsService);

    // Initialize Payment Service (Mock or Real based on config)
    if (config.razorpay.useMock) {
      console.log('[VertexAILive] Using MOCK Payment Service for testing');
      this.paymentService = new MockPaymentService();
    } else {
      console.log('[VertexAILive] Using Real Razorpay Payment Service');
      this.paymentService = new PaymentService(config);
    }

    // Initialize Tax Service
    this.taxService = new TaxService(config.tax);
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
      const { tenantId, language = 'en', userId, customerContext } = sessionConfig;

      console.log('[VertexAILive] Creating session', { sessionId, tenantId, language, userId });

      // Initialize display session (non-critical - will auto-init on first update)
      if (tenantId) {
        try {
          await this.displayClient.initializeSession(sessionId, tenantId, 'restaurant');
        } catch (error) {
          console.warn('[VertexAILive] Display init failed (non-critical):', error.message);
        }
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

      // Pre-load menu context from File Search (if enabled)
      let menuContext = null;
      if (this.fileSearchService.isAvailableForTenant(tenantId)) {
        try {
          console.log('[VertexAILive] Pre-loading menu from File Search...');
          menuContext = await this.fileSearchService.getMenuContext(tenantId, language);
          console.log('[VertexAILive] File Search menu loaded:', menuContext.length, 'characters');
        } catch (error) {
          console.error('[VertexAILive] File Search failed, will use static menu fallback:', error.message);
          menuContext = null; // Will trigger fallback in buildRestaurantSystemPrompt
        }
      }

      // Build system instruction for restaurant ordering (with menu context)
      const systemInstruction = this.buildRestaurantSystemPrompt(language, {
        ...sessionConfig,
        sessionId,
        menuContext // Pass File Search results or null for fallback
      });

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
          customer: customerContext?.customer ? {
            name: customerContext.customer.name,
            phone: customerContext.customer.phone,
            email: customerContext.customer.email || null,
            deliveryAddress: customerContext.customer.deliveryAddress || null,
            confirmedAt: customerContext.customer.updatedAt || Date.now()
          } : {
            name: null,
            phone: null,
            email: null,
            deliveryAddress: null,
            confirmedAt: null
          },

          // Store order history for returning customers
          customerOrderHistory: customerContext?.orderHistory || [],

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

      // Log if returning customer was loaded
      if (customerContext) {
        console.log('[VertexAILive] Session created with returning customer context', {
          sessionId,
          customer: customerContext.customer.name,
          orderHistory: customerContext.orderHistory.length
        });
      }

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

      // Start keep-alive mechanism to prevent idle disconnections
      session.keepAliveInterval = setInterval(() => {
        if (session.isActive && session.ws && session.ws.readyState === 1) { // 1 = OPEN
          // Send empty media chunks to keep connection alive
          const keepAlive = {
            realtimeInput: {
              mediaChunks: []
            }
          };
          try {
            session.ws.send(JSON.stringify(keepAlive));
            console.log('[VertexAILive] Keep-alive sent', { sessionId });
          } catch (error) {
            console.error('[VertexAILive] Keep-alive send failed:', error);
          }
        }
      }, 25000); // Every 25 seconds

      console.log('[VertexAILive] Session ready with keep-alive', { sessionId });

      return session;
    } catch (error) {
      console.error('[VertexAILive] Session creation failed', { sessionId, error: error.message });
      throw error;
    }
  }

  /**
   * Build "Known Facts" summary from session order state
   * This prevents the LLM from re-asking information already collected
   */
  buildKnownFactsSummary(session) {
    const facts = [];
    const customer = session.orderState?.customer;
    const cart = session.orderState?.cart;
    const orderHistory = session.orderState?.customerOrderHistory || [];

    if (!customer && (!cart || !cart.items || cart.items.length === 0) && orderHistory.length === 0) {
      return ''; // No facts collected yet
    }

    facts.push('\n**KNOWN FACTS - DO NOT RE-ASK:**');

    // Customer information
    if (customer && customer.phone) {
      if (customer.name) {
        facts.push(`- Customer name: ${customer.name}`);
      }
      facts.push(`- Phone number: ${customer.phone}`);
      if (customer.email) {
        facts.push(`- Email: ${customer.email}`);
      }
      if (customer.deliveryAddress) {
        const addr = typeof customer.deliveryAddress === 'object'
          ? customer.deliveryAddress.formatted
          : customer.deliveryAddress;
        if (addr) {
          facts.push(`- Delivery address: ${addr}`);
        }
      }
      if (customer.dietaryRestrictions && customer.dietaryRestrictions.length > 0) {
        facts.push(`- Dietary restrictions: ${customer.dietaryRestrictions.join(', ')}`);
      }
      if (customer.allergies && customer.allergies.length > 0) {
        facts.push(`- Allergies: ${customer.allergies.join(', ')}`);
      }
      if (customer.spicePreference) {
        facts.push(`- Spice preference: ${customer.spicePreference}/5`);
      }
    }

    // Order history for returning customers
    if (orderHistory.length > 0) {
      facts.push(`\n**CUSTOMER ORDER HISTORY:**`);
      facts.push(`- This is a RETURNING CUSTOMER with ${orderHistory.length} previous order(s)`);
      facts.push(`- Recent orders:`);
      orderHistory.slice(0, 3).forEach((order, idx) => {
        const items = order.items?.slice(0, 2).map(i => i.dishName || i.name).join(', ') || 'items';
        const remaining = order.items && order.items.length > 2 ? ` +${order.items.length - 2} more` : '';
        const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'recent';
        facts.push(`  ${idx + 1}. ${items}${remaining} (₹${order.total}) - ${date}`);
      });
      facts.push(`- GREET THEM WARMLY and reference their order history`);
      facts.push(`- OFFER TO REORDER their favorite dishes`);
    }

    // Current cart
    if (cart && cart.items && cart.items.length > 0) {
      facts.push(`\n**CURRENT CART:**`);
      facts.push(`- ${cart.items.length} item(s) in cart`);
      cart.items.forEach((item, idx) => {
        facts.push(`  ${idx + 1}. ${item.name} x${item.quantity} (₹${item.price * item.quantity})`);
      });
      if (cart.subtotal) {
        facts.push(`- Cart subtotal: ₹${cart.subtotal}`);
      }
    }

    if (orderHistory.length > 0) {
      facts.push('\n**IMPORTANT**: This is a RETURNING CUSTOMER. Do NOT ask for their phone number again. Greet them by name and reference their order history to personalize the experience.');
    } else {
      facts.push('\n**IMPORTANT**: Use this information without asking again. Build on what you already know.');
    }

    return facts.join('\n');
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

    // Build menu context - prioritize File Search results over static menu
    let menuContext = '';

    if (sessionConfig.menuContext) {
      // Use File Search pre-loaded menu context (already formatted)
      console.log('[VertexAILive] Using File Search menu context');
      menuContext = '\n\n**MENU INFORMATION (from File Search):**\n' + sessionConfig.menuContext;
    } else if (sessionConfig.menuItems && sessionConfig.menuItems.length > 0) {
      // Fallback to static menu formatting
      console.log('[VertexAILive] Using static menu fallback');
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
    } else {
      console.warn('[VertexAILive] No menu context available - neither File Search nor static menu provided');
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
- If they mention a dish, show them the details and help them add it to their order
- Build their order naturally - no need to ask "anything else?" after every item
- When they seem ready, guide them toward checkout
- IMPORTANT: Track the conversation context - if they already answered a question, reference it instead of asking again

**Order Modifications:**
- When customer asks to remove/delete an item:
  1. First call get_cart_items (silently retrieves items with IDs)
  2. Find the matching item by name from the returned items
  3. Then immediately call update_cart_item with the correct itemId and action='remove'
  4. Do NOT ask for confirmation - execute directly
  5. Briefly confirm the removal (e.g., "Removed biryani from your order")
- When customer asks to change quantity, follow the same pattern: get_cart_items first, then update_cart_item
- If customer asks "what's in my order?" or wants to review, call show_cart_summary to display it visually
- After removing an item, ask if they want to add anything else

**Collaborative Ordering & Circles:**
- When customer wants to create a family/friends group, call create_circle with circleName and circleType ('family' or 'friends')
  Example: "Create a family circle called Sharma Family" → call create_circle with circleName="Sharma Family", circleType="family"
- To invite members to a circle, call invite_to_circle with circleId, inviteeName, and inviteePhone
- To start a group order with a circle, call start_collaborative_order with circleName
  Example: "Start a group order with Sharma Family" → call start_collaborative_order with circleName="Sharma Family"
- During collaborative orders, all add_item calls automatically sync to all participants in real-time
- When ready to finalize, call finalize_collaborative_order to complete the group order

**Collecting Customer Information:**
- When collecting phone numbers, ask the customer to say each digit clearly
- CRITICAL: Store phone numbers as strings with all 10 digits intact (e.g., "9876543210")
- After hearing the number, confirm it back digit-by-digit: "Let me confirm: nine, eight, seven, six..."
- NEVER convert phone numbers to numerical format or spoken words like "nine million"
- If collecting delivery address, ask for street, apartment/flat, landmark, and pincode separately
- For email, spell it out clearly and confirm the spelling

**Using Customer Order History:**
- When you call capture_customer_info with a phone number, the system automatically retrieves their past orders
- The function will return order history in the response, including items they've ordered before
- Use this information to:
  * Greet returning customers warmly: "Welcome back! I see you enjoyed our [dish] last time"
  * Make personalized recommendations based on their previous orders
  * Offer to reorder their favorite dishes: "Would you like to order the [dish] again?"
  * Build a rapport by remembering their preferences
- If it's a new customer (no order history), focus on helping them discover the menu
- ALWAYS use the order history context provided by capture_customer_info to personalize the experience

**Order Completion & Delivery Flow:**
- When the customer is ready to place their order, guide them through these steps naturally:

1. **Customer Information** (if not already collected):
   - Collect name and phone number using capture_customer_info
   - Ask for email if they want order updates (optional)

2. **Delivery Address Verification** (for delivery orders):
   - Ask the customer to describe their delivery address verbally
   - Include street/area, nearby landmark if possible, and pincode
   - Call verify_delivery_address with their address description
   - The system will check if delivery is available and show delivery fee/time
   - If address verification fails or delivery is not available:
     * Politely inform them we cannot deliver to that location
     * Offer pickup or dine-in as alternatives
     * Ask if they'd like to try a different address

3. **Order Type & Payment Preference**:
   - Ask if they want delivery, pickup, or dine-in
   - For delivery orders, verify address first (step 2)
   - Ask payment preference: "Would you like to pay online or cash on delivery/pickup?"
   - For any special instructions (gate code, floor number, etc.), collect them

4. **Order Finalization**:
   - Review the complete order with customer (items, delivery details, total)
   - Call finalize_order with orderType, paymentMethod, and any special instructions
   - For online payment:
     * System will create Razorpay order
     * Display will show payment interface for customer to complete
     * Confirm once payment is successful
   - For cash payment:
     * Order is confirmed immediately
     * Provide order ID and estimated delivery/ready time

**Handling Order Flow Issues:**
- If customer wants delivery but address cannot be verified, offer pickup/dine-in
- If payment fails, offer to retry or switch to cash payment
- Always provide order confirmation with order ID and estimated time
- If customer seems confused about next steps, guide them gently

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
        description: 'Store customer information when provided during the conversation. IMPORTANT: Phone numbers must be captured as strings with all digits intact (e.g., "9876543210" not "nine million...").',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Customer full name'
            },
            phone: {
              type: 'string',
              description: 'Phone number as a string of exactly 10 digits (e.g., "9876543210"). Never convert to numeric format or spoken words.'
            },
            email: {
              type: 'string',
              description: 'Customer email address (optional)'
            },
            deliveryAddress: {
              type: 'object',
              description: 'Delivery address details (optional)',
              properties: {
                street: { type: 'string' },
                apartment: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                pincode: { type: 'string' },
                landmark: { type: 'string' }
              }
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
        description: 'Immediately modify quantity or remove item from cart when customer requests it. Execute the action directly without asking for confirmation.',
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
              description: 'Action to perform: increase (add 1), decrease (subtract 1), remove (delete completely)'
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
        name: 'get_cart_items',
        description: 'Silently retrieve current cart items with their IDs. Use this before update_cart_item to get the correct itemId. Does not display anything to the customer.',
        parameters: {
          type: 'object',
          properties: {}
        }
      },

      {
        name: 'show_cart_summary',
        description: 'Display current cart with all items and total to the customer. Use only when customer explicitly asks to see their cart.',
        parameters: {
          type: 'object',
          properties: {}
        }
      },

      // Circle Management
      {
        name: 'create_circle',
        description: 'Create a family or friends circle for collaborative ordering. Use when customer wants to set up group ordering.',
        parameters: {
          type: 'object',
          properties: {
            circleName: {
              type: 'string',
              description: 'Name for the circle (e.g., "Sharma Family", "Office Friends")'
            },
            circleType: {
              type: 'string',
              enum: ['family', 'friends'],
              description: 'Type of circle: family or friends'
            }
          },
          required: ['circleName', 'circleType']
        }
      },

      {
        name: 'invite_to_circle',
        description: 'Invite someone to join a circle by their phone number and name.',
        parameters: {
          type: 'object',
          properties: {
            circleId: {
              type: 'string',
              description: 'ID of the circle to invite to'
            },
            inviteeName: {
              type: 'string',
              description: 'Name of the person being invited'
            },
            inviteePhone: {
              type: 'string',
              description: 'Phone number of the person being invited (10 digits)'
            }
          },
          required: ['circleId', 'inviteeName', 'inviteePhone']
        }
      },

      {
        name: 'start_collaborative_order',
        description: 'Start a collaborative group order for a circle. Returns PartyKit room URL for real-time ordering.',
        parameters: {
          type: 'object',
          properties: {
            circleId: {
              type: 'string',
              description: 'ID of the circle to start collaborative order for'
            }
          },
          required: ['circleId']
        }
      },

      {
        name: 'get_my_circles',
        description: 'Get list of circles the current customer belongs to.',
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
      },

      // Address & Delivery
      {
        name: 'verify_delivery_address',
        description: 'Verify and geocode delivery address from verbal description. Call this when customer provides delivery address. Returns coordinates and delivery eligibility.',
        parameters: {
          type: 'object',
          properties: {
            addressDescription: {
              type: 'string',
              description: 'Full address description from customer (e.g., "123 MG Road, near Big Bazaar, Koramangala, Bangalore")'
            },
            landmark: {
              type: 'string',
              description: 'Nearby landmark for easier location (optional)'
            },
            pincode: {
              type: 'string',
              description: 'Postal code/pincode (optional but recommended)'
            }
          },
          required: ['addressDescription']
        }
      },

      // Order Finalization & Payment
      {
        name: 'finalize_order',
        description: 'Complete the order and initiate payment process. Call this when customer is ready to pay and place their order. Requires cart and customer info to be already captured.',
        parameters: {
          type: 'object',
          properties: {
            orderType: {
              type: 'string',
              enum: ['delivery', 'pickup', 'dine-in'],
              description: 'Type of order: delivery (requires address), pickup (customer collects), or dine-in'
            },
            paymentMethod: {
              type: 'string',
              enum: ['online', 'cash'],
              description: 'Payment method: online (UPI/cards/wallets via Razorpay) or cash (COD/pay-at-counter)'
            },
            deliveryTime: {
              type: 'string',
              description: 'Preferred delivery/pickup time (e.g., "ASAP", "7:00 PM", "in 1 hour") - optional'
            },
            specialInstructions: {
              type: 'string',
              description: 'Any special instructions (e.g., "ring the bell", "contactless delivery", "extra spicy") - optional'
            }
          },
          required: ['orderType', 'paymentMethod']
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

      // Clear keep-alive interval
      if (session.keepAliveInterval) {
        clearInterval(session.keepAliveInterval);
        session.keepAliveInterval = null;
      }

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

            // Track assistant response in conversation history
            session.conversation.push({
              role: 'model',
              parts: [{ text: part.text }],
              timestamp: Date.now()
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
          // Check if customer already exists in session (returning customer)
          if (session.orderState.customer?.phone) {
            console.log('[VertexAILive] Customer already identified in session', {
              name: session.orderState.customer.name,
              phone: session.orderState.customer.phone
            });

            result = {
              success: true,
              message: `Customer already identified: ${session.orderState.customer.name}`,
              customer: session.orderState.customer,
              orderHistory: session.orderState.customerOrderHistory || [],
              orderHistoryCount: session.orderState.customerOrderHistory?.length || 0,
              isReturningCustomer: true
            };
            break;
          }

          // Store in session (new customer or first-time phone capture)
          session.orderState.customer = {
            name: args.name,
            phone: args.phone,
            email: args.email || null,
            deliveryAddress: args.deliveryAddress || null,
            confirmedAt: Date.now()
          };

          // CRITICAL FIX: Run Firestore operations in background to prevent Vertex AI timeout
          // These operations were blocking for 2-3 seconds, causing session to become inactive
          Promise.all([
            this.persistSessionState(session),
            this.customerService.upsertCustomer(
              session.tenantId,
              {
                phone: args.phone,
                name: args.name,
                email: args.email,
                deliveryAddress: args.deliveryAddress
              }
            )
          ]).then(async () => {
            console.log('[VertexAILive] Customer data persisted to Firestore');

            // OPTIMIZATION: Fetch saved addresses and send via WebSocket
            // This eliminates the need for frontend to make a separate HTTP request
            try {
              const customer = await this.customerService.getCustomer(
                session.tenantId,
                args.phone
              );

              const savedAddresses = customer?.savedAddresses || [];

              // CRITICAL FIX: Broadcast to CLIENT WebSocket (not Vertex AI WebSocket)
              if (session.clientWs && savedAddresses.length > 0) {
                session.clientWs.send(JSON.stringify({
                  type: 'customer_addresses',
                  addresses: savedAddresses,
                  timestamp: Date.now()
                }));
                console.log('[VertexAILive] Sent', savedAddresses.length, 'saved addresses to client');
              }
            } catch (error) {
              console.warn('[VertexAILive] Failed to fetch saved addresses:', error);
            }
          }).catch(error => {
            console.error('[VertexAILive] Background persist failed:', error);
          });

          // CRITICAL FIX: Broadcast customer update to CLIENT WebSocket (not Vertex AI WebSocket)
          if (session.clientWs) {
            try {
              session.clientWs.send(JSON.stringify({
                type: 'customer_update',
                customer: session.orderState.customer,
                timestamp: Date.now()
              }));
              console.log('[VertexAILive] Broadcasted customer update to client');
            } catch (wsError) {
              console.warn('[VertexAILive] Failed to broadcast customer update:', wsError.message);
            }
          }

          result = {
            success: true,
            message: `Customer info saved: ${args.name}.`,
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

        case 'get_cart_items':
          // Silently return cart items without displaying to user
          result = {
            success: true,
            cart: session.orderState.cart,
            items: session.orderState.cart.items.map(item => ({
              id: item.id,
              dishName: item.dishName,
              quantity: item.quantity,
              price: item.price,
              itemTotal: item.itemTotal
            })),
            message: session.orderState.cart.items.length > 0
              ? `Current cart items: ${session.orderState.cart.items.map(i => `${i.dishName} (id: ${i.id}, qty: ${i.quantity})`).join(', ')}`
              : 'Cart is empty'
          };
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

        // Circle Management
        case 'create_circle':
          if (!session.orderState.customer.phone) {
            result = {
              success: false,
              message: 'Please provide your contact information first to create a circle'
            };
            break;
          }

          try {
            const circleResult = await this.circleService.createCircle(
              session.tenantId,
              session.orderState.customer.phone,
              args.circleName,
              args.circleType
            );

            result = {
              success: true,
              circle: circleResult.circle,
              message: `Created ${args.circleType} circle "${args.circleName}". You can now invite members.`
            };
          } catch (error) {
            console.error('[VertexAILive] Error creating circle:', error);
            result = {
              success: false,
              message: 'Failed to create circle. Please try again.'
            };
          }
          break;

        case 'invite_to_circle':
          if (!session.orderState.customer.phone) {
            result = {
              success: false,
              message: 'Please provide your contact information first'
            };
            break;
          }

          try {
            const inviteResult = await this.circleService.inviteToCircle(
              args.circleId,
              session.orderState.customer.phone,
              args.inviteePhone,
              args.inviteeName
            );

            result = {
              success: inviteResult.success,
              circle: inviteResult.circle,
              message: inviteResult.success
                ? `${args.inviteeName} has been added to the circle`
                : inviteResult.message
            };
          } catch (error) {
            console.error('[VertexAILive] Error inviting to circle:', error);
            result = {
              success: false,
              message: 'Failed to add member. Please check the circle ID and try again.'
            };
          }
          break;

        case 'start_collaborative_order':
          if (!session.orderState.customer.phone) {
            result = {
              success: false,
              message: 'Please provide your contact information first'
            };
            break;
          }

          try {
            const collaborativeOrderResult = await this.circleService.startCollaborativeOrder(
              args.circleId,
              session.orderState.customer.phone,
              session.id
            );

            // Generate PartyKit room URL
            const partykitWsUrl = `${this.config.partykit.wsUrl}/parties/collaborative_order/${collaborativeOrderResult.collaborativeOrder.id}`;

            result = {
              success: true,
              collaborativeOrder: collaborativeOrderResult.collaborativeOrder,
              partykitRoomUrl: partykitWsUrl,
              message: `Started collaborative order for your circle. Share this session to let others join!`
            };

            // Store collaborative order ID in session
            session.orderState.collaborativeOrderId = collaborativeOrderResult.collaborativeOrder.id;
            await this.persistSessionState(session);
          } catch (error) {
            console.error('[VertexAILive] Error starting collaborative order:', error);
            result = {
              success: false,
              message: 'Failed to start collaborative order. Please check the circle ID and try again.'
            };
          }
          break;

        case 'get_my_circles':
          if (!session.orderState.customer.phone) {
            result = {
              success: false,
              message: 'Please provide your contact information first'
            };
            break;
          }

          try {
            const circles = await this.circleService.getCustomerCircles(
              session.tenantId,
              session.orderState.customer.phone
            );

            result = {
              success: true,
              circles,
              message: circles.length > 0
                ? `You are in ${circles.length} circle(s): ${circles.map(c => c.name).join(', ')}`
                : 'You are not in any circles yet. Would you like to create one?'
            };
          } catch (error) {
            console.error('[VertexAILive] Error getting circles:', error);
            result = {
              success: false,
              message: 'Failed to retrieve circles'
            };
          }
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

        case 'verify_delivery_address':
          try {
            // Build full address string
            let addressString = args.addressDescription;
            if (args.landmark) {
              addressString += `, Near ${args.landmark}`;
            }
            if (args.pincode) {
              addressString += `, ${args.pincode}`;
            }

            console.log('[VertexAILive] Verifying delivery address:', addressString);

            // Geocode the address
            const geocodeResult = await this.googleMapsService.geocodeAddress(addressString);

            // Extract address components
            const pincode = this.googleMapsService.extractPincode(geocodeResult.addressComponents);
            const city = this.googleMapsService.extractCity(geocodeResult.addressComponents);
            const state = this.googleMapsService.extractState(geocodeResult.addressComponents);

            // Store verified address in session
            session.orderState.deliveryAddress = {
              formatted: geocodeResult.formattedAddress,
              coordinates: {
                lat: geocodeResult.lat,
                lng: geocodeResult.lng
              },
              placeId: geocodeResult.placeId,
              pincode,
              city,
              state,
              verifiedAt: Date.now()
            };

            await this.persistSessionState(session);

            // Send address verification display update
            if (session.tenantId) {
              await this.displayClient.sendUpdate(session.id, {
                type: 'address_verification',
                data: {
                  address: geocodeResult.formattedAddress,
                  coordinates: {
                    lat: geocodeResult.lat,
                    lng: geocodeResult.lng
                  },
                  verified: true,
                  deliverable: true,
                  message: `Address verified: ${geocodeResult.formattedAddress}. We'll arrange delivery through our partner.`
                }
              });
            }

            result = {
              success: true,
              eligible: true,
              address: {
                formatted: geocodeResult.formattedAddress,
                coordinates: { lat: geocodeResult.lat, lng: geocodeResult.lng },
                pincode,
                city,
                state
              },
              message: `Address verified: ${geocodeResult.formattedAddress}. Delivery will be arranged through Porter.`
            };
          } catch (error) {
            console.error('[VertexAILive] Address verification error:', error);

            // Send address verification display update for error case
            if (session.tenantId) {
              await this.displayClient.sendUpdate(session.id, {
                type: 'address_verification',
                data: {
                  address: args.addressDescription || 'Address not found',
                  verified: false,
                  deliverable: false,
                  message: 'Unable to verify address. Please provide more details like pincode, landmark, or nearby area.'
                }
              });
            }

            result = {
              success: false,
              eligible: false,
              message: 'Unable to verify address. Please provide more details like pincode, landmark, or nearby area.',
              error: error.message
            };
          }
          break;

        case 'finalize_order':
          try {
            // Validate cart
            if (!session.orderState.cart.items || session.orderState.cart.items.length === 0) {
              result = {
                success: false,
                message: 'Cart is empty. Please add items before placing order.'
              };
              break;
            }

            // Validate customer info
            if (!session.orderState.customer || !session.orderState.customer.name || !session.orderState.customer.phone) {
              result = {
                success: false,
                message: 'Please provide your name and phone number first.'
              };
              break;
            }

            // Validate delivery address for delivery orders
            if (args.orderType === 'delivery' && !session.orderState.deliveryAddress) {
              result = {
                success: false,
                message: 'Please provide and verify your delivery address first.'
              };
              break;
            }

            console.log('[VertexAILive] Finalizing order:', {
              orderType: args.orderType,
              paymentMethod: args.paymentMethod,
              items: session.orderState.cart.items.length
            });

            // Calculate totals using TaxService
            const subtotal = session.orderState.cart.subtotal || 0;
            const deliveryFee = args.orderType === 'delivery' ? (session.orderState.deliveryFee || 0) : 0;

            // Calculate GST using TaxService
            const taxCalculation = this.taxService.calculateOrderTax(subtotal, deliveryFee, args.orderType);
            const tax = taxCalculation.gstAmount;
            const total = taxCalculation.totalWithTax;

            // Prepare order data
            const orderData = {
              orderId: `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
              sessionId: session.id,
              customer: {
                name: session.orderState.customer.name,
                phone: session.orderState.customer.phone,
                email: session.orderState.customer.email || null
              },
              cart: {
                items: session.orderState.cart.items,
                subtotal,
                tax,
                deliveryFee,
                total
              },
              orderType: args.orderType,
              paymentMethod: args.paymentMethod,
              deliveryAddress: args.orderType === 'delivery' ? session.orderState.deliveryAddress : null,
              deliveryTime: args.deliveryTime || null,
              specialInstructions: args.specialInstructions || null,
              estimatedDeliveryTime: args.orderType === 'delivery' ? session.orderState.estimatedDeliveryTime : null,
              status: args.paymentMethod === 'online' ? 'pending_payment' : 'confirmed',
              createdAt: Date.now()
            };

            // Create order in Firebase
            let savedOrder;
            try {
              savedOrder = await this.customerService.createOrder(
                session.tenantId,
                session.orderState.customer.phone,
                orderData
              );
              console.log('[VertexAILive] Order saved to Firebase:', savedOrder.orderId);
            } catch (error) {
              console.error('[VertexAILive] Error saving order to Firebase:', error);
              // Continue with order even if Firebase save fails
            }

            // Store order in session
            session.orderState.finalizedOrder = orderData;
            await this.persistSessionState(session);

            // Send checkout summary display
            if (session.tenantId) {
              await this.displayClient.sendUpdate(session.id, {
                type: 'checkout_summary',
                data: {
                  orderId: orderData.orderId,
                  items: orderData.cart.items,
                  subtotal: orderData.cart.subtotal,
                  deliveryFee: orderData.cart.deliveryFee,
                  tax: orderData.cart.tax,
                  total: orderData.cart.total,
                  orderType: orderData.orderType,
                  paymentMethod: orderData.paymentMethod,
                  deliveryAddress: orderData.deliveryAddress?.formatted,
                  estimatedTime: orderData.estimatedDeliveryTime?.timeRange
                }
              });
            }

            // If online payment, create Razorpay order
            if (args.paymentMethod === 'online') {
              try {
                const razorpayOrder = await this.paymentService.createPaymentOrder({
                  amount: total,
                  orderId: orderData.orderId,
                  customer: orderData.customer,
                  currency: 'INR'
                });

                session.orderState.razorpayOrderId = razorpayOrder.id;
                await this.persistSessionState(session);

                // Send payment pending display
                if (session.tenantId) {
                  await this.displayClient.sendUpdate(session.id, {
                    type: 'payment_pending',
                    data: {
                      orderId: orderData.orderId,
                      razorpayOrderId: razorpayOrder.id,
                      amount: total,
                      currency: 'INR',
                      customer: orderData.customer
                    }
                  });
                }

                result = {
                  success: true,
                  order: orderData,
                  razorpayOrder: {
                    id: razorpayOrder.id,
                    amount: razorpayOrder.amount,
                    currency: razorpayOrder.currency
                  },
                  message: `Great! Your order is ready for checkout. Please complete the payment of ₹${total}.`,
                  nextStep: 'payment'
                };
              } catch (error) {
                console.error('[VertexAILive] Razorpay order creation error:', error);
                result = {
                  success: false,
                  message: 'Failed to initiate payment. Please try again or choose cash payment.',
                  error: error.message
                };
              }
            } else {
              // Cash payment - order is confirmed immediately
              // Generate invoice/bill
              const invoice = this.taxService.generateInvoice(orderData);
              const billText = this.taxService.formatInvoiceText(invoice);

              // Log the bill (in production, this would be sent to a printer or PDF generator)
              console.log('\n' + '='.repeat(50));
              console.log('BILL GENERATED:');
              console.log('='.repeat(50));
              console.log(billText);
              console.log('='.repeat(50) + '\n');

              if (session.tenantId) {
                await this.displayClient.sendUpdate(session.id, {
                  type: 'order_confirmed',
                  data: {
                    orderId: orderData.orderId,
                    orderType: orderData.orderType,
                    paymentMethod: 'cash',
                    total: total,
                    estimatedTime: orderData.estimatedDeliveryTime?.timeRange || '30-40 mins',
                    message: 'Your order has been confirmed!',
                    invoice: invoice, // Include invoice data
                    billText: billText // Include formatted bill text
                  }
                });
              }

              result = {
                success: true,
                order: orderData,
                invoice: invoice,
                message: `Thank you for your order! Total is ₹${total} including GST. ${args.orderType === 'delivery' ? `Your food will be delivered in ${orderData.estimatedDeliveryTime?.timeRange || '30 to 40 minutes'}` : 'Please collect from the counter'}. You can pay cash on ${args.orderType === 'delivery' ? 'delivery' : 'pickup'}.`,
                nextStep: 'confirmed'
              };
            }
          } catch (error) {
            console.error('[VertexAILive] Order finalization error:', error);
            result = {
              success: false,
              message: 'Failed to finalize order. Please try again.',
              error: error.message
            };
          }
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

    // Build Known Facts summary to prevent repetition
    const knownFacts = this.buildKnownFactsSummary(session);

    // Inject Known Facts into result if there are any facts to share
    if (knownFacts) {
      // Add context reminder to the result
      if (typeof result === 'object' && result !== null) {
        result._context = knownFacts;
      }
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
    let session = this.activeSessions.get(sessionId);

    // DISABLED: Auto-reconnection was causing infinite error loops
    // If session is inactive, fail immediately and let frontend handle it
    if (!session || !session.isActive) {
      console.warn('[VertexAILive] Session not active - rejecting audio', {
        sessionId,
        sessionExists: !!session,
        isActive: session?.isActive
      });
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
      // Clear keep-alive interval
      if (session.keepAliveInterval) {
        clearInterval(session.keepAliveInterval);
        session.keepAliveInterval = null;
      }

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
