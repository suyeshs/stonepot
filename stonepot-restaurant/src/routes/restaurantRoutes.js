/**
 * Restaurant ordering routes
 * Handles voice session creation and audio streaming
 */

import express from 'express';
import WebSocket from 'ws';
import multer from 'multer';
import { VertexAILiveService } from '../services/VertexAILiveService.js';
import Guardrails from '../services/Guardrails.js';
import { getFirebaseService } from '../services/FirebaseService.js';
import { CloudflareImageService } from '../services/CloudflareImageService.js';
import { MenuManagementService } from '../services/MenuManagementService.js';
import { ExcelParserService } from '../services/ExcelParserService.js';
import { config } from '../config/index.js';

const router = express.Router();

// Setup multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Initialize Vertex AI Live Service
const vertexAIService = new VertexAILiveService(config);

// Initialize Guardrails Service
const guardrailsService = new Guardrails(config.guardrails);
await guardrailsService.initialize();

// Initialize Firebase Service
const firebaseService = getFirebaseService(config);
await firebaseService.initialize();

// Initialize Cloudflare Images Service
const cloudflareImageService = new CloudflareImageService(config);

// Initialize Menu Management Service
const menuService = new MenuManagementService(firebaseService, cloudflareImageService);

// Initialize Excel Parser Service
const excelParserService = new ExcelParserService();

/**
 * Create a new ordering session
 * POST /api/restaurant/sessions
 */
router.post('/sessions', async (req, res) => {
  try {
    const { tenantId, userId, language = 'en' } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('[RestaurantRoutes] Creating session', { sessionId, tenantId, userId, language });

    // Initialize display session with theme worker (no Vertex AI for now)
    const displayClient = vertexAIService.getDisplayClient();

    // Initialize display session on theme worker (non-critical - will auto-init on first update)
    try {
      await displayClient.initializeSession(sessionId, tenantId, 'restaurant');
    } catch (error) {
      console.warn('[RestaurantRoutes] Display init failed (non-critical):', error.message);
    }

    // Get the display UI URL
    const uiUrl = displayClient.getConversationUIUrl(sessionId, tenantId, 'restaurant');

    console.log('[RestaurantRoutes] Session created successfully', { sessionId, uiUrl });

    res.json({
      success: true,
      sessionId,
      displayUrl: uiUrl,
      websocketUrl: `/ws/restaurant/${sessionId}`,
      tenantId,
      language
    });
  } catch (error) {
    console.error('[RestaurantRoutes] Session creation failed:', error);
    res.status(500).json({
      error: 'Failed to create session',
      message: error.message
    });
  }
});

/**
 * Get session status
 * GET /api/restaurant/sessions/:sessionId
 */
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = vertexAIService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      sessionId: session.id,
      tenantId: session.tenantId,
      isActive: session.isActive,
      createdAt: session.createdAt,
      currentOrder: session.currentOrder
    });
  } catch (error) {
    console.error('[RestaurantRoutes] Failed to get session:', error);
    res.status(500).json({
      error: 'Failed to get session',
      message: error.message
    });
  }
});

/**
 * Close a session
 * DELETE /api/restaurant/sessions/:sessionId
 */
router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    await vertexAIService.closeSession(sessionId);

    res.json({
      success: true,
      message: 'Session closed'
    });
  } catch (error) {
    console.error('[RestaurantRoutes] Failed to close session:', error);
    res.status(500).json({
      error: 'Failed to close session',
      message: error.message
    });
  }
});

/**
 * Send a display update manually (for testing)
 * POST /api/restaurant/sessions/:sessionId/display
 */
router.post('/sessions/:sessionId/display', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { type, data } = req.body;

    const displayClient = vertexAIService.getDisplayClient();

    let result;
    switch (type) {
      case 'dish_card':
        result = await displayClient.sendDishCard(sessionId, data);
        break;
      case 'menu_section':
        result = await displayClient.sendMenuSection(sessionId, data);
        break;
      case 'order_summary':
        result = await displayClient.sendOrderSummary(sessionId, data);
        break;
      case 'order_update':
        result = await displayClient.sendOrderUpdate(sessionId, data);
        break;
      case 'confirmation':
        result = await displayClient.sendConfirmation(sessionId, data);
        break;
      default:
        result = await displayClient.sendUpdate(sessionId, { type, data });
    }

    res.json(result);
  } catch (error) {
    console.error('[RestaurantRoutes] Failed to send display update:', error);
    res.status(500).json({
      error: 'Failed to send display update',
      message: error.message
    });
  }
});

