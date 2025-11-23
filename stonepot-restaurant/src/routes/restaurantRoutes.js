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
import { OrderManagementService } from '../services/OrderManagementService.js';
import { getCustomerService } from '../services/CustomerService.js';
import { createOrderManagementRoutes, createRestaurantDashboardWebSocketHandler } from './orderManagementRoutes.js';
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

// Initialize Order Management Service
const orderManagementService = new OrderManagementService(firebaseService, {
  restaurantName: config.restaurant?.name || 'Stonepot Restaurant',
  kitchenPrinterEnabled: config.kitchenPrinter?.enabled || false
});

// Initialize Customer Service
const customerService = getCustomerService(config);

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
 * Get customer's address history (for returning customers)
 * Returns saved addresses with placeIds for quick selection
 * GET /api/restaurant/sessions/:sessionId/address-history
 */
router.get('/sessions/:sessionId/address-history', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ error: 'phone is required' });
    }

    const session = vertexAIService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get customer from Firestore
    const customer = await customerService.getCustomer(session.tenantId, phone);

    if (!customer) {
      return res.json({
        success: true,
        addresses: []
      });
    }

    // Return customer's saved addresses (new multi-address system)
    let addresses = [];

    // Priority 1: New savedAddresses array with labels
    if (customer.savedAddresses && customer.savedAddresses.length > 0) {
      addresses = customer.savedAddresses.map(addr => ({
        formatted: addr.formatted,
        placeId: addr.placeId || null,
        coordinates: addr.coordinates,
        apartment: addr.apartment,
        landmark: addr.landmark,
        instructions: addr.instructions,
        city: addr.city,
        pincode: addr.pincode,
        label: addr.label || 'other',
        isDefault: addr.isDefault || false,
        requiresMigration: !addr.placeId
      }));

      console.log('[AddressHistory] Loaded', addresses.length, 'saved addresses with labels');
    }
    // Priority 2: Legacy single deliveryAddress (for backwards compatibility)
    else if (customer.deliveryAddress) {
      const hasPlaceId = !!customer.deliveryAddress.placeId;

      addresses.push({
        formatted: customer.deliveryAddress.formatted,
        placeId: customer.deliveryAddress.placeId || null,
        coordinates: customer.deliveryAddress.coordinates,
        apartment: customer.deliveryAddress.apartment,
        landmark: customer.deliveryAddress.landmark,
        instructions: customer.deliveryAddress.instructions,
        city: customer.deliveryAddress.city,
        pincode: customer.deliveryAddress.pincode,
        label: 'other', // Default label for legacy addresses
        isDefault: true,
        requiresMigration: !hasPlaceId
      });

      if (!hasPlaceId) {
        console.log('[AddressHistory] Legacy address without placeId for customer:', phone);
      }
    }

    res.json({
      success: true,
      addresses: addresses,
      optimizationAvailable: addresses.some(addr => addr.placeId),
      migrationNeeded: addresses.some(addr => addr.requiresMigration),
      defaultAddress: addresses.find(addr => addr.isDefault) || null
    });
  } catch (error) {
    console.error('[RestaurantRoutes] Failed to get address history:', error);
    res.status(500).json({
      error: 'Failed to get address history',
      message: error.message
    });
  }
});

/**
 * Migrate legacy address to include placeId (for existing customers)
 * Uses reverse geocoding to get placeId from coordinates
 * POST /api/restaurant/sessions/:sessionId/migrate-address
 */
