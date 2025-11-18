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
}

export default CloudflareImageService;