/**
 * Handle user actions from display (button clicks)
 * POST /api/restaurant/sessions/:sessionId/actions
 */
router.post('/sessions/:sessionId/actions', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { type, data } = req.body;

    console.log('[RestaurantRoutes] Processing user action', {
      sessionId,
      type,
      data
    });

    const session = vertexAIService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    let result;

    switch (type) {
      case 'add_to_cart':
        // Add item via UI button
        result = await vertexAIService.addItemToCart(session, {
          dishName: data.dishName,
          quantity: data.quantity || 1,
          customizations: data.customizations || []
        }, 'ui');

        // Notify Vertex AI of UI action
        const addNotification = {
          toolResponse: {
            functionResponses: [{
              name: 'ui_action_notification',
              response: {
                action: 'add_to_cart',
                dish: data.dishName,
                quantity: data.quantity || 1,
                source: 'ui_button',
                message: `Customer added ${data.dishName} via UI`
              }
            }]
          }
        };
        session.ws.send(JSON.stringify(addNotification));
        break;

      case 'remove_from_cart':
        result = await vertexAIService.updateCartItem(session, {
          itemId: data.itemId,
          action: 'remove'
        });

        // Notify AI
        const removeNotification = {
          toolResponse: {
            functionResponses: [{
              name: 'ui_action_notification',
              response: {
                action: 'remove_from_cart',
                itemId: data.itemId,
                source: 'ui_button'
              }
            }]
          }
        };
        session.ws.send(JSON.stringify(removeNotification));
        break;

      case 'update_quantity':
        result = await vertexAIService.updateCartItem(session, {
          itemId: data.itemId,
          action: data.action,  // 'increase' or 'decrease'
          newQuantity: data.newQuantity
        });
        break;

      default:
        return res.status(400).json({ error: 'Unknown action type' });
    }

    res.json(result);
  } catch (error) {
    console.error('[RestaurantRoutes] Action failed:', error);
    res.status(500).json({
      error: 'Failed to process action',
      message: error.message
    });
  }
});

// ==================== RESTAURANT PROFILE ENDPOINTS ====================

/**
 * Create restaurant profile
 * POST /api/restaurant/profile
 */
router.post('/profile', async (req, res) => {
  try {
    const profileData = req.body;

    if (!profileData.tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    if (!profileData.name) {
      return res.status(400).json({ error: 'Restaurant name is required' });
    }

    console.log('[RestaurantRoutes] Creating restaurant profile', { tenantId: profileData.tenantId });

    const profile = await firebaseService.createRestaurantProfile(profileData);

    res.json({
      success: true,
      profile
    });
  } catch (error) {
    console.error('[RestaurantRoutes] Failed to create profile:', error);
    res.status(500).json({
      error: 'Failed to create restaurant profile',
      message: error.message
    });
  }
});

/**
 * Get restaurant profile
 * GET /api/restaurant/:tenantId/profile
 */
router.get('/:tenantId/profile', async (req, res) => {
  try {
    const { tenantId } = req.params;

    console.log('[RestaurantRoutes] Getting restaurant profile', { tenantId });

    const profile = await firebaseService.getRestaurantProfile(tenantId);

    if (!profile) {
      return res.status(404).json({ error: 'Restaurant profile not found' });
    }

    res.json({
      success: true,
      profile
    });
  } catch (error) {
    console.error('[RestaurantRoutes] Failed to get profile:', error);
    res.status(500).json({
      error: 'Failed to get restaurant profile',
      message: error.message
    });
  }
});

/**
 * Update restaurant profile
 * PUT /api/restaurant/:tenantId/profile
 */
router.put('/:tenantId/profile', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const updates = req.body;

    console.log('[RestaurantRoutes] Updating restaurant profile', { tenantId });

    const profile = await firebaseService.updateRestaurantProfile(tenantId, updates);

    res.json({
      success: true,
      profile
    });
  } catch (error) {
    console.error('[RestaurantRoutes] Failed to update profile:', error);
    res.status(500).json({
      error: 'Failed to update restaurant profile',
      message: error.message
    });
  }
});

// ==================== MENU MANAGEMENT ENDPOINTS ====================