router.post('/sessions/:sessionId/migrate-address', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { coordinates, apartment, landmark, instructions } = req.body;

    if (!coordinates || !coordinates.lat || !coordinates.lng) {
      return res.status(400).json({ error: 'coordinates are required' });
    }

    console.log('[RestaurantRoutes] Migrating legacy address', { sessionId, coordinates });

    const googleMapsService = vertexAIService.googleMapsService;
    const deliveryService = vertexAIService.deliveryService;

    // Reverse geocode to get placeId
    const reverseResult = await googleMapsService.reverseGeocode(
      coordinates.lat,
      coordinates.lng
    );

    // Get restaurant location
    const restaurantLocation = {
      lat: config.restaurant?.location?.lat || 12.9716,
      lng: config.restaurant?.location?.lng || 77.5946
    };

    // Check delivery eligibility
    const deliveryCheck = await deliveryService.checkDeliveryZone(
      restaurantLocation,
      coordinates
    );

    let feeResult = null;
    let estimatedTime = null;
    if (deliveryCheck.eligible) {
      const session = vertexAIService.getSession(sessionId);
      const cartTotal = session?.orderState?.cart?.subtotal || 0;

      feeResult = deliveryService.calculateDeliveryFee(deliveryCheck.distance, cartTotal);
      estimatedTime = deliveryService.calculateEstimatedDeliveryTime(deliveryCheck.distance, 20);
    }

    res.json({
      success: true,
      eligible: deliveryCheck.eligible,
      address: {
        formatted: reverseResult.formattedAddress,
        coordinates: coordinates,
        placeId: reverseResult.placeId, // Now has placeId!
        pincode: googleMapsService.extractPincode(reverseResult.addressComponents),
        city: googleMapsService.extractCity(reverseResult.addressComponents),
        state: googleMapsService.extractState(reverseResult.addressComponents),
        apartment: apartment,
        landmark: landmark,
        instructions: instructions
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
      message: deliveryCheck.message,
      migrated: true
    });
  } catch (error) {
    console.error('[RestaurantRoutes] Address migration failed:', error);
    res.status(500).json({
      error: 'Failed to migrate address',
      message: error.message
    });
  }
});

/**
 * Quick address lookup using placeId (optimized for returning customers)
 * 40% cheaper + 50% faster than full geocoding
 * POST /api/restaurant/sessions/:sessionId/quick-address
 */
router.post('/sessions/:sessionId/quick-address', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { placeId, apartment, landmark, instructions, label, isDefault } = req.body;

    if (!placeId) {
      return res.status(400).json({ error: 'placeId is required' });
    }

    console.log('[RestaurantRoutes] Quick address lookup via placeId', { sessionId, placeId, label });

    const session = vertexAIService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get services from vertexAIService
    const googleMapsService = vertexAIService.googleMapsService;
    const deliveryService = vertexAIService.deliveryService;

    // Fast lookup using placeId (3 API credits vs 5 for geocoding)
    const placeDetails = await googleMapsService.getPlaceDetails(placeId);

    // Get restaurant location from config
    const restaurantLocation = {
      lat: config.restaurant?.location?.lat || 12.9716,
      lng: config.restaurant?.location?.lng || 77.5946
    };

    // Check delivery eligibility
    const deliveryCheck = await deliveryService.checkDeliveryZone(
      restaurantLocation,
      { lat: placeDetails.lat, lng: placeDetails.lng }
    );

    // Calculate delivery fee if eligible
    let feeResult = null;
    let estimatedTime = null;
    if (deliveryCheck.eligible) {
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

    const addressData = {
      formatted: placeDetails.formattedAddress,
      coordinates: {
        lat: placeDetails.lat,
        lng: placeDetails.lng
      },
      placeId: placeId,
      pincode: googleMapsService.extractPincode(placeDetails.addressComponents),
      city: googleMapsService.extractCity(placeDetails.addressComponents),
      state: googleMapsService.extractState(placeDetails.addressComponents),
      apartment: apartment || undefined,
      landmark: landmark || undefined,
      instructions: instructions || undefined
    };

    // Save address to customer profile if customer exists
    if (session.orderState?.customer?.phone) {
      try {
        await customerService.saveAddress(session.tenantId, session.orderState.customer.phone, {
          ...addressData,
          label: label || 'other',
          isDefault: isDefault || false
        });
        console.log('[RestaurantRoutes] Saved address with label:', label || 'other');
      } catch (saveError) {
        console.error('[RestaurantRoutes] Failed to save address:', saveError);
        // Continue with response even if save fails
      }
    }

    res.json({
      success: true,
      eligible: deliveryCheck.eligible,
      address: addressData,
      delivery: deliveryCheck.eligible ? {
        distance: deliveryCheck.distance,
        distanceText: deliveryCheck.distanceText,
        durationText: deliveryCheck.durationText,
        fee: feeResult.fee,
        feeBreakdown: feeResult.breakdown,
        isFreeDelivery: feeResult.isFree,
        estimatedTime: estimatedTime.timeRange
      } : null,
      message: deliveryCheck.message,
      optimized: true // Flag to indicate this used the faster placeId lookup
    });
  } catch (error) {
    console.error('[RestaurantRoutes] Quick address lookup failed:', error);
    res.status(500).json({
      error: 'Failed to lookup address',
      message: error.message
    });
  }
});

