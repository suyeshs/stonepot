/**
 * Menu Management Service
 * Handles CRUD operations for restaurant menu items with image upload
 */

import { CloudflareImageService } from './CloudflareImageService.js';
import { ExcelParserService } from './ExcelParserService.js';
import { getFirebaseService } from './FirebaseService.js';
import { STATIC_MENU_ITEMS } from '../data/staticMenu.js';

export class MenuManagementService {
  constructor(config) {
    this.config = config;
    this.imageService = new CloudflareImageService(config);
    this.excelParser = new ExcelParserService();
    this.firebase = getFirebaseService(config);
    this.useStaticMenu = config.useStaticMenu !== false; // Default to true
  }

  /**
   * Create a new menu item with optional image
   */
  async createMenuItem(tenantId, itemData, imageBuffer = null) {
    try {
      let imageUrl = null;
      let imageId = null;

      // Upload image if provided and service is configured
      if (imageBuffer && this.imageService.isConfigured()) {
        console.log('[MenuManagementService] Uploading dish image...');

        const uploadResult = await this.imageService.uploadImage(imageBuffer, {
          filename: `${itemData.name.replace(/\s+/g, '-').toLowerCase()}.jpg`,
          metadata: {
            tenantId,
            dishName: itemData.name,
            category: itemData.category
          }
        });

        imageUrl = uploadResult.publicUrl;
        imageId = uploadResult.id;

        console.log('[MenuManagementService] Image uploaded', { imageId, imageUrl });
      } else if (imageBuffer && !this.imageService.isConfigured()) {
        console.warn('[MenuManagementService] Image provided but Cloudflare Images not configured');
      }

      // Create menu item document
      const menuItem = {
        name: itemData.name,
        description: itemData.description || '',
        price: itemData.price,
        category: itemData.category,
        subcategory: itemData.subcategory || null,
        allergens: itemData.allergens || [],
        dietaryTags: itemData.dietaryTags || [],
        spiceLevel: itemData.spiceLevel || 'medium',
        available: itemData.available !== false,
        preparationTime: itemData.preparationTime || '15-20 minutes',
        servingSize: itemData.servingSize || 'Serves 1',
        imageUrl,
        imageId
      };

      // Save to Firestore
      const created = await this.firebase.createMenuItem(tenantId, menuItem);

      console.log('[MenuManagementService] Menu item created', { id: created.id, name: created.name });

      // TODO: Sync to Google File Search for RAG
      // await this.syncToFileSearch(tenantId, created);

      return created;
    } catch (error) {
      console.error('[MenuManagementService] Create menu item error:', error);
      throw error;
    }
  }

  /**
   * Get all menu items for a tenant
   */
  async listMenuItems(tenantId, filters = {}) {
    try {
      // Use static menu if configured
      if (this.useStaticMenu) {
        console.log('[MenuManagementService] Using static menu data', {
          tenantId,
          count: STATIC_MENU_ITEMS.length,
          filters
        });

        let items = [...STATIC_MENU_ITEMS];

        // Apply filters if provided
        if (filters.category) {
          items = items.filter(item => item.category === filters.category);
        }
        if (filters.available !== undefined) {
          items = items.filter(item => item.available === filters.available);
        }

        return items;
      }

      // Otherwise use Firebase
      const items = await this.firebase.getMenuItems(tenantId, filters);

      console.log('[MenuManagementService] Listed menu items from Firebase', {
        tenantId,
        count: items.length,
        filters
      });

      return items;
    } catch (error) {
      console.error('[MenuManagementService] List menu items error:', error);
      throw error;
    }
  }

  /**
   * Get a single menu item by ID
   */
  async getMenuItem(itemId) {
    try {
      const item = await this.firebase.getDocument('tenant_content', itemId);

      if (!item || item.type !== 'menu_item') {
        throw new Error('Menu item not found');
      }

      return item;
    } catch (error) {
      console.error('[MenuManagementService] Get menu item error:', error);
      throw error;
    }
  }

  /**
   * Update a menu item with optional new image
   */
  async updateMenuItem(itemId, updates, newImageBuffer = null) {
    try {
      // Get existing item
      const existingItem = await this.getMenuItem(itemId);

      // Handle new image upload
      if (newImageBuffer && this.imageService.isConfigured()) {
        console.log('[MenuManagementService] Uploading new image...');

        // Delete old image if exists
        if (existingItem.imageId) {
          try {
            await this.imageService.deleteImage(existingItem.imageId);
            console.log('[MenuManagementService] Old image deleted', { imageId: existingItem.imageId });
          } catch (error) {
            console.warn('[MenuManagementService] Failed to delete old image:', error.message);
          }
        }

        // Upload new image
        const uploadResult = await this.imageService.uploadImage(newImageBuffer, {
          filename: `${updates.name || existingItem.name}.jpg`,
          metadata: {
            tenantId: existingItem.tenantId,
            dishName: updates.name || existingItem.name
          }
        });

        updates.imageUrl = uploadResult.publicUrl;
        updates.imageId = uploadResult.id;
      }

      // Update in Firestore
      const updated = await this.firebase.updateMenuItem(itemId, updates);

      console.log('[MenuManagementService] Menu item updated', { id: itemId });

      // TODO: Re-sync to Google File Search
      // await this.syncToFileSearch(updated.tenantId, updated);

      return updated;
    } catch (error) {
      console.error('[MenuManagementService] Update menu item error:', error);
      throw error;
    }
  }