/**
 * Create menu item with optional image
 * POST /api/restaurant/:tenantId/menu/items
 */
router.post('/:tenantId/menu/items', upload.single('image'), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const itemData = req.body;
    const imageBuffer = req.file?.buffer;

    console.log('[RestaurantRoutes] Creating menu item', {
      tenantId,
      itemName: itemData.name,
      hasImage: !!imageBuffer
    });

    // Parse JSON fields if they're strings
    if (typeof itemData.allergens === 'string') {
      itemData.allergens = JSON.parse(itemData.allergens);
    }
    if (typeof itemData.dietaryTags === 'string') {
      itemData.dietaryTags = JSON.parse(itemData.dietaryTags);
    }

    const item = await menuService.createMenuItem(tenantId, itemData, imageBuffer);

    res.json({
      success: true,
      item
    });
  } catch (error) {
    console.error('[RestaurantRoutes] Failed to create menu item:', error);
    res.status(500).json({
      error: 'Failed to create menu item',
      message: error.message
    });
  }
});

/**
 * List menu items with optional filters
 * GET /api/restaurant/:tenantId/menu/items
 */
router.get('/:tenantId/menu/items', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { category, available, search } = req.query;

    console.log('[RestaurantRoutes] Listing menu items', { tenantId, category, available, search });

    let items;

    if (search) {
      items = await menuService.searchMenuItems(tenantId, search);
    } else {
      const filters = {};
      if (category) filters.category = category;
      if (available !== undefined) filters.available = available === 'true';

      items = await menuService.listMenuItems(tenantId, filters);
    }

    res.json({
      success: true,
      items,
      count: items.length
    });
  } catch (error) {
    console.error('[RestaurantRoutes] Failed to list menu items:', error);
    res.status(500).json({
      error: 'Failed to list menu items',
      message: error.message
    });
  }
});

/**
 * Get single menu item
 * GET /api/restaurant/:tenantId/menu/items/:itemId
 */
router.get('/:tenantId/menu/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    console.log('[RestaurantRoutes] Getting menu item', { itemId });

    const item = await menuService.getMenuItem(itemId);

    if (!item) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    res.json({
      success: true,
      item
    });
  } catch (error) {
    console.error('[RestaurantRoutes] Failed to get menu item:', error);
    res.status(500).json({
      error: 'Failed to get menu item',
      message: error.message
    });
  }
});

/**
 * Update menu item with optional new image
 * PUT /api/restaurant/:tenantId/menu/items/:itemId
 */
router.put('/:tenantId/menu/items/:itemId', upload.single('image'), async (req, res) => {
  try {
    const { itemId } = req.params;
    const updates = req.body;
    const newImageBuffer = req.file?.buffer;

    console.log('[RestaurantRoutes] Updating menu item', {
      itemId,
      hasNewImage: !!newImageBuffer
    });

    // Parse JSON fields if they're strings
    if (typeof updates.allergens === 'string') {
      updates.allergens = JSON.parse(updates.allergens);
    }
    if (typeof updates.dietaryTags === 'string') {
      updates.dietaryTags = JSON.parse(updates.dietaryTags);
    }

    const item = await menuService.updateMenuItem(itemId, updates, newImageBuffer);

    res.json({
      success: true,
      item
    });
  } catch (error) {
    console.error('[RestaurantRoutes] Failed to update menu item:', error);
    res.status(500).json({
      error: 'Failed to update menu item',
      message: error.message
    });
  }
});

/**
 * Delete menu item
 * DELETE /api/restaurant/:tenantId/menu/items/:itemId
 */
router.delete('/:tenantId/menu/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    console.log('[RestaurantRoutes] Deleting menu item', { itemId });

    const result = await menuService.deleteMenuItem(itemId);

    res.json(result);
  } catch (error) {
    console.error('[RestaurantRoutes] Failed to delete menu item:', error);
    res.status(500).json({
      error: 'Failed to delete menu item',
      message: error.message
    });
  }
});

/**
 * Import menu from Excel file
 * POST /api/restaurant/:tenantId/menu/import
 */
router.post('/:tenantId/menu/import', upload.single('file'), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const excelBuffer = req.file?.buffer;

    if (!excelBuffer) {
      return res.status(400).json({ error: 'Excel file is required' });
    }

    console.log('[RestaurantRoutes] Importing menu from Excel', {
      tenantId,
      fileSize: excelBuffer.length
    });

    const result = await menuService.importFromExcel(tenantId, excelBuffer);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[RestaurantRoutes] Failed to import menu:', error);
    res.status(500).json({
      error: 'Failed to import menu',
      message: error.message
    });
  }
});

