/**
 * Kitchen Order Ticket (KOT) Service
 * Generates KOT for kitchen staff with order details and preparation instructions
 */

export class KOTService {
  constructor(config = {}) {
    this.restaurantName = config.restaurantName || 'Stonepot Restaurant';
    this.kitchenPrinterEnabled = config.kitchenPrinterEnabled || false;
  }

  /**
   * Generate KOT for an order
   * @param {object} order - Order object
   * @returns {object} KOT data
   */
  generateKOT(order) {
    const kotNumber = this.generateKOTNumber(order.orderId);
    const timestamp = new Date();

    // Group items by preparation station/type
    const groupedItems = this.groupItemsByStation(order.cart.items);

    return {
      kotNumber,
      orderId: order.orderId,
      orderType: order.orderType, // delivery, pickup, dine-in
      timestamp,
      formattedTime: this.formatTime(timestamp),
      table: order.tableNumber || null,
      customer: {
        name: order.customer?.name || 'Guest',
        phone: order.customer?.phone || ''
      },
      items: order.cart.items.map(item => ({
        dishName: item.dishName,
        quantity: item.quantity,
        customizations: item.customizations || [],
        spiceLevel: item.spiceLevel,
        specialInstructions: item.specialInstructions,
        station: this.getPreparationStation(item)
      })),
      groupedItems,
      totalItems: order.cart.items.reduce((sum, item) => sum + item.quantity, 0),
      specialInstructions: order.specialInstructions,
      priority: this.calculatePriority(order),
      estimatedPrepTime: this.estimatePreparationTime(order.cart.items),
      deliveryTime: order.deliveryTime,
      printedAt: timestamp,
      status: 'pending' // pending, preparing, ready, served
    };
  }

  /**
   * Generate KOT number from order ID
   */
  generateKOTNumber(orderId) {
    // Extract timestamp and random ID from orderId format: ORD-{timestamp}-{randomId}
    const parts = orderId.split('-');
    if (parts.length >= 3) {
      const timestamp = parts[1];
      const randomId = parts[2];
      return `KOT-${timestamp.slice(-6)}-${randomId.slice(0, 4).toUpperCase()}`;
    }
    return `KOT-${Date.now().toString().slice(-6)}`;
  }

  /**
   * Group items by preparation station (e.g., Tandoor, Wok, Grill, Cold Station)
   */
  groupItemsByStation(items) {
    const stations = {};

    items.forEach(item => {
      const station = this.getPreparationStation(item);
      if (!stations[station]) {
        stations[station] = [];
      }
      stations[station].push({
        dishName: item.dishName,
        quantity: item.quantity,
        customizations: item.customizations || [],
        spiceLevel: item.spiceLevel
      });
    });

    return stations;
  }

  /**
   * Determine preparation station based on dish name and type
   */
  getPreparationStation(item) {
    const dishName = item.dishName.toLowerCase();

    // Tandoor station
    if (dishName.includes('tandoori') || dishName.includes('naan') ||
        dishName.includes('kebab') || dishName.includes('tikka')) {
      return 'Tandoor';
    }

    // Grill station
    if (dishName.includes('grill') || dishName.includes('bbq')) {
      return 'Grill';
    }

    // Cold station (salads, drinks, desserts)
    if (dishName.includes('salad') || dishName.includes('raita') ||
        dishName.includes('lassi') || dishName.includes('juice') ||
        dishName.includes('ice cream') || dishName.includes('kulfi')) {
      return 'Cold Station';
    }

    // Wok/Main kitchen (default)
    return 'Main Kitchen';
  }

  /**
   * Calculate order priority (1-5, 5 being highest)
   */
  calculatePriority(order) {
    let priority = 3; // Normal priority

    // Increase priority for delivery orders
    if (order.orderType === 'delivery') {
      priority += 1;
    }

    // Increase priority if delivery time is specified and soon
    if (order.deliveryTime) {
      const deliveryDate = new Date(order.deliveryTime);
      const now = new Date();
      const minutesUntilDelivery = (deliveryDate - now) / 1000 / 60;

      if (minutesUntilDelivery < 30) {
        priority = 5; // Urgent
      } else if (minutesUntilDelivery < 60) {
        priority = 4; // High priority
      }
    }

    // Increase priority for large orders
    const totalItems = order.cart.items.reduce((sum, item) => sum + item.quantity, 0);
    if (totalItems > 10) {
      priority = Math.min(5, priority + 1);
    }

    return priority;
  }

