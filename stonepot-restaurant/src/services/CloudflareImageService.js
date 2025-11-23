/**
 * Cloudflare Images Service
 * Handles image upload, deletion, and URL generation for dish photos
 */

import FormData from 'form-data';
import fetch from 'node-fetch';

export class CloudflareImageService {
  constructor(config) {
    this.accountId = config.cloudflare?.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    this.apiToken = config.cloudflare?.apiToken || process.env.CLOUDFLARE_API_TOKEN;
    this.accountHash = config.cloudflare?.imagesAccountHash || process.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH;

    if (!this.accountId || !this.apiToken) {
      console.warn('[CloudflareImageService] Missing account ID or API token - image uploads will fail');
    }

    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1`;
  }

  /**
   * Upload an image to Cloudflare Images
   * @param {Buffer} imageBuffer - Image file buffer
   * @param {Object} metadata - Image metadata
   * @returns {Object} Upload result with URLs
   */
  async uploadImage(imageBuffer, metadata = {}) {
    try {
      if (!this.accountId || !this.apiToken) {
        throw new Error('Cloudflare Images not configured - missing account ID or API token');
      }

      const formData = new FormData();
      formData.append('file', imageBuffer, {
        filename: metadata.filename || 'image.jpg',
        contentType: metadata.contentType || 'image/jpeg'
      });

      // Optional: Custom ID for the image
      if (metadata.id) {
        formData.append('id', metadata.id);
      }

      // Optional: Require signed URLs
      if (metadata.requireSignedURLs) {
        formData.append('requireSignedURLs', 'true');
      }

      // Optional: Add metadata as JSON
      if (metadata.metadata) {
        formData.append('metadata', JSON.stringify(metadata.metadata));
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          ...formData.getHeaders()
        },
        body: formData
      });

      const result = await response.json();

      if (!result.success) {
        const errorMsg = result.errors?.[0]?.message || 'Unknown error';
        throw new Error(`Image upload failed: ${errorMsg}`);
      }

      console.log('[CloudflareImageService] Image uploaded successfully', {
        id: result.result.id,
        filename: result.result.filename
      });

      return {
        success: true,
        id: result.result.id,
        filename: result.result.filename,
        uploaded: result.result.uploaded,
        requireSignedURLs: result.result.requireSignedURLs,
        variants: result.result.variants,
        publicUrl: this.getImageUrl(result.result.id, 'public')
      };
    } catch (error) {
      console.error('[CloudflareImageService] Upload error:', error);
      throw error;
    }
  }

  /**
   * Generate image URL with variant
   * @param {string} imageId - Cloudflare image ID
   * @param {string} variant - Variant name (public, thumbnail, medium, etc.)
   * @returns {string} Image URL
   */
  getImageUrl(imageId, variant = 'public') {
    if (!this.accountHash) {
      console.warn('[CloudflareImageService] Missing account hash - cannot generate image URL');
      return null;
    }

    return `https://imagedelivery.net/${this.accountHash}/${imageId}/${variant}`;
  }

  /**
   * Get all variant URLs for an image
   * @param {string} imageId - Cloudflare image ID
   * @returns {Object} Object with all variant URLs
   */
  getImageVariants(imageId) {
    if (!this.accountHash) {
      return null;
    }

    return {
      public: this.getImageUrl(imageId, 'public'),
      thumbnail: this.getImageUrl(imageId, 'thumbnail'),
      medium: this.getImageUrl(imageId, 'medium')
    };
  }

