/**
 * CapnWeb RPC Client for Backend Display Operations
 * Replaces HTTP-based DisplayApiClient with RPC calls
 */

import { newHttpBatchRpcSession } from 'capnweb';

/**
 * Display RPC Client for backend services
 * Uses CapnWeb HTTP batch RPC to communicate with Display Worker Durable Objects
 */
export class DisplayRpcClient {
  constructor(config) {
    this.baseUrl = config.cloudflare.workerUrl || 'https://stonepot-restaurant-display.suyesh.workers.dev';
    this.authToken = config.cloudflare.authToken;

    // Ensure baseUrl doesn't have trailing slash
    this.baseUrl = this.baseUrl.replace(/\/$/, '');

    // RPC session cache by session ID
    this.rpcSessions = new Map();
  }

  /**
   * Get or create RPC session for a session ID
   * @param {string} sessionId
   * @returns {Promise<object>} RPC stub to DisplayRPC interface
   */
  async getRpcStub(sessionId) {
    if (this.rpcSessions.has(sessionId)) {
      return this.rpcSessions.get(sessionId);
    }

    // Create new HTTP batch RPC session
    const rpcUrl = `${this.baseUrl}/session/${sessionId}/rpc`;

    console.log('[DisplayRpcClient] Creating RPC session for:', sessionId, 'at:', rpcUrl);

    // Create RPC stub using HTTP batch mode
    const stub = newHttpBatchRpcSession(rpcUrl, {
      headers: this.authToken ? {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      } : {
        'Content-Type': 'application/json'
      }
    });

    this.rpcSessions.set(sessionId, stub);
    return stub;
  }

  /**
   * Initialize a new session
   * @param {string} sessionId
   * @param {string} tenantId
   * @param {string} category
   * @returns {Promise<{success: boolean}>}
   */
  async initializeSession(sessionId, tenantId, category = 'restaurant') {
    try {
      const stub = await this.getRpcStub(sessionId);
      const result = await stub.initSession(tenantId, category);

      console.log('[DisplayRpcClient] Session initialized:', {
        sessionId,
        tenantId,
        category,
        success: result.success
      });

      return result;
    } catch (error) {
      console.error('[DisplayRpcClient] Failed to initialize session:', error);
      throw error;
    }
  }

  /**
   * Send a dish card display update
   * @param {string} sessionId
   * @param {object} dish
   * @returns {Promise<void>}
   */
  async sendDishCard(sessionId, dish) {
    try {
      console.log('[DisplayRpcClient] Sending dish_card via RPC:', {
        sessionId,
        dishName: dish.name,
        hasImage: !!(dish.image || dish.imageUrl),
        hasChoices: !!dish.choices
      });

      const stub = await this.getRpcStub(sessionId);

      // Call RPC method directly - much cleaner than HTTP POST!
      await stub.showDish({
        name: dish.name,
        description: dish.description,
        price: dish.price,
        imageUrl: dish.image || dish.imageUrl,
        type: dish.type,
        category: dish.category,
        dietary: dish.dietary || dish.dietaryTags || [],
        spiceLevel: dish.spiceLevel || 0,
        available: dish.available !== false,
        preparationTime: dish.preparationTime,
        choices: dish.choices,
        rating: dish.rating,
        tag: dish.tag,
        actions: dish.actions
      });

      console.log('[DisplayRpcClient] Dish card sent successfully:', dish.name);
    } catch (error) {
      console.error('[DisplayRpcClient] Failed to send dish card:', error);
      throw error;
    }
  }

  /**
   * Send a transcription update
   * @param {string} sessionId
   * @param {object} transcription
   * @returns {Promise<void>}
   */
  async sendTranscription(sessionId, transcription) {
    try {
      const stub = await this.getRpcStub(sessionId);

      await stub.addTranscription({
        text: transcription.text,
        speaker: transcription.speaker || 'user',
        timestamp: transcription.timestamp || Date.now(),
        isFinal: transcription.isFinal !== false
      });

      console.log('[DisplayRpcClient] Transcription sent');
    } catch (error) {
      console.error('[DisplayRpcClient] Failed to send transcription:', error);
      throw error;
    }
  }

  /**
   * Send order summary update
   * @param {string} sessionId
   * @param {object} summary
   * @returns {Promise<void>}
   */
  async sendOrderSummary(sessionId, summary) {
    try {
      const stub = await this.getRpcStub(sessionId);

      await stub.showOrderSummary({
        items: summary.items,
        subtotal: summary.subtotal,
        tax: summary.tax,
        total: summary.total
      });

      console.log('[DisplayRpcClient] Order summary sent:', summary.items.length, 'items');
    } catch (error) {
      console.error('[DisplayRpcClient] Failed to send order summary:', error);
      throw error;
    }
  }

  /**
   * Send cart item added notification
   * @param {string} sessionId
   * @param {object} item
   * @returns {Promise<void>}
   */
  async sendCartItemAdded(sessionId, item) {
    try {
      const stub = await this.getRpcStub(sessionId);

      await stub.showCartItemAdded({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        choices: item.choices
      });

      console.log('[DisplayRpcClient] Cart item added sent:', item.name);
    } catch (error) {
      console.error('[DisplayRpcClient] Failed to send cart item added:', error);
      throw error;
    }
  }

  /**
   * Update cart display
   * @param {string} sessionId
   * @param {Array} items
   * @returns {Promise<void>}
   */
  async updateCart(sessionId, items) {
    try {
      const stub = await this.getRpcStub(sessionId);

      await stub.updateCart(items.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        choices: item.choices
      })));

      console.log('[DisplayRpcClient] Cart updated:', items.length, 'items');
    } catch (error) {
      console.error('[DisplayRpcClient] Failed to update cart:', error);
      throw error;
    }
  }

  /**
   * Clear current display
   * @param {string} sessionId
   * @returns {Promise<void>}
   */
  async clearDisplay(sessionId) {
    try {
      const stub = await this.getRpcStub(sessionId);
      await stub.clearDisplay();

      console.log('[DisplayRpcClient] Display cleared');
    } catch (error) {
      console.error('[DisplayRpcClient] Failed to clear display:', error);
      throw error;
    }
  }

  /**
   * Get current conversation state
   * @param {string} sessionId
   * @returns {Promise<object>} Conversation state
   */
  async getState(sessionId) {
    try {
      const stub = await this.getRpcStub(sessionId);
      const state = await stub.getState();

      console.log('[DisplayRpcClient] Got state:', {
        sessionId,
        transcriptionCount: state.transcriptions?.length,
        displayUpdateCount: state.displayUpdates?.length
      });

      return state;
    } catch (error) {
      console.error('[DisplayRpcClient] Failed to get state:', error);
      throw error;
    }
  }
}
