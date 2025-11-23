/**
 * Tax Service - Indian GST Calculation
 * Handles GST calculation based on current Indian tax laws
 */

export class TaxService {
  constructor(config = {}) {
    // GST Rates for Restaurant Services in India (as of 2024)
    // Reference: https://www.cbic.gov.in/
    this.taxRates = {
      // Restaurant services WITHOUT AC, liquor license
      restaurant_non_ac: 0.05, // 5% GST (CGST 2.5% + SGST 2.5%)

      // Restaurant services WITH AC or liquor license
      restaurant_ac: 0.05, // 5% GST (CGST 2.5% + SGST 2.5%)

      // Food delivery/takeaway
      delivery: 0.05, // 5% GST

      // Default rate for food items
      default: 0.05 // 5% GST
    };

    // Configure which rate to use (can be overridden)
    this.defaultRate = config.taxRate || this.taxRates.default;

    console.log('[TaxService] Initialized with default GST rate:', this.defaultRate * 100 + '%');
  }

  /**
   * Calculate GST on an amount
   * @param {number} amount - Base amount (excluding tax)
   * @param {string} category - Tax category (optional)
   * @returns {Object} Tax breakdown
   */
  calculateGST(amount, category = 'default') {
    const taxRate = this.taxRates[category] || this.defaultRate;

    // Calculate GST
    const gstAmount = Math.round(amount * taxRate * 100) / 100;

    // GST is split equally between CGST and SGST (for intra-state)
    const cgst = Math.round(gstAmount * 50) / 100; // 50% of total GST
    const sgst = Math.round(gstAmount * 50) / 100; // 50% of total GST

    return {
      subtotal: amount,
      gstRate: taxRate,
      gstPercentage: taxRate * 100,
      gstAmount,
      cgst, // Central GST
      sgst, // State GST
      igst: 0, // Inter-state GST (not applicable for intra-state)
      totalWithTax: amount + gstAmount,
      breakdown: {
        'Subtotal': amount,
        'CGST (2.5%)': cgst,
        'SGST (2.5%)': sgst,
        'Total GST (5%)': gstAmount,
        'Grand Total': amount + gstAmount
      }
    };
  }

  /**
   * Calculate tax on order with delivery
   * @param {number} subtotal - Cart subtotal
   * @param {number} deliveryFee - Delivery charges
   * @param {string} orderType - Order type (delivery/pickup/dine-in)
   * @returns {Object} Complete tax calculation
   */
  calculateOrderTax(subtotal, deliveryFee = 0, orderType = 'delivery') {
    // Determine tax category based on order type
    const category = orderType === 'dine-in' ? 'restaurant_ac' : 'delivery';

    // Calculate GST on subtotal + delivery fee (both are taxable)
    const taxableAmount = subtotal + deliveryFee;
    const taxCalculation = this.calculateGST(taxableAmount, category);

    return {
      ...taxCalculation,
      deliveryFee,
      orderType,
      details: {
        itemsSubtotal: subtotal,
        deliveryFee: deliveryFee,
        taxableAmount: taxableAmount,
        gstAmount: taxCalculation.gstAmount,
        cgst: taxCalculation.cgst,
        sgst: taxCalculation.sgst,
        grandTotal: taxCalculation.totalWithTax
      }
    };
  }

  /**
   * Generate GST invoice/bill details
   * @param {Object} order - Order details
   * @returns {Object} Invoice data
   */
  generateInvoice(order) {
    const {
      orderId,
      customer,
      cart,
      orderType,
      deliveryAddress,
      createdAt
    } = order;

    // Calculate tax
    const taxCalc = this.calculateOrderTax(
      cart.subtotal || 0,
      cart.deliveryFee || 0,
      orderType
    );

    // Generate invoice
    const invoice = {
      invoiceNumber: orderId,
      invoiceDate: new Date(createdAt).toISOString(),

      // Customer details
      billTo: {
        name: customer.name,
        phone: customer.phone,
        email: customer.email || '',
        address: deliveryAddress?.formatted || 'N/A'
      },

      // Restaurant details (GSTIN required for actual business)
      billFrom: {
        name: 'The Coorg Food Company',
        gstin: 'GSTIN_TO_BE_ADDED', // Replace with actual GSTIN
        address: 'Restaurant Address',
        phone: 'Restaurant Phone',
        email: 'restaurant@example.com'
      },

      // Order items
      items: cart.items.map(item => ({
        description: item.dishName,
        quantity: item.quantity,
        rate: item.price,
        amount: item.price * item.quantity,
        taxRate: taxCalc.gstPercentage
      })),

      // Charges breakdown
      charges: {
        subtotal: cart.subtotal,
        deliveryFee: cart.deliveryFee || 0,
        taxableAmount: taxCalc.taxableAmount,
        cgst: taxCalc.cgst,
        sgst: taxCalc.sgst,
        totalGst: taxCalc.gstAmount,
        grandTotal: taxCalc.totalWithTax
      },

      // Tax details
      taxDetails: {
        gstRate: `${taxCalc.gstPercentage}%`,
        cgstRate: `${taxCalc.gstPercentage / 2}%`,
        sgstRate: `${taxCalc.gstPercentage / 2}%`,
        cgstAmount: taxCalc.cgst,
        sgstAmount: taxCalc.sgst,
        totalGstAmount: taxCalc.gstAmount
      },

      // Payment info
      payment: {
        method: order.paymentMethod,
        status: order.status,
        transactionId: order.razorpayPaymentId || 'N/A'
      },

      // Summary
      summary: {
        totalItems: cart.items.length,
        totalQuantity: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: cart.subtotal,
        deliveryCharges: cart.deliveryFee || 0,
        gst: taxCalc.gstAmount,
        grandTotal: taxCalc.totalWithTax
      }
    };

    return invoice;
  }