/**
 * Geocode an address (for frontend address verification)
 * POST /api/restaurant/sessions/:sessionId/geocode-address
 */
router.post('/sessions/:sessionId/geocode-address', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { addressString, apartment, landmark, pincode, instructions, label, isDefault } = req.body;

    if (!addressString) {
      return res.status(400).json({ error: 'addressString is required' });
    }

    console.log('[RestaurantRoutes] Geocoding address', { sessionId, addressString, label });

    const session = vertexAIService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

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

    const addressData = {
      formatted: geocodeResult.formattedAddress,
      coordinates: {
        lat: geocodeResult.lat,
        lng: geocodeResult.lng
      },
      placeId: geocodeResult.placeId,
      pincode: googleMapsService.extractPincode(geocodeResult.addressComponents),
      city: googleMapsService.extractCity(geocodeResult.addressComponents),
      state: googleMapsService.extractState(geocodeResult.addressComponents),
      apartment: apartment || undefined,
      landmark: landmark || undefined,
      instructions: instructions || undefined
    };

    // Save address to customer profile if customer exists
    if (session.orderState?.customer?.phone) {
      try {
        await customerService.saveAddress(session.tenantId, session.orderState.customer.phone, {
          ...addressData,
          label: label || 'other',
          isDefault: isDefault || false
        });
        console.log('[RestaurantRoutes] Saved address with label:', label || 'other');
      } catch (saveError) {
        console.error('[RestaurantRoutes] Failed to save address:', saveError);
        // Continue with response even if save fails
      }
    }

    res.json({
      success: true,
      eligible: deliveryCheck.eligible,
      address: addressData,
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
 * Sync customer information to session
 * Used by manual checkout flow to update session with customer data
 * POST /api/restaurant/sessions/:sessionId/customer
 */
router.post('/sessions/:sessionId/customer', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { name, phone, email } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    console.log('[RestaurantRoutes] Syncing customer to session', { sessionId, name, phone });

    const session = vertexAIService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Update session customer data
    session.orderState.customer = {
      name,
      phone,
      email: email || null,
      deliveryAddress: session.orderState.customer?.deliveryAddress || null,
      confirmedAt: Date.now()
    };

    // Broadcast customer update to WebSocket client (single source of truth)
    if (session.ws) {
      try {
        session.ws.send(JSON.stringify({
          type: 'customer_update',
          customer: session.orderState.customer,
          timestamp: Date.now()
        }));
        console.log('[RestaurantRoutes] Broadcasted customer update to WebSocket client');
      } catch (wsError) {
        console.warn('[RestaurantRoutes] Failed to broadcast customer update:', wsError.message);
      }
    }

    // Save/update customer in Firestore
    try {
      await customerService.upsertCustomer(session.tenantId, {
        name,
        phone,
        email: email || null
      });

      console.log('[RestaurantRoutes] Customer synced to session and saved to Firestore', { phone });

      res.json({
        success: true,
        customer: session.orderState.customer
      });
    } catch (error) {
      console.error('[RestaurantRoutes] Failed to save customer:', error);
      // Still return success since session was updated
      res.json({
        success: true,
        customer: session.orderState.customer,
        warning: 'Customer saved to session but Firestore sync failed'
      });
    }
  } catch (error) {
    console.error('[RestaurantRoutes] Error syncing customer:', error);
    res.status(500).json({ error: error.message });
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

// ==================== ORDER MANAGEMENT ENDPOINTS ====================
// Mount order management routes at /manage
router.use('/manage', createOrderManagementRoutes(orderManagementService));

/**
 * Setup WebSocket handler for audio streaming
 */
export function setupWebSocketServer(server) {
  const wss = new WebSocket.Server({
    noServer: true
  });

  // Create WebSocket handler for restaurant dashboard
  const dashboardWebSocketHandler = createRestaurantDashboardWebSocketHandler(orderManagementService);

  // Handle upgrade requests manually
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;

    // Check if path matches /ws/restaurant/* (for voice ordering)
    if (pathname.startsWith('/ws/restaurant/') && !pathname.startsWith('/ws/restaurant-dashboard/')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
    // Check if path matches /ws/restaurant-dashboard/* (for order management dashboard)
    else if (pathname.startsWith('/ws/restaurant-dashboard/')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        dashboardWebSocketHandler(ws, request);
      });
    }
    else {
      socket.destroy();
    }
  });

  wss.on('connection', async (ws, req) => {
    const sessionId = req.url.split('/').pop();

    console.log('[WebSocket] Client connected', { sessionId });

    try {
      // Check if session exists, create if not
      let session = vertexAIService.getSession(sessionId);

      // Store client WebSocket reference (even if session exists)
      if (session) {
        session.clientWs = ws;
        console.log('[WebSocket] Updated client WebSocket for existing session');
      }

      if (!session) {
        console.log('[WebSocket] Creating new Vertex AI session', { sessionId });

        // Parse query parameters for session config
        const url = new URL(req.url, `http://${req.headers.host}`);
        const tenantId = url.searchParams.get('tenantId') || 'demo-restaurant';
        const language = url.searchParams.get('language') || 'en';
        const userId = url.searchParams.get('userId') || 'demo-user';
        const customerPhone = url.searchParams.get('customerPhone'); // For returning customers

        // Pre-load customer context if phone provided (returning customer)
        let customerContext = null;
        if (customerPhone) {
          try {
            console.log('[WebSocket] Returning customer detected, loading context', { customerPhone });

            // Lookup existing customer
            const customer = await customerService.getCustomer(tenantId, customerPhone);
            if (customer) {
              // Fetch order history
              const orderHistory = await customerService.getCustomerOrders(
                tenantId,
                customerPhone,
                5 // last 5 orders
              );

              customerContext = {
                customer,
                orderHistory
              };

              console.log('[WebSocket] Customer context loaded', {
                name: customer.name,
                orderCount: orderHistory.length
              });
            }
          } catch (error) {
            console.warn('[WebSocket] Could not load customer context:', error.message);
          }
        }

        // Try to restore existing session data from Firebase
        const restoredData = await vertexAIService.restoreSessionState(sessionId, firebaseService);

        // Load menu items for AI context
        console.log('[WebSocket] Loading menu items for AI context', { tenantId });
        const menuItems = await menuService.listMenuItems(tenantId);
        console.log('[WebSocket] Loaded menu items', { count: menuItems.length });

        // Create Vertex AI session with menu context and customer context
        session = await vertexAIService.createSession(sessionId, {
          tenantId,
          language,
          userId,
          menuItems,  // Include menu in context
          customerContext  // Include returning customer context
        });

        // CRITICAL: Store client WebSocket reference for broadcasting messages
        session.clientWs = ws;

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

          // Session is not active - fail immediately (auto-reconnection disabled)
          if (error.message && error.message.includes('not active')) {
            ws.send(JSON.stringify({
              type: 'session_reconnect_failed',
              error: 'Session not active',
              message: 'Session expired. Please start a new conversation.'
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Failed to process message',
              message: error.message
            }));
          }
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

  console.log('[WebSocket] Server initialized for:');
  console.log('  - Restaurant audio streaming (/ws/restaurant/:sessionId)');
  console.log('  - Restaurant dashboard real-time updates (/ws/restaurant-dashboard/:tenantId)');

  return wss;
}

export default router;