/**
 * Get menu grouped by category
 * GET /api/restaurant/:tenantId/menu/by-category
 */
router.get('/:tenantId/menu/by-category', async (req, res) => {
  try {
    const { tenantId } = req.params;

    console.log('[RestaurantRoutes] Getting menu by category', { tenantId });

    const menuByCategory = await menuService.getMenuByCategory(tenantId);

    res.json({
      success: true,
      menu: menuByCategory
    });
  } catch (error) {
    console.error('[RestaurantRoutes] Failed to get menu by category:', error);
    res.status(500).json({
      error: 'Failed to get menu by category',
      message: error.message
    });
  }
});

/**
 * Get menu statistics
 * GET /api/restaurant/:tenantId/menu/stats
 */
router.get('/:tenantId/menu/stats', async (req, res) => {
  try {
    const { tenantId } = req.params;

    console.log('[RestaurantRoutes] Getting menu stats', { tenantId });

    const stats = await menuService.getMenuStats(tenantId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('[RestaurantRoutes] Failed to get menu stats:', error);
    res.status(500).json({
      error: 'Failed to get menu stats',
      message: error.message
    });
  }
});

// ==================== IMAGE UPLOAD ENDPOINTS ====================

/**
 * Upload dish image
 * POST /api/restaurant/:tenantId/images/upload
 */
router.post('/:tenantId/images/upload', upload.single('image'), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const imageBuffer = req.file?.buffer;
    const metadata = {
      filename: req.file?.originalname,
      contentType: req.file?.mimetype,
      tenantId
    };

    if (!imageBuffer) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    console.log('[RestaurantRoutes] Uploading image', {
      tenantId,
      filename: metadata.filename,
      size: imageBuffer.length
    });

    const result = await cloudflareImageService.uploadImage(imageBuffer, metadata);

    res.json({
      success: true,
      image: result
    });
  } catch (error) {
    console.error('[RestaurantRoutes] Failed to upload image:', error);
    res.status(500).json({
      error: 'Failed to upload image',
      message: error.message
    });
  }
});

/**
 * Delete dish image
 * DELETE /api/restaurant/:tenantId/images/:imageId
 */
router.delete('/:tenantId/images/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;

    console.log('[RestaurantRoutes] Deleting image', { imageId });

    const result = await cloudflareImageService.deleteImage(imageId);

    res.json(result);
  } catch (error) {
    console.error('[RestaurantRoutes] Failed to delete image:', error);
    res.status(500).json({
      error: 'Failed to delete image',
      message: error.message
    });
  }
});

/**
 * Download Excel template for menu import
 * GET /api/restaurant/menu/template
 */
router.get('/menu/template', async (req, res) => {
  try {
    console.log('[RestaurantRoutes] Generating Excel template');

    const templateBuffer = excelParserService.generateTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=menu-import-template.xlsx');
    res.send(templateBuffer);
  } catch (error) {
    console.error('[RestaurantRoutes] Failed to generate template:', error);
    res.status(500).json({
      error: 'Failed to generate template',
      message: error.message
    });
  }
});

/**
 * Provision restaurant from admin app onboarding
 * POST /api/restaurant/tenants/provision
 */
