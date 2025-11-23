/**
 * Menu Upload Routes - Global Menu Onboarding Workflow
 * Handles Excel upload, confirmation, and photo matching
 */

import express from 'express';
import multer from 'multer';
import { MenuManagementService } from '../services/MenuManagementService.js';
import { ExcelParserService } from '../services/ExcelParserService.js';
import { CloudflareImageService } from '../services/CloudflareImageService.js';
import { SmartMenuParserService } from '../services/SmartMenuParserService.js';
import { getFirebaseService } from '../services/FirebaseService.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'application/pdf', // PDF support
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
  }
});

/**
 * GET /api/admin/menu/template
 * Download global Excel template for menu import
 */
router.get('/template', async (req, res) => {
  try {
    const excelParser = new ExcelParserService();
    const templateBuffer = excelParser.generateTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=menu-template-global.xlsx');
    res.send(templateBuffer);

    console.log('[MenuUpload] Template downloaded');
  } catch (error) {
    console.error('[MenuUpload] Template generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/menu/upload-excel
 * Parse Excel file and return items for confirmation
 */
router.post('/upload-excel', upload.single('file'), async (req, res) => {
  try {
    const { tenantId } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'tenantId is required'
      });
    }

    console.log('[MenuUpload] Parsing Excel file', {
      tenantId,
      filename: req.file.originalname,
      size: req.file.size
    });

    const excelParser = new ExcelParserService();
    const parsedItems = await excelParser.parseMenuExcel(req.file.buffer);

    console.log('[MenuUpload] Excel parsed successfully', {
      itemCount: parsedItems.length
    });

    res.json({
      success: true,
      items: parsedItems,
      count: parsedItems.length,
      message: `Successfully parsed ${parsedItems.length} menu items. Please review and confirm.`
    });

  } catch (error) {
    console.error('[MenuUpload] Excel upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/menu/upload-smart
 * Smart AI-powered document parsing - accepts ANY menu format
 * Supports: PDF, Excel, Word, Images (no template required)
 */
router.post('/upload-smart', upload.single('file'), async (req, res) => {
  try {
    const { tenantId } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'tenantId is required'
      });
    }

    console.log('[MenuUpload] Smart parsing document', {
      tenantId,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    });

    // Initialize smart parser
    const smartParser = new SmartMenuParserService(req.app.locals.config);

    // Parse document using Gemini AI
    const result = await smartParser.parseDocument(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    // Validate and clean extracted items
    const cleanedItems = smartParser.validateAndClean(result.items);

    console.log('[MenuUpload] Smart parsing complete', {
      itemCount: cleanedItems.length,
      confidence: result.confidence,
      originalCount: result.items.length
    });

    res.json({
      success: true,
      items: cleanedItems,
      count: cleanedItems.length,
      confidence: result.confidence,
      metadata: result.metadata,
      message: `Successfully extracted ${cleanedItems.length} menu items using AI (${Math.round(result.confidence * 100)}% confidence). Please review and confirm.`
    });

  } catch (error) {
    console.error('[MenuUpload] Smart parsing error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Smart parsing failed. You can try the template-based upload instead.'
    });
  }
});

/**
 * POST /api/admin/menu/confirm
 * Confirm and save menu items to Firestore
 */
router.post('/confirm', async (req, res) => {
  try {
    const { tenantId, items } = req.body;

    if (!tenantId || !items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'tenantId and items array are required'
      });
    }

    console.log('[MenuUpload] Confirming menu items', {
      tenantId,
      itemCount: items.length
    });

    const firebase = getFirebaseService();
    const saved = [];
    const failed = [];

    // Save each item to Firestore
    for (const item of items) {
      try {
        const menuItem = {
          ...item,
          tenantId,
          imageUrl: item.imageUrl || null,
          imageId: item.imageId || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const docRef = await firebase.db
          .collection(`tenants/${tenantId}/menu_items`)
          .add(menuItem);

        saved.push({ ...menuItem, id: docRef.id });
      } catch (error) {
        console.error('[MenuUpload] Failed to save item:', error.message);
        failed.push({ item: item.name, error: error.message });
      }
    }

    console.log('[MenuUpload] Menu confirmation complete', {
      saved: saved.length,
      failed: failed.length
    });

    res.json({
      success: true,
      saved: saved.length,
      failed: failed.length,
      items: saved,
      errors: failed,
      message: `Saved ${saved.length} items successfully${failed.length > 0 ? `, ${failed.length} failed` : ''}`
    });

  } catch (error) {
    console.error('[MenuUpload] Confirmation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/menu/upload-photos
 * Upload photos and match to menu items
 */
router.post('/upload-photos', upload.array('photos', 50), async (req, res) => {
  try {
    const { tenantId } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No photos uploaded'
      });
    }

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'tenantId is required'
      });
    }

    console.log('[MenuUpload] Processing photo uploads', {
      tenantId,
      photoCount: req.files.length
    });

    // Get existing menu items for matching
    const firebase = getFirebaseService();
    const menuItemsSnapshot = await firebase.db
      .collection(`tenants/${tenantId}/menu_items`)
      .get();

    const menuItems = [];
    menuItemsSnapshot.forEach(doc => {
      menuItems.push({ id: doc.id, ...doc.data() });
    });

    console.log('[MenuUpload] Loaded menu items for matching', {
      count: menuItems.length
    });

    const imageService = new CloudflareImageService(req.app.locals.config);

    // Match images to menu items
    const files = req.files.map(file => ({
      filename: file.originalname,
      buffer: file.buffer
    }));

    const matchResults = imageService.batchMatchImages(files, menuItems);

    const results = {
      matched: [],
      unmatched: [],
      uploaded: []
    };

    // Upload images and update menu items
    for (let i = 0; i < matchResults.length; i++) {
      const match = matchResults[i];
      const file = req.files[i];

      try {
        // Upload to Cloudflare Images
        const uploadResult = await imageService.uploadImage(match.buffer, {
          filename: file.originalname,
          metadata: {
            tenantId,
            dishName: match.matchedItem?.name || 'unknown'
          }
        });

        const result = {
          filename: file.originalname,
          imageUrl: uploadResult.publicUrl,
          imageId: uploadResult.id,
          matched: match.matched,
          matchedItem: match.matchedItem ? {
            id: match.matchedItem.id,
            name: match.matchedItem.name
          } : null
        };

        results.uploaded.push(result);

        // Update menu item if matched
        if (match.matched && match.matchedItem) {
          await firebase.db
            .collection(`tenants/${tenantId}/menu_items`)
            .doc(match.matchedItem.id)
            .update({
              imageUrl: uploadResult.publicUrl,
              imageId: uploadResult.id,
              updatedAt: new Date().toISOString()
            });

          results.matched.push(result);
        } else {
          results.unmatched.push(result);
        }

      } catch (error) {
        console.error('[MenuUpload] Photo upload failed:', error.message);
        results.unmatched.push({
          filename: file.originalname,
          error: error.message,
          matched: false
        });
      }
    }

    console.log('[MenuUpload] Photo upload complete', {
      total: req.files.length,
      matched: results.matched.length,
      unmatched: results.unmatched.length
    });

    res.json({
      success: true,
      total: req.files.length,
      matched: results.matched.length,
      unmatched: results.unmatched.length,
      results,
      message: `Uploaded ${results.matched.length} photos with successful matches, ${results.unmatched.length} unmatched`
    });

  } catch (error) {
    console.error('[MenuUpload] Photo upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/tenants/:tenantId/menu
 * Get full menu for tenant (for POS display)
 */
router.get('/:tenantId/menu', async (req, res) => {
  try {
    const { tenantId } = req.params;

    const firebase = getFirebaseService();
    const menuItemsSnapshot = await firebase.db
      .collection(`tenants/${tenantId}/menu_items`)
      .where('available', '==', true)
      .get();

    const menuItems = [];
    menuItemsSnapshot.forEach(doc => {
      menuItems.push({ id: doc.id, ...doc.data() });
    });

    console.log('[MenuUpload] Retrieved menu for tenant', {
      tenantId,
      itemCount: menuItems.length
    });

    res.json({
      success: true,
      tenantId,
      items: menuItems,
      count: menuItems.length
    });

  } catch (error) {
    console.error('[MenuUpload] Get menu error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
