/**
 * Payment Service
 * Handles Razorpay payment integration
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';

export class PaymentService {
  constructor(config) {
    this.config = config.razorpay || {};
    this.enabled = !!(this.config.keyId && this.config.keySecret);

    if (!this.enabled) {
      console.warn('[Payment] Razorpay credentials not configured. Payment features will be disabled.');
      this.client = null;
    } else {
      this.client = new Razorpay({
        key_id: this.config.keyId,
        key_secret: this.config.keySecret
      });
      console.log('[Payment] Razorpay client initialized');
    }

    this.webhookSecret = this.config.webhookSecret;
  }

  /**
   * Create a Razorpay payment order
   * @param {Object} params - Order parameters
   * @param {number} params.amount - Amount in ₹ (will be converted to paise)
   * @param {string} params.orderId - Internal order ID
   * @param {Object} params.customer - Customer details
   * @param {string} [params.currency='INR'] - Currency code
   * @returns {Promise<Object>} Razorpay order object
   */
  async createPaymentOrder({ amount, orderId, customer, currency = 'INR' }) {
    if (!this.enabled) {
      throw new Error('Razorpay payment is not configured');
    }

    try {
      console.log('[Payment] Creating Razorpay order:', {
        amount,
        orderId,
        customer: customer.name
      });

      // Razorpay expects amount in paise (multiply by 100)
      const amountInPaise = Math.round(amount * 100);

      const razorpayOrder = await this.client.orders.create({
        amount: amountInPaise,
        currency,
        receipt: orderId,
        notes: {
          orderId,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerEmail: customer.email || ''
        }
      });

      console.log('[Payment] Razorpay order created:', {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency
      });

      return {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        amountInRupees: amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
        status: razorpayOrder.status,
        createdAt: razorpayOrder.created_at
      };
    } catch (error) {
      console.error('[Payment] Order creation failed:', error);
      throw new Error(`Failed to create payment order: ${error.message}`);
    }
  }

  /**
   * Verify Razorpay payment signature
   * @param {Object} params - Verification parameters
   * @param {string} params.orderId - Razorpay order ID
   * @param {string} params.paymentId - Razorpay payment ID
   * @param {string} params.signature - Payment signature
   * @returns {boolean} True if signature is valid
   */
  verifyPaymentSignature({ orderId, paymentId, signature }) {
    if (!this.enabled) {
      throw new Error('Razorpay payment is not configured');
    }

    try {
      console.log('[Payment] Verifying signature:', {
        orderId,
        paymentId
      });

      const text = `${orderId}|${paymentId}`;
      const generatedSignature = crypto
        .createHmac('sha256', this.config.keySecret)
        .update(text)
        .digest('hex');

      const isValid = generatedSignature === signature;

      console.log('[Payment] Signature verification:', {
        valid: isValid
      });

      return isValid;
    } catch (error) {
      console.error('[Payment] Signature verification error:', error);
      return false;
    }
  }

  /**
   * Fetch payment details from Razorpay
   * @param {string} paymentId - Razorpay payment ID
   * @returns {Promise<Object>} Payment details
   */
  async getPaymentDetails(paymentId) {
    if (!this.enabled) {
      throw new Error('Razorpay payment is not configured');
    }

    try {
      console.log('[Payment] Fetching payment details:', paymentId);

      const payment = await this.client.payments.fetch(paymentId);

      return {
        id: payment.id,
        orderId: payment.order_id,
        amount: payment.amount / 100, // Convert paise to rupees
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        email: payment.email,
        contact: payment.contact,
        createdAt: payment.created_at,
        captured: payment.captured,
        description: payment.description,
        errorCode: payment.error_code,
        errorDescription: payment.error_description
      };
    } catch (error) {
      console.error('[Payment] Failed to fetch payment details:', error);
      throw new Error(`Failed to fetch payment: ${error.message}`);
    }
  }

  /**
   * Refund a payment
   * @param {string} paymentId - Razorpay payment ID
   * @param {number} [amount] - Amount to refund in ₹ (optional, full refund if not specified)
   * @param {Object} [notes] - Additional notes
   * @returns {Promise<Object>} Refund details
   */
  async refundPayment(paymentId, amount = null, notes = {}) {
    if (!this.enabled) {
      throw new Error('Razorpay payment is not configured');
    }

    try {
      console.log('[Payment] Creating refund:', {
        paymentId,
        amount
      });

      const refundData = {
        notes
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100); // Convert to paise
      }

      const refund = await this.client.payments.refund(paymentId, refundData);

      console.log('[Payment] Refund created:', {
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status
      });

      return {
        id: refund.id,
        paymentId: refund.payment_id,
        amount: refund.amount / 100,
        currency: refund.currency,
        status: refund.status,
        createdAt: refund.created_at
      };
    } catch (error) {
      console.error('[Payment] Refund failed:', error);
      throw new Error(`Failed to refund payment: ${error.message}`);
    }
  }

  /**
   * Verify Razorpay webhook signature
   * @param {string} webhookBody - Raw webhook body
   * @param {string} signature - X-Razorpay-Signature header
   * @returns {boolean} True if signature is valid
   */
  verifyWebhookSignature(webhookBody, signature) {
    if (!this.webhookSecret) {
      console.warn('[Payment] Webhook secret not configured, skipping verification');
      return true; // Allow in development
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(webhookBody)
        .digest('hex');

      return expectedSignature === signature;
    } catch (error) {
      console.error('[Payment] Webhook signature verification error:', error);
      return false;
    }
  }

  /**
   * Handle Razorpay webhook event
   * @param {Object} event - Webhook event object
   * @returns {Promise<Object>} Processing result
   */
  async handleWebhookEvent(event) {
    const { event: eventType, payload } = event;

    console.log('[Payment] Processing webhook event:', {
      type: eventType,
      entityType: payload.payment?.entity || payload.order?.entity || 'unknown'
    });

    switch (eventType) {
      case 'payment.captured':
        return await this.handlePaymentCaptured(payload.payment.entity);

      case 'payment.failed':
        return await this.handlePaymentFailed(payload.payment.entity);

      case 'order.paid':
        return await this.handleOrderPaid(payload.order.entity);

      case 'refund.created':
        return await this.handleRefundCreated(payload.refund.entity);

      case 'refund.processed':
        return await this.handleRefundProcessed(payload.refund.entity);

      default:
        console.log('[Payment] Unhandled webhook event:', eventType);
        return { processed: false, eventType };
    }
  }

  /**
   * Handle payment.captured event
   * @param {Object} payment - Payment entity
   * @returns {Promise<Object>} Processing result
   */
  async handlePaymentCaptured(payment) {
    console.log('[Payment] Payment captured:', {
      id: payment.id,
      orderId: payment.order_id,
      amount: payment.amount / 100
    });

    // This will be called by the webhook handler in routes
    // The route handler should update order status in Firebase
    return {
      processed: true,
      action: 'update_order_status',
      orderId: payment.notes?.orderId,
      razorpayPaymentId: payment.id,
      status: 'confirmed',
      amount: payment.amount / 100
    };
  }

  /**
   * Handle payment.failed event
   * @param {Object} payment - Payment entity
   * @returns {Promise<Object>} Processing result
   */
  async handlePaymentFailed(payment) {
    console.log('[Payment] Payment failed:', {
      id: payment.id,
      orderId: payment.order_id,
      errorCode: payment.error_code,
      errorDescription: payment.error_description
    });

    return {
      processed: true,
      action: 'update_order_status',
      orderId: payment.notes?.orderId,
      razorpayPaymentId: payment.id,
      status: 'payment_failed',
      error: {
        code: payment.error_code,
        description: payment.error_description
      }
    };
  }

  /**
   * Handle order.paid event
   * @param {Object} order - Order entity
   * @returns {Promise<Object>} Processing result
   */
  async handleOrderPaid(order) {
    console.log('[Payment] Order paid:', {
      id: order.id,
      amount: order.amount / 100
    });

    return {
      processed: true,
      action: 'update_order_status',
      orderId: order.notes?.orderId,
      razorpayOrderId: order.id,
      status: 'paid'
    };
  }

  /**
   * Handle refund.created event
   * @param {Object} refund - Refund entity
   * @returns {Promise<Object>} Processing result
   */
  async handleRefundCreated(refund) {
    console.log('[Payment] Refund created:', {
      id: refund.id,
      paymentId: refund.payment_id,
      amount: refund.amount / 100
    });

    return {
      processed: true,
      action: 'update_refund_status',
      refundId: refund.id,
      status: 'created'
    };
  }

  /**
   * Handle refund.processed event
   * @param {Object} refund - Refund entity
   * @returns {Promise<Object>} Processing result
   */
  async handleRefundProcessed(refund) {
    console.log('[Payment] Refund processed:', {
      id: refund.id,
      paymentId: refund.payment_id,
      amount: refund.amount / 100
    });

    return {
      processed: true,
      action: 'update_refund_status',
      refundId: refund.id,
      status: 'processed'
    };
  }

  /**
   * Get payment status enum
   * @returns {Object} Payment status constants
   */
  static get STATUS() {
    return {
      CREATED: 'created',
      AUTHORIZED: 'authorized',
      CAPTURED: 'captured',
      REFUNDED: 'refunded',
      FAILED: 'failed'
    };
  }
}

export default PaymentService;