router.post('/tenants/provision', async (req, res) => {
  try {
    const {
      tenantId,
      companyName,
      restaurantProfile,  // { cuisine, address, phone, hours, about }
      aiConfig,           // { voiceName, tone, responseLength, allowedLanguages }
      menuItems,          // array of menu items from manual entry or Excel
      brandIdentity,      // { primaryColor, logo, companyName, tagline }
      locations           // array of restaurant locations (optional for now)
    } = req.body;

    // Validate required fields
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }
    if (!companyName) {
      return res.status(400).json({ error: 'companyName is required' });
    }
    if (!restaurantProfile) {
      return res.status(400).json({ error: 'restaurantProfile is required' });
    }

    console.log('[RestaurantRoutes] Provisioning restaurant from admin app', {
      tenantId,
      companyName,
      hasMenu: menuItems && menuItems.length > 0,
      menuItemCount: menuItems?.length || 0
    });

    // 1. Create organization/restaurant profile in Firestore
    const organizationData = {
      tenantId,
      name: companyName,
      cuisine: restaurantProfile.cuisine,
      address: restaurantProfile.address,
      phone: restaurantProfile.phone,
      hours: restaurantProfile.hours,
      about: restaurantProfile.about || '',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Add branding information
      ...(brandIdentity && {
        branding: {
          primaryColor: brandIdentity.primaryColor,
          logo: brandIdentity.logo || null,
          tagline: brandIdentity.tagline || null
        }
      })
    };

    await firebaseService.createDocument('organizations', organizationData, tenantId);
    console.log('[RestaurantRoutes] Created organization document');

    // 2. Save AI configuration to Firestore
    if (aiConfig) {
      const aiConfigData = {
        tenantId,
        voiceName: aiConfig.voiceName,
        tone: aiConfig.tone,
        responseLength: aiConfig.responseLength,
        allowedLanguages: aiConfig.allowedLanguages || ['en'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await firebaseService.updateAIConfig(tenantId, aiConfigData);
      console.log('[RestaurantRoutes] Created AI config');
    }

    // 3. Save menu items to Firestore
    let menuItemsCreated = 0;
    if (menuItems && menuItems.length > 0) {
      for (const item of menuItems) {
        const menuItemData = {
          name: item.name,
          description: item.description || '',
          price: item.price,
          category: item.category,
          type: item.type || 'veg', // Default to veg if not specified
          imageUrl: item.image || item.imageUrl || null,
          available: item.available !== false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await firebaseService.createMenuItem(tenantId, menuItemData);
        menuItemsCreated++;
      }
      console.log('[RestaurantRoutes] Created menu items', { count: menuItemsCreated });
    }

    // 4. Save locations if provided (for future multi-location support)
    if (locations && locations.length > 0) {
      for (const location of locations) {
        const locationData = {
          tenantId,
          name: location.name || `${companyName} - ${location.address}`,
          address: location.address,
          city: location.city,
          postalCode: location.postalCode,
          latitude: location.latitude || null,
          longitude: location.longitude || null,
          deliveryRadius: location.deliveryRadius || 5.0,
          deliveryZones: location.deliveryZones || [],
          isActive: location.isActive !== false,
          phone: location.phone || restaurantProfile.phone,
          hours: location.hours || restaurantProfile.hours,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await firebaseService.createDocument(
          `organizations/${tenantId}/locations`,
          locationData
        );
      }
      console.log('[RestaurantRoutes] Created locations', { count: locations.length });
    }

    res.json({
      success: true,
      message: 'Restaurant provisioned successfully',
      data: {
        tenantId,
        organizationCreated: true,
        aiConfigCreated: !!aiConfig,
        menuItemsCreated,
        locationsCreated: locations?.length || 0
      }
    });
  } catch (error) {
    console.error('[RestaurantRoutes] Failed to provision restaurant:', error);
    res.status(500).json({
      error: 'Failed to provision restaurant',
      message: error.message
    });
  }
});

// ==================== ORDER & DELIVERY ENDPOINTS ====================

/**
 * Geocode an address (for frontend address verification)
 * POST /api/restaurant/sessions/:sessionId/geocode-address
 */
router.post('/sessions/:sessionId/geocode-address', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { addressString, landmark, pincode } = req.body;

    if (!addressString) {
      return res.status(400).json({ error: 'addressString is required' });
    }

    console.log('[RestaurantRoutes] Geocoding address', { sessionId, addressString });

    // Get services from vertexAIService
    const googleMapsService = vertexAIService.googleMapsService;
    const deliveryService = vertexAIService.deliveryService;

    // Build full address string
    let fullAddress = addressString;
    if (landmark) fullAddress += `, Near ${landmark}`;
    if (pincode) fullAddress += `, ${pincode}`;

    // Geocode the address
    const geocodeResult = await googleMapsService.geocodeAddress(fullAddress);

    // Get restaurant location from config
    const restaurantLocation = {
      lat: config.restaurant?.location?.lat || 12.9716,
      lng: config.restaurant?.location?.lng || 77.5946
    };

    // Check delivery eligibility
    const deliveryCheck = await deliveryService.checkDeliveryZone(
      restaurantLocation,
      { lat: geocodeResult.lat, lng: geocodeResult.lng }
    );

    // Calculate delivery fee if eligible
    let feeResult = null;
    let estimatedTime = null;
    if (deliveryCheck.eligible) {
      const session = vertexAIService.getSession(sessionId);
      const cartTotal = session?.orderState?.cart?.subtotal || 0;

      feeResult = deliveryService.calculateDeliveryFee(
        deliveryCheck.distance,
        cartTotal
      );

      estimatedTime = deliveryService.calculateEstimatedDeliveryTime(
        deliveryCheck.distance,
        20
      );
    }

    res.json({
      success: true,
      eligible: deliveryCheck.eligible,
      address: {
        formatted: geocodeResult.formattedAddress,
        coordinates: {
          lat: geocodeResult.lat,
          lng: geocodeResult.lng
        },
        placeId: geocodeResult.placeId,
        pincode: googleMapsService.extractPincode(geocodeResult.addressComponents),
        city: googleMapsService.extractCity(geocodeResult.addressComponents),
        state: googleMapsService.extractState(geocodeResult.addressComponents)
      },
      delivery: deliveryCheck.eligible ? {
        distance: deliveryCheck.distance,
        distanceText: deliveryCheck.distanceText,
        durationText: deliveryCheck.durationText,
        fee: feeResult.fee,
        feeBreakdown: feeResult.breakdown,
        isFreeDelivery: feeResult.isFree,
        estimatedTime: estimatedTime.timeRange
      } : null,
      message: deliveryCheck.message
    });
  } catch (error) {
    console.error('[RestaurantRoutes] Geocoding failed:', error);
    res.status(500).json({
      error: 'Failed to geocode address',
      message: error.message
    });
  }
});

/**
 * Create and finalize an order
 * POST /api/restaurant/sessions/:sessionId/orders
 */
router.post('/sessions/:sessionId/orders', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const {
      orderType,
      paymentMethod,
      deliveryAddress,
      deliveryTime,
      specialInstructions
    } = req.body;

    if (!orderType) {
      return res.status(400).json({ error: 'orderType is required (delivery/pickup/dine-in)' });
    }
    if (!paymentMethod) {
      return res.status(400).json({ error: 'paymentMethod is required (online/cash)' });
    }

    console.log('[RestaurantRoutes] Creating order', { sessionId, orderType, paymentMethod });

    const session = vertexAIService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Validate cart
    if (!session.orderState.cart.items || session.orderState.cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Validate customer info
    if (!session.orderState.customer || !session.orderState.customer.name || !session.orderState.customer.phone) {
      return res.status(400).json({ error: 'Customer information is required' });
    }

    // Validate delivery address for delivery orders
    if (orderType === 'delivery' && !deliveryAddress) {
      return res.status(400).json({ error: 'Delivery address is required for delivery orders' });
    }

    // Calculate totals
    const subtotal = session.orderState.cart.subtotal || 0;
    const deliveryFee = orderType === 'delivery' ? (session.orderState.deliveryFee || 0) : 0;
    const taxRate = 0.05; // 5% GST
    const tax = Math.round((subtotal + deliveryFee) * taxRate * 100) / 100;
    const total = subtotal + deliveryFee + tax;

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
      orderType,
      paymentMethod,
      deliveryAddress: orderType === 'delivery' ? deliveryAddress : null,
      deliveryTime: deliveryTime || null,
      specialInstructions: specialInstructions || null,
      estimatedDeliveryTime: orderType === 'delivery' ? session.orderState.estimatedDeliveryTime : null,
      status: paymentMethod === 'online' ? 'pending_payment' : 'confirmed',
      createdAt: Date.now()
    };

    // Create order in Firebase
    try {
      const savedOrder = await firebaseService.createOrder(
        session.tenantId,
        session.orderState.customer.phone,
        orderData
      );
      console.log('[RestaurantRoutes] Order saved to Firebase:', savedOrder.orderId);
    } catch (error) {
      console.error('[RestaurantRoutes] Error saving order to Firebase:', error);
    }

    // Store order in session
    session.orderState.finalizedOrder = orderData;
    await vertexAIService.persistSessionState(session);

    // If online payment, create Razorpay order
    if (paymentMethod === 'online') {
      const paymentService = vertexAIService.paymentService;

      try {
        const razorpayOrder = await paymentService.createPaymentOrder({
          amount: total,
          orderId: orderData.orderId,
          customer: orderData.customer,
          currency: 'INR'
        });

        session.orderState.razorpayOrderId = razorpayOrder.id;
        await vertexAIService.persistSessionState(session);

        res.json({
          success: true,
          order: orderData,
          razorpayOrder: {
            id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            keyId: config.razorpay.keyId
          },
          nextStep: 'payment'
        });
      } catch (error) {
        console.error('[RestaurantRoutes] Razorpay order creation error:', error);
        res.status(500).json({
          error: 'Failed to initiate payment',
          message: error.message
        });
      }
    } else {
      // Cash payment - order is confirmed immediately
      res.json({
        success: true,
        order: orderData,
        nextStep: 'confirmed'
      });
    }
  } catch (error) {
    console.error('[RestaurantRoutes] Order creation failed:', error);
    res.status(500).json({
      error: 'Failed to create order',
      message: error.message
    });
  }
});