  /**
   * Format invoice as printable text
   * @param {Object} invoice - Invoice data
   * @returns {string} Formatted invoice text
   */
  formatInvoiceText(invoice) {
    const { billFrom, billTo, items, charges, taxDetails, payment, summary } = invoice;

    let text = '';
    text += '═══════════════════════════════════════════════\n';
    text += `       ${billFrom.name.toUpperCase()}       \n`;
    text += '═══════════════════════════════════════════════\n';
    text += `${billFrom.address}\n`;
    text += `Phone: ${billFrom.phone}\n`;
    text += `GSTIN: ${billFrom.gstin}\n`;
    text += '───────────────────────────────────────────────\n';
    text += `Invoice: ${invoice.invoiceNumber}\n`;
    text += `Date: ${new Date(invoice.invoiceDate).toLocaleString('en-IN')}\n`;
    text += '───────────────────────────────────────────────\n';
    text += 'BILL TO:\n';
    text += `${billTo.name}\n`;
    text += `${billTo.phone}\n`;
    if (billTo.address !== 'N/A') {
      text += `${billTo.address}\n`;
    }
    text += '═══════════════════════════════════════════════\n';
    text += 'ITEMS:\n';
    text += '───────────────────────────────────────────────\n';

    items.forEach((item, index) => {
      text += `${index + 1}. ${item.description}\n`;
      text += `   ${item.quantity} x ₹${item.rate} = ₹${item.amount.toFixed(2)}\n`;
    });

    text += '═══════════════════════════════════════════════\n';
    text += `Subtotal:                        ₹${charges.subtotal.toFixed(2)}\n`;

    if (charges.deliveryFee > 0) {
      text += `Delivery Charges:                ₹${charges.deliveryFee.toFixed(2)}\n`;
    }

    text += `CGST (${taxDetails.cgstRate}):                      ₹${charges.cgst.toFixed(2)}\n`;
    text += `SGST (${taxDetails.sgstRate}):                      ₹${charges.sgst.toFixed(2)}\n`;
    text += '───────────────────────────────────────────────\n';
    text += `Total GST (${taxDetails.gstRate}):                 ₹${charges.totalGst.toFixed(2)}\n`;
    text += '═══════════════════════════════════════════════\n';
    text += `GRAND TOTAL:                     ₹${charges.grandTotal.toFixed(2)}\n`;
    text += '═══════════════════════════════════════════════\n';
    text += `Payment Method: ${payment.method.toUpperCase()}\n`;
    text += `Payment Status: ${payment.status.toUpperCase()}\n`;
    if (payment.transactionId !== 'N/A') {
      text += `Transaction ID: ${payment.transactionId}\n`;
    }
    text += '═══════════════════════════════════════════════\n';
    text += '       Thank you for your order!       \n';
    text += '═══════════════════════════════════════════════\n';

    return text;
  }

  /**
   * Get current GST rate information
   * @returns {Object} GST rate details
   */
  getGSTInfo() {
    return {
      rates: this.taxRates,
      currentRate: this.defaultRate,
      currentPercentage: this.defaultRate * 100,
      description: 'GST rates for restaurant services in India',
      components: {
        cgst: this.defaultRate / 2,
        sgst: this.defaultRate / 2,
        cgstPercentage: (this.defaultRate / 2) * 100,
        sgstPercentage: (this.defaultRate / 2) * 100
      },
      lastUpdated: '2024',
      reference: 'CBIC - Central Board of Indirect Taxes and Customs'
    };
  }
}

export default TaxService;
