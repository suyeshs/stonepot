/**
 * Mock Payment Service for Testing
 * Simulates Razorpay payment flow without requiring actual API credentials
 */

export class MockPaymentService {
  constructor() {
    this.enabled = true;
    console.log('[MockPayment] Service initialized (TEST MODE)');
  }

  /**
   * Create a mock payment order
   * @param {Object} params - Order parameters
   * @returns {Promise<Object>} Mock Razorpay order
   */
  async createPaymentOrder({ amount, orderId, customer, currency = 'INR' }) {
    console.log('[MockPayment] Creating mock payment order:', {
      amount,
      orderId,
      customerName: customer.name
    });

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Convert amount to paise (Razorpay uses smallest currency unit)
    const amountInPaise = Math.round(amount * 100);

    // Generate mock Razorpay order
    const mockOrder = {
      id: `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      entity: 'order',
      amount: amountInPaise,
      amountInRupees: amount,
      amount_paid: 0,
      amount_due: amountInPaise,
      currency,
      receipt: orderId,
      status: 'created',
      attempts: 0,
      notes: {
        orderId,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email || ''
      },
      created_at: Math.floor(Date.now() / 1000)
    };

    console.log('[MockPayment] Mock order created:', mockOrder.id);

    return mockOrder;
  }

  /**
   * Verify mock payment signature (always returns true for testing)
   * @param {Object} params - Payment verification parameters
   * @returns {boolean} Verification result
   */
  verifyPaymentSignature({ orderId, paymentId, signature }) {
    console.log('[MockPayment] Verifying payment signature (MOCK):', {
      orderId,
      paymentId
    });

    // In mock mode, always verify successfully
    return true;
  }

  /**
   * Simulate payment capture
   * @param {string} paymentId - Payment ID
   * @param {number} amount - Amount to capture
   * @returns {Promise<Object>} Payment details
   */
  async capturePayment(paymentId, amount) {
    console.log('[MockPayment] Capturing payment (MOCK):', { paymentId, amount });

    await new Promise(resolve => setTimeout(resolve, 300));

    return {
      id: paymentId,
      entity: 'payment',
      amount: Math.round(amount * 100),
      currency: 'INR',
      status: 'captured',
      method: 'mock',
      captured: true,
      created_at: Math.floor(Date.now() / 1000)
    };
  }

  /**
   * Fetch mock payment details
   * @param {string} paymentId - Payment ID
   * @returns {Promise<Object>} Payment details
   */
  async fetchPayment(paymentId) {
    console.log('[MockPayment] Fetching payment (MOCK):', paymentId);

    await new Promise(resolve => setTimeout(resolve, 200));

    return {
      id: paymentId,
      entity: 'payment',
      amount: 0, // Will be set by caller
      currency: 'INR',
      status: 'captured',
      method: 'mock',
      captured: true,
      email: 'test@example.com',
      contact: '+919999999999',
      created_at: Math.floor(Date.now() / 1000)
    };
  }

  /**
   * Create mock refund
   * @param {string} paymentId - Payment ID
   * @param {number} amount - Amount to refund
   * @returns {Promise<Object>} Refund details
   */
  async createRefund(paymentId, amount) {
    console.log('[MockPayment] Creating refund (MOCK):', { paymentId, amount });

    await new Promise(resolve => setTimeout(resolve, 400));

    return {
      id: `rfnd_mock_${Date.now()}`,
      entity: 'refund',
      amount: Math.round(amount * 100),
      currency: 'INR',
      payment_id: paymentId,
      status: 'processed',
      created_at: Math.floor(Date.now() / 1000)
    };
  }

  /**
   * Handle mock webhook events (for testing webhook flow)
   * @param {Object} event - Webhook event
   * @returns {Object} Processing result
   */
  handleWebhookEvent(event) {
    console.log('[MockPayment] Webhook event received (MOCK):', event.event);

    const eventMap = {
      'payment.captured': {
        processed: true,
        action: 'payment_captured',
        orderId: event.payload?.payment?.entity?.notes?.orderId,
        paymentId: event.payload?.payment?.entity?.id,
        amount: event.payload?.payment?.entity?.amount,
        status: 'captured'
      },
      'payment.failed': {
        processed: true,
        action: 'payment_failed',
        orderId: event.payload?.payment?.entity?.notes?.orderId,
        paymentId: event.payload?.payment?.entity?.id,
        errorCode: event.payload?.payment?.entity?.error_code,
        errorDescription: event.payload?.payment?.entity?.error_description,
        status: 'failed'
      },
      'order.paid': {
        processed: true,
        action: 'order_paid',
        orderId: event.payload?.order?.entity?.receipt,
        razorpayOrderId: event.payload?.order?.entity?.id,
        amountPaid: event.payload?.order?.entity?.amount_paid,
        status: 'paid'
      }
    };

    return eventMap[event.event] || {
      processed: false,
      event: event.event,
      message: 'Unknown event type'
    };
  }

  /**
   * Verify webhook signature (always returns true in mock mode)
   * @param {string} signature - Webhook signature
   * @param {string} body - Request body
   * @returns {boolean} Verification result
   */
  verifyWebhookSignature(signature, body) {
    console.log('[MockPayment] Verifying webhook signature (MOCK) - always returns true');
    return true;
  }
}

export default MockPaymentService;
