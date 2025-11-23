/**
 * File Search Service - TypeScript Implementation
 * Provides menu retrieval using Google Gemini File Search for scalable, token-efficient RAG
 *
 * Updated for @google/generative-ai SDK with proper TypeScript types
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import NodeCache from 'node-cache';

interface FileSearchConfig {
  fileSearch?: {
    enabled: boolean;
    apiKey?: string;
    stores: Record<string, string>; // tenantId -> fileSearchStore name
    defaultChunking?: any;
  };
}

interface CacheStats {
  enabled: boolean;
  cacheSize: number;
  tenants: string[];
  cacheExpiry: number;
}

interface StoreInfo {
  name: string;
  displayName: string;
}

export class FileSearchService {
  private enabled: boolean;
  private apiKey?: string;
  private stores: Record<string, string>;
  private cache: NodeCache;
  private genAI: GoogleGenerativeAI | null = null;

  constructor(config: FileSearchConfig) {
    this.enabled = config.fileSearch?.enabled || false;
    this.apiKey = config.fileSearch?.apiKey;
    this.stores = config.fileSearch?.stores || {};

    // Use node-cache with 30 minute TTL and automatic expiry checking
    this.cache = new NodeCache({
      stdTTL: 1800, // 30 minutes in seconds
      checkperiod: 600, // Check for expired entries every 10 minutes
      useClones: false // Better performance, store references directly
    });

    if (this.enabled && !this.apiKey) {
      console.warn('[FileSearchService] File Search enabled but no API key configured');
      this.enabled = false;
    }

    if (this.enabled && this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      console.log('[FileSearchService] Initialized with File Search stores:', Object.keys(this.stores));
    } else {
      console.log('[FileSearchService] File Search disabled - using static menu fallback');
    }
  }

  /**
   * Get menu context from File Search store
   * @param tenantId - Tenant identifier
   * @param language - Language code (en, hi, kn, ar, etc.)
   * @returns Menu context formatted for system prompt
   */
  async getMenuContext(tenantId: string, language: string = 'en'): Promise<string> {
    if (!this.enabled || !this.genAI) {
      throw new Error('File Search is not enabled');
    }

    // Check cache first (node-cache handles TTL automatically)
    const cacheKey = `menu_context_${tenantId}_${language}`;
    const cached = this.cache.get<string>(cacheKey);

    if (cached) {
      console.log('[FileSearchService] Using cached menu context for', tenantId);
      return cached;
    }

    // Get File Search store ID for tenant
    const storeId = this.stores[tenantId];
    if (!storeId) {
      throw new Error(`No File Search store configured for tenant: ${tenantId}`);
    }

    try {
      console.log('[FileSearchService] Querying File Search store:', storeId);

      // Construct query based on language
      const query = this.buildMenuQuery(language);

      // Query File Search using models.generateContent
      const result = await this.genAI.models.generateContent({
        model: 'gemini-1.5-flash', // Use stable model (not experimental)
        contents: [{ role: 'user', parts: [{ text: query }] }],
        tools: [{
          fileSearch: {
            fileSearchStoreNames: [storeId]
          }
        }],
        generationConfig: {
          temperature: 0.1, // Low temperature for factual retrieval
          maxOutputTokens: 4096 // Enough for large menus
        }
      });

      const menuContext = result.text();
      console.log('[FileSearchService] Retrieved menu context:', menuContext.length, 'characters');

      // Cache the result (node-cache automatically handles expiry)
      this.cache.set(cacheKey, menuContext);

      return menuContext;
    } catch (error: any) {
      console.error('[FileSearchService] Failed to query File Search:', error.message);
      throw error;
    }
  }

  /**
   * Query File Search for specific menu details during conversation
   * @param tenantId - Tenant identifier
   * @param query - Natural language query
   * @param language - Language code
   * @returns Search results
   */
  async searchMenuDetails(tenantId: string, query: string, language: string = 'en'): Promise<string> {
    if (!this.enabled || !this.genAI) {
      throw new Error('File Search is not enabled');
    }

    const storeId = this.stores[tenantId];
    if (!storeId) {
      throw new Error(`No File Search store configured for tenant: ${tenantId}`);
    }

    try {
      console.log('[FileSearchService] Searching menu details:', query);

      const result = await this.genAI.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{ role: 'user', parts: [{ text: query }] }],
        tools: [{
          fileSearch: {
            fileSearchStoreNames: [storeId]
          }
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048
        }
      });

      const searchResult = result.text();
      console.log('[FileSearchService] Search results:', searchResult.length, 'characters');

      return searchResult;
    } catch (error: any) {
      console.error('[FileSearchService] Search failed:', error.message);
      throw error;
    }
  }

  /**
   * Build query for menu retrieval based on language
   * @param language - Language code
   * @returns Query text optimized for the language
   */
  buildMenuQuery(language: string): string {
    const queries: Record<string, string> = {
      en: `Extract and return the complete restaurant menu in clean, structured text format.
Include every item with:
- Name of the dish
- Description
- Price
- Category (appetizers, mains, desserts, etc.)
- Dietary information (vegetarian, non-vegetarian, vegan, halal, etc.)
- Allergens (if any)
- Spice level (if applicable)
- Special tags (bestseller, chef's special, etc.)
- Image URL (if available)

Group items by categories. Format the output as a structured list that's easy for an AI assistant to reference when helping customers order food. Be exhaustive and accurate.`,

      hi: `सभी मेनू आइटम्स को निम्नलिखित जानकारी के साथ सूचीबद्ध करें:
- व्यंजन का नाम
- विवरण
- मूल्य
- श्रेणी (स्टार्टर, मुख्य व्यंजन, मिठाई, आदि)
- आहार जानकारी (शाकाहारी, मांसाहारी, वेगन, हलाल, आदि)
- एलर्जी की जानकारी
- मसाला स्तर (यदि लागू हो)
- विशेष टैग (बेस्टसेलर, शेफ स्पेशल, आदि)
- इमेज URL (यदि उपलब्ध हो)

आउटपुट को एक संरचित सूची के रूप में प्रारूपित करें जो ग्राहकों को खाना ऑर्डर करने में मदद करते समय AI सहायक के लिए संदर्भित करना आसान हो।`,

      kn: `ಈ ಕೆಳಗಿನ ಮಾಹಿತಿಯೊಂದಿಗೆ ಎಲ್ಲಾ ಮೆನು ಐಟಂಗಳನ್ನು ಪಟ್ಟಿ ಮಾಡಿ:
- ತಿನಿಸಿನ ಹೆಸರು
- ವಿವರಣೆ
- ಬೆಲೆ
- ವರ್ಗ (ಹಸಿವು, ಮುಖ್ಯ ತಿನಿಸುಗಳು, ಸಿಹಿತಿಂಡಿಗಳು, ಇತ್ಯಾದಿ)
- ಆಹಾರ ಮಾಹಿತಿ (ಶಾಕಾಹಾರಿ, ಮಾಂಸಾಹಾರಿ, ಸಸ್ಯಾಹಾರಿ, ಹಲಾಲ್, ಇತ್ಯಾದಿ)
- ಅಲರ್ಜಿ ಮಾಹಿತಿ
- ಮಸಾಲೆ ಮಟ್ಟ (ಅನ್ವಯವಾದರೆ)
- ವಿಶೇಷ ಟ್ಯಾಗ್‌ಗಳು (ಬೆಸ್ಟ್‌ಸೆಲ್ಲರ್, ಚೆಫ್ ಸ್ಪೆಷಲ್, ಇತ್ಯಾದಿ)
- ಚಿತ್ರ URL (ಲಭ್ಯವಿದ್ದರೆ)`,

      ar: `استخرج قائمة الطعام الكاملة بالعربية مع المعلومات التالية لكل صنف:
- اسم الطبق
- الوصف
- السعر
- الفئة (المقبلات، الأطباق الرئيسية، الحلويات، إلخ)
- معلومات النظام الغذائي (نباتي، غير نباتي، نباتي صرف، حلال، إلخ)
- معلومات الحساسية
- مستوى التوابل (إن وجد)
- علامات خاصة (الأكثر مبيعاً، خاص بالشيف، إلخ)
- رابط الصورة (إن وجد)

قم بتنسيق الناتج كقائمة منظمة يسهل على مساعد الذكاء الاصطناعي الرجوع إليها عند مساعدة العملاء في طلب الطعام.`
    };

    return queries[language] || queries.en;
  }

  /**
   * Create a new File Search store programmatically
   * Note: This uses GoogleAIFileManager for corpus management
   * @param displayName - Display name for the store
   * @returns Store details
   */
  async createStore(displayName: string): Promise<StoreInfo> {
    if (!this.genAI) {
      throw new Error('File Search not initialized - API key required');
    }

    try {
      console.log('[FileSearchService] Creating File Search store:', displayName);

      // Create store using fileSearchStores API
      const result = await this.genAI.fileSearchStores.create({
        displayName
      });

      console.log('[FileSearchService] Store created:', result.name);

      return {
        name: result.name,
        displayName: result.displayName || displayName
      };
    } catch (error: any) {
      console.error('[FileSearchService] Failed to create store:', error.message);
      throw error;
    }
  }

  /**
   * Upload file to File Search store with automatic indexing
   * Uses GoogleAIFileManager for file uploads
   * @param storeName - Full store name (e.g., fileSearchStores/xyz)
   * @param filePath - Path to file to upload
   * @param displayName - Display name for the file
   * @param chunkingConfig - Optional chunking configuration
   * @returns Upload operation result
   */
  async uploadToStore(
    storeName: string,
    filePath: string,
    displayName: string,
    chunkingConfig: any = null
  ): Promise<any> {
    if (!this.genAI) {
      throw new Error('File Search not initialized - API key required');
    }

    try {
      console.log('[FileSearchService] Uploading file to store:', storeName);

      // Upload file to File Search store
      const uploadResult = await this.genAI.fileSearchStores.uploadFile({
        fileSearchStoreName: storeName,
        file: filePath,
        displayName: displayName,
        chunkingConfig: chunkingConfig || {
          whiteSpaceConfig: {
            maxTokensPerChunk: 256,
            maxOverlapTokens: 32
          }
        }
      });

      console.log('[FileSearchService] File uploaded and indexed');

      return uploadResult;
    } catch (error: any) {
      console.error('[FileSearchService] Failed to upload file:', error.message);
      throw error;
    }
  }

  /**
   * List all uploaded files
   * @returns List of files
   */
  async listStores(): Promise<StoreInfo[]> {
    if (!this.genAI) {
      throw new Error('File Search not initialized - API key required');
    }

    try {
      const stores = await this.genAI.fileSearchStores.list();
      console.log('[FileSearchService] Found', stores.length, 'stores');

      return stores.map(store => ({
        name: store.name,
        displayName: store.displayName || store.name
      }));
    } catch (error: any) {
      console.error('[FileSearchService] Failed to list stores:', error.message);
      throw error;
    }
  }

  /**
   * Delete a File Search store
   * @param storeName - Full store name
   * @returns void
   */
  async deleteStore(storeName: string): Promise<void> {
    if (!this.genAI) {
      throw new Error('File Search not initialized - API key required');
    }

    try {
      console.log('[FileSearchService] Deleting store:', storeName);
      await this.genAI.fileSearchStores.delete({ name: storeName });
      console.log('[FileSearchService] Store deleted successfully');
    } catch (error: any) {
      console.error('[FileSearchService] Failed to delete store:', error.message);
      throw error;
    }
  }

  /**
   * Clear cache for a specific tenant or all tenants
   * @param tenantId - Optional tenant ID to clear specific cache
   */
  clearCache(tenantId: string | null = null): void {
    if (tenantId) {
      // Clear all language variants for this tenant
      const keys = this.cache.keys();
      keys.forEach(key => {
        if (key.includes(`_${tenantId}_`)) {
          this.cache.del(key);
        }
      });
      console.log('[FileSearchService] Cleared cache for tenant:', tenantId);
    } else {
      this.cache.flushAll();
      console.log('[FileSearchService] Cleared all cache');
    }
  }

  /**
   * Check if File Search is available for a tenant
   * @param tenantId - Tenant identifier
   * @returns boolean
   */
  isAvailableForTenant(tenantId: string): boolean {
    return this.enabled && Boolean(this.stores[tenantId]);
  }

  /**
   * Get cache statistics
   * @returns Cache stats including enabled status, size, and tenants
   */
  getCacheStats(): CacheStats {
    const keys = this.cache.keys();

    // Extract unique tenant IDs from cache keys (format: menu_context_TENANT_LANG)
    const tenantSet = new Set<string>();
    keys.forEach(key => {
      const parts = key.split('_');
      if (parts.length >= 3) {
        tenantSet.add(parts[2]); // Extract tenant ID
      }
    });

    return {
      enabled: this.enabled,
      cacheSize: keys.length,
      tenants: Array.from(tenantSet),
      cacheExpiry: 1800 // 30 minutes in seconds
    };
  }
}