  /**
   * Delete a menu item and its image
   */
  async deleteMenuItem(itemId) {
    try {
      // Get item to delete associated image
      const item = await this.getMenuItem(itemId);

      // Delete image from Cloudflare if exists
      if (item.imageId && this.imageService.isConfigured()) {
        try {
          await this.imageService.deleteImage(item.imageId);
          console.log('[MenuManagementService] Image deleted', { imageId: item.imageId });
        } catch (error) {
          console.warn('[MenuManagementService] Failed to delete image:', error.message);
        }
      }

      // Delete from Firestore
      await this.firebase.deleteMenuItem(itemId);

      console.log('[MenuManagementService] Menu item deleted', { id: itemId });

      // TODO: Remove from Google File Search
      // await this.removeFromFileSearch(item.tenantId, itemId);

      return { success: true, id: itemId };
    } catch (error) {
      console.error('[MenuManagementService] Delete menu item error:', error);
      throw error;
    }
  }

  /**
   * Bulk import menu items from Excel
   */
  async importFromExcel(tenantId, excelBuffer) {
    try {
      console.log('[MenuManagementService] Starting Excel import for tenant', tenantId);

      // Parse Excel file
      const parsedItems = await this.excelParser.parseMenuExcel(excelBuffer);

      console.log('[MenuManagementService] Parsed Excel items', { count: parsedItems.length });

      const results = {
        success: [],
        failed: []
      };

      // Create each item
      for (const item of parsedItems) {
        try {
          // Validate item
          const validation = this.excelParser.validateMenuItem(item);
          if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
          }

          // Create item (without image for now - images can be added later via update)
          const created = await this.createMenuItem(tenantId, item, null);
          results.success.push(created);
        } catch (error) {
          console.error('[MenuManagementService] Failed to create item:', error.message);
          results.failed.push({
            item: { name: item.name },
            error: error.message
          });
        }
      }

      console.log('[MenuManagementService] Excel import complete', {
        total: parsedItems.length,
        success: results.success.length,
        failed: results.failed.length
      });

      return {
        total: parsedItems.length,
        imported: results.success.length,
        failed: results.failed.length,
        results
      };
    } catch (error) {
      console.error('[MenuManagementService] Excel import error:', error);
      throw error;
    }
  }

  /**
   * Get menu items by category
   */
  async getMenuByCategory(tenantId) {
    try {
      const items = await this.listMenuItems(tenantId);

      // Group by category
      const categorized = items.reduce((acc, item) => {
        const category = item.category || 'other';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(item);
        return acc;
      }, {});

      return categorized;
    } catch (error) {
      console.error('[MenuManagementService] Get menu by category error:', error);
      throw error;
    }
  }

  /**
   * Search menu items
   */
  async searchMenuItems(tenantId, query) {
    try {
      const items = await this.listMenuItems(tenantId);
      const queryLower = query.toLowerCase();

      // Simple text search in name and description
      const results = items.filter(item => {
        return (
          item.name.toLowerCase().includes(queryLower) ||
          item.description.toLowerCase().includes(queryLower) ||
          item.category?.toLowerCase().includes(queryLower) ||
          item.subcategory?.toLowerCase().includes(queryLower) ||
          item.dietary?.some(tag => tag.toLowerCase().includes(queryLower)) ||
          item.dietaryTags?.some(tag => tag.toLowerCase().includes(queryLower))
        );
      });

      console.log('[MenuManagementService] Search results', {
        query,
        results: results.length
      });

      return results;
    } catch (error) {
      console.error('[MenuManagementService] Search error:', error);
      throw error;
    }
  }

  /**
   * Get menu statistics
   */
  async getMenuStats(tenantId) {
    try {
      const items = await this.listMenuItems(tenantId);

      const stats = {
        totalItems: items.length,
        availableItems: items.filter(i => i.available).length,
        byCategory: {},
        avgPrice: 0,
        priceRange: { min: 0, max: 0 },
        withImages: items.filter(i => i.imageUrl).length
      };

      // Count by category
      items.forEach(item => {
        const category = item.category || 'other';
        stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
      });

      // Price stats
      if (items.length > 0) {
        const prices = items.map(i => i.price);
        stats.avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
        stats.priceRange.min = Math.min(...prices);
        stats.priceRange.max = Math.max(...prices);
      }

      return stats;
    } catch (error) {
      console.error('[MenuManagementService] Get stats error:', error);
      throw error;
    }
  }

  /**
   * TODO: Sync menu item to Google File Search for RAG
   */
  async syncToFileSearch(tenantId, menuItem) {
    // This will be implemented when ContentManagementService is added
    console.log('[MenuManagementService] File Search sync not yet implemented', {
      tenantId,
      itemId: menuItem.id
    });
  }

  /**
   * Generate Excel template for menu import
   */
  generateImportTemplate() {
    return this.excelParser.generateTemplate();
  }
}

export default MenuManagementService;
