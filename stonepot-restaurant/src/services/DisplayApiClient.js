/**
 * Display API Client for Theme Edge Worker Integration
 * Sends real-time display updates to ConversationSession Durable Object
 */

export class DisplayApiClient {
  constructor(config) {
    this.baseUrl = config.cloudflare.workerUrl || 'https://theme-edge-worker.suyesh.workers.dev';
    this.authToken = config.cloudflare.authToken;

    // Ensure baseUrl doesn't have trailing slash
    this.baseUrl = this.baseUrl.replace(/\/$/, '');
  }

  /**
   * Initialize a new conversation session
   */
  async initializeSession(sessionId, tenantId, category = 'restaurant') {
    try {
      const response = await fetch(`${this.baseUrl}/conversation/${sessionId}/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        },
        body: JSON.stringify({
          tenantId,
          category
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to initialize session: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[DisplayAPI] Session initialized:`, {
        sessionId,
        tenantId,
        category,
        success: data.success
      });

      return data;
    } catch (error) {
      console.error('[DisplayAPI] Failed to initialize session:', error);
      throw error;
    }
  }

  /**
   * Send a transcription update
   */
  async sendTranscription(sessionId, text, speaker = 'user', isFinal = true) {
    return this.sendUpdate(sessionId, {
      type: 'transcription',
      data: {
        text,
        speaker,
        isFinal,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Send a dish card display update
   */
  async sendDishCard(sessionId, dish) {
    console.log('[DisplayAPI] Sending dish_card update:', {
      sessionId,
      dishName: dish.name,
      hasImage: !!(dish.image || dish.imageUrl),
      hasChoices: !!dish.choices,
      url: `${this.baseUrl}/conversation/${sessionId}/update`
    });

    return this.sendUpdate(sessionId, {
      type: 'dish_card',
      data: {
        name: dish.name,
        description: dish.description,
        price: dish.price,
        imageUrl: dish.image || dish.imageUrl, // Support both field names
        type: dish.type, // veg or non-veg
        category: dish.category,
        dietary: dish.dietary || dish.dietaryTags || [],
        spiceLevel: dish.spiceLevel || 0,
        available: dish.available !== false,
        preparationTime: dish.preparationTime,
        choices: dish.choices, // For combo items
        rating: dish.rating,
        tag: dish.tag
      }
    });
  }

  /**
   * Send a menu section display update
   */
  async sendMenuSection(sessionId, section) {
    return this.sendUpdate(sessionId, {
      type: 'menu_section',
      data: {
        title: section.title,
        items: section.items,
        description: section.description
      }
    });
  }

  /**
   * Send an order summary display update
   */
  async sendOrderSummary(sessionId, order) {
    return this.sendUpdate(sessionId, {
      type: 'order_summary',
      data: {
        items: order.items,
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total,
        estimatedTime: order.estimatedTime
      }
    });
  }

  /**
   * Send an order update (item added/removed/modified)
   */
  async sendOrderUpdate(sessionId, update) {
    return this.sendUpdate(sessionId, {
      type: 'order_update',
      data: {
        action: update.action, // 'added', 'removed', 'modified'
        item: update.item,
        message: update.message
      }
    });
  }

  /**
   * Send a confirmation display update
   */
  async sendConfirmation(sessionId, confirmation) {
    return this.sendUpdate(sessionId, {
      type: 'confirmation',
      data: {
        message: confirmation.message,
        orderId: confirmation.orderId,
        estimatedTime: confirmation.estimatedTime,
        paymentMethod: confirmation.paymentMethod
      }
    });
  }

  /**
   * Send an advice card display update
   */
  async sendAdviceCard(sessionId, advice) {
    return this.sendUpdate(sessionId, {
      type: 'advice_card',
      data: {
        title: advice.title,
        content: advice.content,
        icon: advice.icon,
        actionText: advice.actionText,
        actionUrl: advice.actionUrl
      }
    });
  }

  /**
   * Send a webpage display update
   */
  async sendWebpage(sessionId, url, title) {
    return this.sendUpdate(sessionId, {
      type: 'webpage',
      data: {
        url,
        title
      }
    });
  }

  /**
   * Send a snippet/code display update
   */
  async sendSnippet(sessionId, snippet) {
    return this.sendUpdate(sessionId, {
      type: 'snippet',
      data: {
        code: snippet.code,
        language: snippet.language,
        title: snippet.title
      }
    });
  }

  /**
   * Generic method to send any display update
   */
  async sendUpdate(sessionId, update) {
    try {
      const response = await fetch(`${this.baseUrl}/conversation/${sessionId}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        },
        body: JSON.stringify(update)
      });

      if (!response.ok) {
        throw new Error(`Failed to send update: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[DisplayAPI] Update sent:`, {
        sessionId,
        type: update.type,
        success: data.success,
        connectedClients: data.connectedClients
      });

      return data;
    } catch (error) {
      console.error('[DisplayAPI] Failed to send update:', error);
      throw error;
    }
  }

  /**
   * Get current session state
   */
  async getSessionState(sessionId) {
    try {
      const response = await fetch(`${this.baseUrl}/conversation/${sessionId}/state`, {
        headers: {
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get session state: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[DisplayAPI] Failed to get session state:', error);
      throw error;
    }
  }

  /**
   * Get the UI URL for displaying the conversation interface
   */
  getConversationUIUrl(sessionId, tenantId, category = 'restaurant') {
    const params = new URLSearchParams({
      session: sessionId,
      tenant: tenantId,
      category
    });
    return `${this.baseUrl}/ui/conversation?${params.toString()}`;
  }
}

export default DisplayApiClient;