  /**
   * Estimate total preparation time in minutes
   */
  estimatePreparationTime(items) {
    let maxPrepTime = 0;

    items.forEach(item => {
      // Get preparation time based on dish type
      let prepTime = item.preparationTime || 15; // Default 15 minutes

      // Adjust for quantity (but not linearly)
      if (item.quantity > 1) {
        prepTime += Math.ceil(item.quantity / 2) * 2;
      }

      maxPrepTime = Math.max(maxPrepTime, prepTime);
    });

    // Add 5 minutes buffer
    return maxPrepTime + 5;
  }

  /**
   * Format KOT as printable text
   */
  formatKOTText(kot) {
    const lines = [];
    const width = 40; // Standard thermal printer width

    // Header
    lines.push(this.centerText(this.restaurantName, width));
    lines.push(this.centerText('KITCHEN ORDER TICKET', width));
    lines.push('='.repeat(width));
    lines.push('');

    // KOT Details
    lines.push(`KOT #: ${kot.kotNumber}`);
    lines.push(`Order #: ${kot.orderId}`);
    lines.push(`Time: ${kot.formattedTime}`);
    lines.push(`Type: ${kot.orderType.toUpperCase()}`);
    if (kot.table) {
      lines.push(`Table: ${kot.table}`);
    }
    lines.push(`Priority: ${'★'.repeat(kot.priority)}${'☆'.repeat(5 - kot.priority)}`);
    lines.push('');

    // Customer Info
    lines.push('Customer:');
    lines.push(`  ${kot.customer.name}`);
    if (kot.customer.phone) {
      lines.push(`  ${kot.customer.phone}`);
    }
    lines.push('');

    // Items by Station
    lines.push('='.repeat(width));
    lines.push('ITEMS');
    lines.push('='.repeat(width));

    Object.entries(kot.groupedItems).forEach(([station, items]) => {
      lines.push('');
      lines.push(`[${station}]`);
      lines.push('-'.repeat(width));

      items.forEach(item => {
        // Item name and quantity
        lines.push(`${item.quantity}x  ${item.dishName}`);

        // Customizations
        if (item.customizations && item.customizations.length > 0) {
          item.customizations.forEach(custom => {
            lines.push(`     * ${custom}`);
          });
        }

        // Spice level
        if (item.spiceLevel) {
          const spice = '🌶️'.repeat(item.spiceLevel);
          lines.push(`     Spice: ${spice}`);
        }
      });
    });

    lines.push('');
    lines.push('='.repeat(width));

    // Special Instructions
    if (kot.specialInstructions) {
      lines.push('');
      lines.push('SPECIAL INSTRUCTIONS:');
      lines.push(kot.specialInstructions);
      lines.push('');
    }

    // Footer
    lines.push('');
    lines.push(`Total Items: ${kot.totalItems}`);
    lines.push(`Est. Prep Time: ${kot.estimatedPrepTime} mins`);
    if (kot.deliveryTime) {
      lines.push(`Delivery Time: ${kot.deliveryTime}`);
    }
    lines.push('');
    lines.push('='.repeat(width));

    return lines.join('\n');
  }

  /**
   * Format time for display
   */
  formatTime(date) {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }

  /**
   * Center text within given width
   */
  centerText(text, width) {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text;
  }

  /**
   * Print KOT to thermal printer (placeholder for actual printer integration)
   */
  async printKOT(kot) {
    if (!this.kitchenPrinterEnabled) {
      console.log('[KOT] Printer not enabled, KOT not printed');
      return { success: false, reason: 'Printer not enabled' };
    }

    const kotText = this.formatKOTText(kot);

    // TODO: Integrate with actual thermal printer
    // Example printers: Epson TM-T82, Star TSP100
    // Can use libraries like: node-thermal-printer, escpos

    console.log('[KOT] Would print to kitchen printer:');
    console.log(kotText);

    return {
      success: true,
      kotNumber: kot.kotNumber,
      printedAt: kot.printedAt
    };
  }

  /**
   * Generate KOT modification ticket (for order updates)
   */
  generateModificationKOT(originalKOT, modifications) {
    return {
      kotNumber: `${originalKOT.kotNumber}-MOD`,
      modificationType: modifications.type, // 'add', 'remove', 'update'
      originalKOTNumber: originalKOT.kotNumber,
      timestamp: new Date(),
      changes: modifications.changes,
      reason: modifications.reason
    };
  }
}
