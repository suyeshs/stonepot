/**
 * Firebase Service for Stonepot Restaurant
 * Handles Firestore database operations with multi-tenant isolation
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

class FirebaseService {
  constructor(config) {
    this.config = config;
    this.app = null;
    this.firestore = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize Firebase Admin
      if (this.config.firebase.credentialsPath) {
        // Use service account file
        this.app = initializeApp({
          credential: cert(this.config.firebase.credentialsPath),
          projectId: this.config.firebase.projectId
        });
      } else {
        // Use Application Default Credentials (Cloud Run)
        this.app = initializeApp({
          projectId: this.config.firebase.projectId
        });
      }

      this.firestore = getFirestore(this.app);

      console.log('[FirebaseService] Initialized', {
        projectId: this.config.firebase.projectId
      });

      this.initialized = true;
    } catch (error) {
      console.error('[FirebaseService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get a document by ID
   */
  async getDocument(collection, documentId) {
    if (!this.initialized) await this.initialize();

    try {
      const docRef = this.firestore.collection(collection).doc(documentId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return null;
      }

      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error('[FirebaseService] Error getting document:', error);
      throw error;
    }
  }

  /**
   * Create a new document
   */
  async createDocument(collection, data, documentId = null) {
    if (!this.initialized) await this.initialize();

    try {
      if (documentId) {
        // Use specific ID
        const docRef = this.firestore.collection(collection).doc(documentId);
        await docRef.set(data);
        return { id: documentId, ...data };
      } else {
        // Auto-generate ID
        const docRef = await this.firestore.collection(collection).add(data);
        return { id: docRef.id, ...data };
      }
    } catch (error) {
      console.error('[FirebaseService] Error creating document:', error);
      throw error;
    }
  }

  /**
   * Update a document
   */
  async updateDocument(collection, documentId, updates) {
    if (!this.initialized) await this.initialize();

    try {
      const docRef = this.firestore.collection(collection).doc(documentId);
      await docRef.update({
        ...updates,
        updatedAt: new Date().toISOString()
      });

      return await this.getDocument(collection, documentId);
    } catch (error) {
      console.error('[FirebaseService] Error updating document:', error);
      throw error;
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(collection, documentId) {
    if (!this.initialized) await this.initialize();

    try {
      const docRef = this.firestore.collection(collection).doc(documentId);
      await docRef.delete();
      return { success: true, id: documentId };
    } catch (error) {
      console.error('[FirebaseService] Error deleting document:', error);
      throw error;
    }
  }

  /**
   * Query documents with filters
   */
  async queryDocuments(collection, filters = {}, options = {}) {
    if (!this.initialized) await this.initialize();

    try {
      let query = this.firestore.collection(collection);

      // Apply filters
      Object.entries(filters).forEach(([field, value]) => {
        query = query.where(field, '==', value);
      });

      // Apply ordering
      if (options.orderBy) {
        query = query.orderBy(options.orderBy, options.order || 'asc');
      }

      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('[FirebaseService] Error querying documents:', error);
      throw error;
    }
  }

  /**
   * Get all documents in a collection with tenant filter
   */
  async getCollectionByTenant(collection, tenantId, options = {}) {
    return this.queryDocuments(collection, { tenantId }, options);
  }

  /**
   * Batch create documents
   */
  async batchCreate(collection, documents) {
    if (!this.initialized) await this.initialize();

    try {
      const batch = this.firestore.batch();
      const results = [];

      documents.forEach(doc => {
        const docRef = this.firestore.collection(collection).doc();
        batch.set(docRef, doc);
        results.push({ id: docRef.id, ...doc });
      });

      await batch.commit();
      return results;
    } catch (error) {
      console.error('[FirebaseService] Error batch creating:', error);
      throw error;
    }
  }

  /**
   * Check if document exists
   */
  async documentExists(collection, documentId) {
    if (!this.initialized) await this.initialize();

    try {
      const docRef = this.firestore.collection(collection).doc(documentId);
      const doc = await docRef.get();
      return doc.exists;
    } catch (error) {
      console.error('[FirebaseService] Error checking document existence:', error);
      throw error;
    }
  }

  /**
   * Get restaurant profile by tenantId
   */
  async getRestaurantProfile(tenantId) {
    return this.getDocument('organizations', tenantId);
  }

  /**
   * Create restaurant profile
   */
  async createRestaurantProfile(profileData) {
    const data = {
      ...profileData,
      status: profileData.status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return this.createDocument('organizations', data, profileData.tenantId);
  }

  /**
   * Update restaurant profile
   */
  async updateRestaurantProfile(tenantId, updates) {
    return this.updateDocument('organizations', tenantId, updates);
  }

  /**
   * Get menu items for a tenant
   */
  async getMenuItems(tenantId, filters = {}) {
    const allFilters = {
      tenantId,
      type: 'menu_item',
      ...filters
    };

    return this.queryDocuments('tenant_content', allFilters);
  }

  /**
   * Create menu item
   */
  async createMenuItem(tenantId, itemData) {
    const data = {
      tenantId,
      type: 'menu_item',
      ...itemData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return this.createDocument('tenant_content', data);
  }

  /**
   * Update menu item
   */
  async updateMenuItem(itemId, updates) {
    return this.updateDocument('tenant_content', itemId, updates);
  }

  /**
   * Delete menu item
   */
  async deleteMenuItem(itemId) {
    return this.deleteDocument('tenant_content', itemId);
  }

  /**
   * Get content documents for a tenant
   */
  async getContentDocuments(tenantId, type = null) {
    const filters = { tenantId };

    if (type) {
      filters.type = type;
    }

    return this.queryDocuments('tenant_content', filters);
  }

  /**
   * Create content document
   */
  async createContentDocument(tenantId, contentData) {
    const data = {
      tenantId,
      ...contentData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return this.createDocument('tenant_content', data);
  }

  /**
   * Get AI configuration for a tenant
   */
  async getAIConfig(tenantId) {
    return this.getDocument('ai_config', tenantId);
  }

  /**
   * Update AI configuration
   */
  async updateAIConfig(tenantId, config) {
    const exists = await this.documentExists('ai_config', tenantId);

    if (exists) {
      return this.updateDocument('ai_config', tenantId, config);
    } else {
      return this.createDocument('ai_config', { ...config, tenantId }, tenantId);
    }
  }
}

// Singleton instance
let firebaseService = null;

export function getFirebaseService(config) {
  if (!firebaseService) {
    firebaseService = new FirebaseService(config);
  }
  return firebaseService;
}

export default FirebaseService;