/**
 * Verify Razorpay payment signature
 * POST /api/restaurant/orders/:orderId/verify-payment
 */
router.post('/orders/:orderId/verify-payment', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ error: 'Missing payment verification parameters' });
    }

    console.log('[RestaurantRoutes] Verifying payment', { orderId, razorpayPaymentId });

    const paymentService = vertexAIService.paymentService;

    // Verify signature
    const isValid = paymentService.verifyPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature
    });

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature',
        message: 'Payment verification failed'
      });
    }

    // Get payment details
    const paymentDetails = await paymentService.getPaymentDetails(razorpayPaymentId);

    // Update order status in Firebase
    try {
      await firebaseService.updateOrderStatus(orderId, {
        status: 'confirmed',
        paymentStatus: 'paid',
        razorpayOrderId,
        razorpayPaymentId,
        paymentDetails,
        paidAt: Date.now()
      });
      console.log('[RestaurantRoutes] Order payment confirmed:', orderId);
    } catch (error) {
      console.error('[RestaurantRoutes] Error updating order status:', error);
    }

    res.json({
      success: true,
      verified: true,
      orderId,
      paymentDetails,
      message: 'Payment verified successfully'
    });
  } catch (error) {
    console.error('[RestaurantRoutes] Payment verification failed:', error);
    res.status(500).json({
      error: 'Failed to verify payment',
      message: error.message
    });
  }
});