  /**
   * Delete an image from Cloudflare
   * @param {string} imageId - Cloudflare image ID
   * @returns {Object} Deletion result
   */
  async deleteImage(imageId) {
    try {
      if (!this.accountId || !this.apiToken) {
        throw new Error('Cloudflare Images not configured');
      }

      const response = await fetch(`${this.baseUrl}/${imageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (!result.success) {
        const errorMsg = result.errors?.[0]?.message || 'Unknown error';
        throw new Error(`Image deletion failed: ${errorMsg}`);
      }

      console.log('[CloudflareImageService] Image deleted successfully', { imageId });

      return {
        success: true,
        id: imageId
      };
    } catch (error) {
      console.error('[CloudflareImageService] Delete error:', error);
      throw error;
    }
  }

  /**
   * Get image details
   * @param {string} imageId - Cloudflare image ID
   * @returns {Object} Image details
   */
  async getImage(imageId) {
    try {
      if (!this.accountId || !this.apiToken) {
        throw new Error('Cloudflare Images not configured');
      }

      const response = await fetch(`${this.baseUrl}/${imageId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (!result.success) {
        const errorMsg = result.errors?.[0]?.message || 'Unknown error';
        throw new Error(`Failed to get image: ${errorMsg}`);
      }

      return result.result;
    } catch (error) {
      console.error('[CloudflareImageService] Get image error:', error);
      throw error;
    }
  }

  /**
   * List all images (paginated)
   * @param {Object} options - Pagination options
   * @returns {Object} List of images
   */
  async listImages(options = {}) {
    try {
      if (!this.accountId || !this.apiToken) {
        throw new Error('Cloudflare Images not configured');
      }

      const params = new URLSearchParams();
      if (options.page) params.append('page', options.page);
      if (options.per_page) params.append('per_page', options.per_page);

      const url = `${this.baseUrl}?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (!result.success) {
        const errorMsg = result.errors?.[0]?.message || 'Unknown error';
        throw new Error(`Failed to list images: ${errorMsg}`);
      }

      return {
        images: result.result.images,
        total: result.result.images.length
      };
    } catch (error) {
      console.error('[CloudflareImageService] List images error:', error);
      throw error;
    }
  }

  /**
   * Check if service is configured
   * @returns {boolean}
   */
  isConfigured() {
    return !!(this.accountId && this.apiToken && this.accountHash);
  }

  /**
   * Clean filename for fuzzy matching
   * Removes extensions, special chars, numbers
   * @param {string} filename - Original filename
   * @returns {string} Cleaned name
   */
  cleanFilename(filename) {
    return filename
      .replace(/\.(jpe?g|png|webp|heic|gif)$/i, '') // Remove extension
      .replace(/[-_\s\d\(\)\[\]]/g, ' ')             // Replace separators with space
      .replace(/\s+/g, ' ')                          // Collapse multiple spaces
      .trim()
      .toLowerCase();
  }

  /**
   * Normalize string for matching (remove all non-alphanumeric)
   * @param {string} str - String to normalize
   * @returns {string} Normalized string
   */
  normalizeForMatching(str) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  /**
   * Fuzzy match two strings
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {boolean} True if strings match
   */
  fuzzyMatch(a, b) {
    const normA = this.normalizeForMatching(a);
    const normB = this.normalizeForMatching(b);

    // Exact match after normalization
    if (normA === normB) return true;

    // One contains the other
    if (normA.includes(normB) || normB.includes(normA)) return true;

    // Check if majority of characters match (70% threshold)
    const longer = normA.length > normB.length ? normA : normB;
    const shorter = normA.length > normB.length ? normB : normA;

    if (shorter.length === 0) return false;

    let matchCount = 0;
    for (const char of shorter) {
      if (longer.includes(char)) matchCount++;
    }

    return (matchCount / shorter.length) >= 0.7;
  }

  /**
   * Match image filename to menu items
   * Supports multi-language matching
   * @param {string} filename - Image filename
   * @param {Array} menuItems - Array of menu items with name/nameLocal
   * @returns {Object|null} Matched menu item or null
   */
  matchImageToMenuItem(filename, menuItems) {
    const cleanName = this.cleanFilename(filename);

    console.log('[CloudflareImageService] Matching image', {
      filename,
      cleanName,
      menuItemCount: menuItems.length
    });

    // Try exact and fuzzy matching
    for (const item of menuItems) {
      // Match against English name
      if (this.fuzzyMatch(cleanName, item.name)) {
        console.log('[CloudflareImageService] Matched to English name', {
          filename,
          matchedItem: item.name
        });
        return item;
      }

      // Match against local name if available
      if (item.nameLocal && this.fuzzyMatch(cleanName, item.nameLocal)) {
        console.log('[CloudflareImageService] Matched to local name', {
          filename,
          matchedItem: item.name,
          localName: item.nameLocal
        });
        return item;
      }
    }

    console.log('[CloudflareImageService] No match found for', { filename });
    return null;
  }

  /**
   * Batch match multiple images to menu items
   * @param {Array} files - Array of {filename, buffer} objects
   * @param {Array} menuItems - Array of menu items
   * @returns {Array} Array of {file, matchedItem, confidence}
   */
  batchMatchImages(files, menuItems) {
    return files.map(file => {
      const matched = this.matchImageToMenuItem(file.filename, menuItems);
      return {
        filename: file.filename,
        buffer: file.buffer,
        matchedItem: matched,
        matched: !!matched
      };
    });
  }
}

export default CloudflareImageService;
