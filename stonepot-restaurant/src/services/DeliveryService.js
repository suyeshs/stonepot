/**
 * Delivery Service
 * Handles delivery zone checking, fee calculation, and Porter integration preparation
 */

export class DeliveryService {
  constructor(config, googleMapsService) {
    this.config = config.delivery || {};
    this.googleMapsService = googleMapsService;

    // Default delivery configuration
    this.defaultRadius = this.config.defaultRadius || 10; // km
    this.baseFee = this.config.baseFee || 40; // ₹40
    this.perKmCharge = this.config.perKmCharge || 10; // ₹10/km
    this.freeDeliveryAbove = this.config.freeDeliveryAbove || 500; // ₹500
    this.minDeliveryFee = this.config.minDeliveryFee || 20; // ₹20
    this.maxDeliveryFee = this.config.maxDeliveryFee || 200; // ₹200
  }

  /**
   * Check if delivery is available to given coordinates
   * @param {Object} restaurantLocation - {lat, lng} of restaurant
   * @param {Object} customerLocation - {lat, lng} of customer
   * @param {number} [customRadius] - Override default delivery radius
   * @returns {Promise<{eligible: boolean, distance: number, distanceText: string, message: string}>}
   */
  async checkDeliveryZone(restaurantLocation, customerLocation, customRadius = null) {
    try {
      const radius = customRadius || this.defaultRadius;

      console.log('[Delivery] Checking delivery zone:', {
        restaurant: restaurantLocation,
        customer: customerLocation,
        radius
      });

      // Calculate distance using Google Maps Distance Matrix API
      const distanceResult = await this.googleMapsService.calculateDistance(
        restaurantLocation,
        customerLocation
      );

      const distance = distanceResult.distance; // in km
      const eligible = distance <= radius;

      console.log('[Delivery] Zone check result:', {
        distance,
        radius,
        eligible,
        distanceText: distanceResult.distanceText
      });

      return {
        eligible,
        distance,
        distanceText: distanceResult.distanceText,
        durationText: distanceResult.durationText,
        durationMinutes: Math.round(distanceResult.duration),
        message: eligible
          ? `Delivery available (${distanceResult.distanceText})`
          : `Sorry, we don't deliver beyond ${radius}km. You're ${distanceResult.distanceText} away.`
      };
    } catch (error) {
      console.error('[Delivery] Zone check error:', error);
      throw new Error('Unable to verify delivery eligibility. Please try again.');
    }
  }

  /**
   * Calculate delivery fee based on distance and order value
   * @param {number} distance - Distance in km
   * @param {number} orderValue - Total order value in ₹
   * @returns {Object} {fee: number, breakdown: string, isFree: boolean}
   */
  calculateDeliveryFee(distance, orderValue) {
    console.log('[Delivery] Calculating fee:', { distance, orderValue });

    // Free delivery for orders above threshold
    if (orderValue >= this.freeDeliveryAbove) {
      return {
        fee: 0,
        breakdown: `Free delivery on orders above ₹${this.freeDeliveryAbove}`,
        isFree: true
      };
    }

    // Calculate distance-based fee
    let fee = this.baseFee;

    // Add per-km charges for distance beyond 2km
    if (distance > 2) {
      const extraDistance = distance - 2;
      fee += Math.ceil(extraDistance) * this.perKmCharge;
    }

    // Apply min/max limits
    fee = Math.max(this.minDeliveryFee, Math.min(fee, this.maxDeliveryFee));

    return {
      fee,
      breakdown: distance > 2
        ? `Base ₹${this.baseFee} + ₹${this.perKmCharge}/km for ${Math.ceil(distance - 2)}km`
        : `Base delivery fee`,
      isFree: false
    };
  }

  /**
   * Get estimated delivery time based on distance and current load
   * @param {number} distance - Distance in km
   * @param {number} preparationTime - Food preparation time in minutes
   * @returns {Object} {estimatedMinutes: number, estimatedTime: string}
   */
  calculateEstimatedDeliveryTime(distance, preparationTime = 20) {
    // Base calculation: preparation time + travel time (assuming ~20km/hr avg speed)
    const travelTime = Math.ceil((distance / 20) * 60); // Convert to minutes
    const totalMinutes = preparationTime + travelTime;

    // Add buffer time based on distance
    const bufferMinutes = distance > 5 ? 10 : 5;
    const estimatedMinutes = totalMinutes + bufferMinutes;

    // Format as time range
    const minTime = estimatedMinutes - 5;
    const maxTime = estimatedMinutes + 5;

    return {
      estimatedMinutes,
      timeRange: `${minTime}-${maxTime} mins`,
      preparationTime,
      travelTime,
      bufferMinutes
    };
  }

  /**
   * Prepare data structure for Porter API integration (to be implemented)
   * @param {Object} order - Order object
   * @param {Object} address - Delivery address with coordinates
   * @param {Object} restaurant - Restaurant details
   * @returns {Object} Data ready for Porter API call
   */
  preparePorterData(order, address, restaurant) {
    console.log('[Delivery] Preparing Porter integration data');

    return {
      // Porter API expects these fields (placeholder for future implementation)
      pickup: {
        name: restaurant.name,
        phone: restaurant.phone,
        address: restaurant.address,
        lat: restaurant.coordinates.lat,
        lng: restaurant.coordinates.lng,
        instructions: 'Restaurant pickup'
      },
      drop: {
        name: order.customer.name,
        phone: order.customer.phone,
        address: address.formatted,
        lat: address.coordinates.lat,
        lng: address.coordinates.lng,
        instructions: address.instructions || order.specialInstructions || ''
      },
      orderDetails: {
        orderId: order.orderId,
        amount: order.total,
        items: order.cart.items.map(item => ({
          name: item.dishName,
          quantity: item.quantity,
          price: item.price
        })),
        paymentMethod: order.paymentMethod
      },
      vehicleType: 'bike', // or 'bicycle' for shorter distances
      requestId: `${order.orderId}_${Date.now()}`,
      deliveryFee: order.deliveryFee || 0
    };
  }

  /**
   * Validate delivery address has all required fields
   * @param {Object} address - Address object
   * @returns {Object} {valid: boolean, errors: Array}
   */
  validateDeliveryAddress(address) {
    const errors = [];

    if (!address) {
      return { valid: false, errors: ['Address is required'] };
    }

    if (!address.formatted && !address.street) {
      errors.push('Street address is required');
    }

    if (!address.coordinates || !address.coordinates.lat || !address.coordinates.lng) {
      errors.push('Address coordinates are required (please use address autocomplete)');
    }

    if (!address.pincode) {
      errors.push('Pincode is required');
    }

    if (!address.city) {
      errors.push('City is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Format delivery address for display
   * @param {Object} address - Address object
   * @returns {string} Formatted address string
   */
  formatAddress(address) {
    const parts = [];

    if (address.apartment) parts.push(address.apartment);
    if (address.street) parts.push(address.street);
    if (address.landmark) parts.push(`Near ${address.landmark}`);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.pincode) parts.push(address.pincode);

    return parts.join(', ');
  }

  /**
   * Get delivery zones for a restaurant (placeholder for future implementation)
   * @param {string} restaurantId - Restaurant ID
   * @returns {Promise<Array>} Array of delivery zones
   */
  async getRestaurantDeliveryZones(restaurantId) {
    // Future: Fetch from database
    // For now, return default zone based on config
    return [
      {
        id: 'default',
        radius: this.defaultRadius,
        baseFee: this.baseFee,
        perKmCharge: this.perKmCharge,
        active: true
      }
    ];
  }
}

export default DeliveryService;