/**
 * Razorpay webhook handler
 * POST /api/webhooks/razorpay
 */
router.post('/webhooks/razorpay', async (req, res) => {
  try {
    const webhookBody = JSON.stringify(req.body);
    const signature = req.headers['x-razorpay-signature'];

    console.log('[RestaurantRoutes] Razorpay webhook received:', req.body.event);

    const paymentService = vertexAIService.paymentService;

    // Verify webhook signature
    const isValid = paymentService.verifyWebhookSignature(webhookBody, signature);
    if (!isValid) {
      console.error('[RestaurantRoutes] Invalid webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Process webhook event
    const result = await paymentService.handleWebhookEvent(req.body);

    // Update order in Firebase based on result
    if (result.processed && result.orderId) {
      try {
        await firebaseService.updateOrderStatus(result.orderId, {
          status: result.status,
          razorpayPaymentId: result.razorpayPaymentId,
          webhookProcessedAt: Date.now()
        });
        console.log('[RestaurantRoutes] Order status updated from webhook:', result.orderId);
      } catch (error) {
        console.error('[RestaurantRoutes] Error updating order from webhook:', error);
      }
    }

    res.json({
      success: true,
      processed: result.processed
    });
  } catch (error) {
    console.error('[RestaurantRoutes] Webhook processing failed:', error);
    res.status(500).json({
      error: 'Failed to process webhook',
      message: error.message
    });
  }
});

/**
 * Setup WebSocket handler for audio streaming
 */
export function setupWebSocketServer(server) {
  const wss = new WebSocket.Server({
    noServer: true
  });

  // Handle upgrade requests manually
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;

    // Check if path matches /ws/restaurant/*
    if (pathname.startsWith('/ws/restaurant/')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', async (ws, req) => {
    const sessionId = req.url.split('/').pop();

    console.log('[WebSocket] Client connected', { sessionId });

    try {
      // Check if session exists, create if not
      let session = vertexAIService.getSession(sessionId);

      if (!session) {
        console.log('[WebSocket] Creating new Vertex AI session', { sessionId });

        // Parse query parameters for session config
        const url = new URL(req.url, `http://${req.headers.host}`);
        const tenantId = url.searchParams.get('tenantId') || 'demo-restaurant';
        const language = url.searchParams.get('language') || 'en';
        const userId = url.searchParams.get('userId') || 'demo-user';

        // Try to restore existing session data from Firebase
        const restoredData = await vertexAIService.restoreSessionState(sessionId, firebaseService);

        // Load menu items for AI context
        console.log('[WebSocket] Loading menu items for AI context', { tenantId });
        const menuItems = await menuService.listMenuItems(tenantId);
        console.log('[WebSocket] Loaded menu items', { count: menuItems.length });

        // Create Vertex AI session with menu context
        session = await vertexAIService.createSession(sessionId, {
          tenantId,
          language,
          userId,
          menuItems  // Include menu in context
        });

        // Inject services into session for order management
        vertexAIService.setSessionServices(sessionId, menuService, firebaseService);

        // Restore cart and customer data if available
        if (restoredData) {
          console.log('[WebSocket] Restoring session state from Firebase', {
            cartItems: restoredData.orderState?.cart?.items?.length || 0,
            customer: restoredData.orderState?.customer?.name || 'N/A'
          });

          // Restore order state
          if (restoredData.orderState) {
            session.orderState = {
              ...session.orderState,
              customer: restoredData.orderState.customer || session.orderState.customer,
              cart: restoredData.orderState.cart || session.orderState.cart
            };
          }

          // Restore conversation history
          if (restoredData.conversation && restoredData.conversation.length > 0) {
            session.conversation = restoredData.conversation;
          }

          // Send restored cart to display immediately
          if (session.orderState.cart.items.length > 0) {
            await vertexAIService.getDisplayClient().sendUpdate(sessionId, {
              type: 'cart_updated',
              data: session.orderState.cart
            });
            console.log('[WebSocket] Sent restored cart to display', {
              items: session.orderState.cart.items.length
            });
          }
        }

        console.log('[WebSocket] Vertex AI session created with services', { sessionId });
      }

      // Setup audio callback to send audio chunks to client
      vertexAIService.setAudioCallback(sessionId, (audioChunk) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(audioChunk);
        }
      });

      // Handle incoming audio from client
      ws.on('message', async (data) => {
        try {
          // Check if it's binary audio data or JSON control message
          if (Buffer.isBuffer(data)) {
            // Binary audio data - send to Vertex AI
            // Note: Guardrails validation is handled by Vertex AI's built-in safety filters
            // and system instructions. For future text-based features, use guardrailsService.validateInput()
            await vertexAIService.sendAudio(sessionId, data);
          } else {
            // JSON control message
            const message = JSON.parse(data.toString());

            // Apply rate limiting via guardrails
            const rateLimitResult = guardrailsService.checkRateLimit(sessionId);
            if (!rateLimitResult.allowed) {
              ws.send(JSON.stringify({
                type: 'error',
                error: 'Rate limit exceeded',
                message: 'Too many requests. Please wait before sending more messages.'
              }));
              return;
            }

            if (message.type === 'ping') {
              ws.send(JSON.stringify({ type: 'pong' }));
            } else if (message.type === 'start_session') {
              // Client is ready to start receiving audio
              ws.send(JSON.stringify({
                type: 'session_ready',
                sessionId,
                message: 'Session is ready for audio streaming'
              }));
            } else if (message.type === 'interrupt') {
              // User interrupted AI response
              console.log('[WebSocket] Interruption detected', { sessionId });
              // Clear any pending audio generation
              await vertexAIService.handleInterruption(sessionId);
            }
          }
        } catch (error) {
          console.error('[WebSocket] Error handling message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Failed to process message',
            message: error.message
          }));
        }
      });

      ws.on('close', () => {
        console.log('[WebSocket] Client disconnected', { sessionId });
      });

      ws.on('error', (error) => {
        console.error('[WebSocket] Error:', error);
      });

      // Send ready message
      ws.send(JSON.stringify({
        type: 'session_started',
        sessionId,
        message: 'WebSocket connection established, Vertex AI session ready'
      }));
    } catch (error) {
      console.error('[WebSocket] Failed to setup session:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Failed to create session',
        message: error.message
      }));
      ws.close();
    }
  });

  console.log('[WebSocket] Server initialized for restaurant audio streaming');

  return wss;
}

export default router;
