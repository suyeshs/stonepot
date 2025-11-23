/**
 * Porter Delivery Service
 * Integration with Porter India for last-mile delivery
 *
 * NOTE: This implementation is based on standard delivery API patterns.
 * Update endpoints and parameters when official Porter API documentation is available.
 * Contact Porter Enterprise at https://porter.in/api-integrations for API access.
 */

export class PorterService {
  constructor(config) {
    this.config = config.porter || {};
    this.apiKey = this.config.apiKey;
    this.baseUrl = this.config.baseUrl || 'https://api.porter.in'; // Placeholder URL
    this.enabled = !!this.apiKey;

    if (!this.enabled) {
      console.warn('[Porter] API key not configured. Porter delivery features will be disabled.');
    } else {
      console.log('[Porter] Service initialized');
    }
  }

  /**
   * Create a delivery order with Porter
   * @param {Object} orderDetails - Delivery order details
   * @returns {Promise<Object>} Porter order response
   */
  async createDelivery(orderDetails) {
    if (!this.enabled) {
      throw new Error('Porter service is not configured');
    }

    const {
      requestId,
      pickup,
      drop,
      orderDetails: items,
      vehicleType = 'bike',
      deliveryInstructions
    } = orderDetails;

    console.log('[Porter] Creating delivery order:', {
      requestId,
      pickup: pickup.name,
      drop: drop.name,
      vehicleType
    });

    try {
      const response = await fetch(`${this.baseUrl}/v1/orders/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          request_id: requestId,
          delivery_instructions: {
            instructions_list: [
              {
                // Pickup details
                type: 'pickup',
                address: {
                  apartment_address: pickup.address,
                  street_address1: pickup.address,
                  street_address2: '',
                  landmark: pickup.instructions || '',
                  city: 'Bangalore', // TODO: Extract from address
                  pincode: '',
                  lat: pickup.lat,
                  lng: pickup.lng,
                  contact_details: {
                    name: pickup.name,
                    phone_number: pickup.phone
                  }
                }
              },
              {
                // Drop details
                type: 'drop',
                address: {
                  apartment_address: drop.address,
                  street_address1: drop.address,
                  street_address2: '',
                  landmark: drop.instructions || '',
                  city: 'Bangalore', // TODO: Extract from address
                  pincode: '',
                  lat: drop.lat,
                  lng: drop.lng,
                  contact_details: {
                    name: drop.name,
                    phone_number: drop.phone
                  }
                }
              }
            ]
          },
          customer: {
            name: drop.name,
            mobile: {
              country_code: '+91',
              number: drop.phone
            }
          },
          vehicle_type: vehicleType, // 'bike', 'bicycle', 'tempo', 'mini_truck'
          fare_quote_id: null, // Optional: from fare estimation
          additional_comments: deliveryInstructions || '',
          // Order item details (optional)
          items: items?.items?.map(item => ({
            description: item.name,
            quantity: item.quantity,
            price: {
              amount: item.price,
              currency: 'INR'
            }
          })) || []
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create Porter delivery');
      }

      const data = await response.json();

      console.log('[Porter] Delivery order created:', {
        orderId: data.order_id,
        status: data.status
      });

      return {
        success: true,
        porterOrderId: data.order_id,
        status: data.status,
        estimatedDeliveryTime: data.estimated_delivery_time,
        trackingUrl: data.tracking_url,
        driverDetails: data.driver_details,
        fareDetails: data.fare_details,
        rawResponse: data
      };
    } catch (error) {
      console.error('[Porter] Failed to create delivery:', error);
      throw new Error(`Porter delivery creation failed: ${error.message}`);
    }
  }

  /**
   * Get fare estimate for a delivery
   * @param {Object} params - Estimation parameters
   * @returns {Promise<Object>} Fare estimate
   */
  async getFareEstimate({ pickup, drop, vehicleType = 'bike' }) {
    if (!this.enabled) {
      throw new Error('Porter service is not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/get_quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          pickup_details: {
            lat: pickup.lat,
            lng: pickup.lng
          },
          drop_details: {
            lat: drop.lat,
            lng: drop.lng
          },
          vehicle_type: vehicleType
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get fare estimate');
      }

      const data = await response.json();

      return {
        success: true,
        fareQuoteId: data.fare_quote_id,
        estimatedFare: data.estimated_fare,
        estimatedDistance: data.estimated_distance_km,
        estimatedDuration: data.estimated_duration_minutes,
        currency: 'INR',
        rawResponse: data
      };
    } catch (error) {
      console.error('[Porter] Fare estimation failed:', error);
      throw new Error(`Porter fare estimation failed: ${error.message}`);
    }
  }

  /**
   * Track a delivery order
   * @param {string} porterOrderId - Porter order ID
   * @returns {Promise<Object>} Tracking details
   */
  async trackDelivery(porterOrderId) {
    if (!this.enabled) {
      throw new Error('Porter service is not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/orders/${porterOrderId}`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error('Failed to track delivery');
      }

      const data = await response.json();

      return {
        success: true,
        orderId: data.order_id,
        status: data.status,
        currentLocation: data.current_location,
        driverDetails: data.driver_details,
        estimatedDeliveryTime: data.estimated_delivery_time,
        statusHistory: data.status_history,
        rawResponse: data
      };
    } catch (error) {
      console.error('[Porter] Tracking failed:', error);
      throw new Error(`Porter tracking failed: ${error.message}`);
    }
  }

  /**
   * Cancel a delivery order
   * @param {string} porterOrderId - Porter order ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Cancellation response
   */
  async cancelDelivery(porterOrderId, reason = 'Customer requested cancellation') {
    if (!this.enabled) {
      throw new Error('Porter service is not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/orders/${porterOrderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          cancellation_reason: reason
        })
      });

      if (!response.ok) {
        throw new Error('Failed to cancel delivery');
      }

      const data = await response.json();

      console.log('[Porter] Delivery cancelled:', {
        orderId: porterOrderId,
        status: data.status
      });

      return {
        success: true,
        orderId: data.order_id,
        status: data.status,
        cancellationFee: data.cancellation_fee,
        rawResponse: data
      };
    } catch (error) {
      console.error('[Porter] Cancellation failed:', error);
      throw new Error(`Porter cancellation failed: ${error.message}`);
    }
  }

  /**
   * Handle Porter webhook events
   * @param {Object} webhookData - Webhook payload
   * @returns {Object} Processing result
   */
  handleWebhook(webhookData) {
    const { event_type, order_id, status, data } = webhookData;

    console.log('[Porter] Webhook received:', {
      event: event_type,
      orderId: order_id,
      status
    });

    switch (event_type) {
      case 'order.created':
        return {
          processed: true,
          action: 'order_created',
          orderId: order_id,
          status: 'assigned'
        };

      case 'driver.assigned':
        return {
          processed: true,
          action: 'driver_assigned',
          orderId: order_id,
          driverDetails: data.driver_details,
          status: 'driver_assigned'
        };

      case 'order.picked_up':
        return {
          processed: true,
          action: 'order_picked_up',
          orderId: order_id,
          status: 'in_transit'
        };

      case 'order.delivered':
        return {
          processed: true,
          action: 'order_delivered',
          orderId: order_id,
          deliveredAt: data.delivered_at,
          status: 'delivered'
        };

      case 'order.cancelled':
        return {
          processed: true,
          action: 'order_cancelled',
          orderId: order_id,
          cancellationReason: data.cancellation_reason,
          status: 'cancelled'
        };

      default:
        console.log('[Porter] Unhandled webhook event:', event_type);
        return {
          processed: false,
          event: event_type
        };
    }
  }

  /**
   * Get available vehicle types
   * @returns {Array} Vehicle type configurations
   */
  getVehicleTypes() {
    return [
      {
        type: 'bicycle',
        name: 'Bicycle',
        capacity: '15 kg',
        maxDistance: '5 km',
        description: 'Ideal for small packages, short distances'
      },
      {
        type: 'bike',
        name: 'Two Wheeler',
        capacity: '20 kg',
        maxDistance: '20 km',
        description: 'Fast delivery for small to medium packages'
      },
      {
        type: 'tempo',
        name: 'Mini Tempo',
        capacity: '500 kg',
        maxDistance: '50 km',
        description: 'For bulk orders and larger items'
      },
      {
        type: 'mini_truck',
        name: 'Mini Truck',
        capacity: '750 kg',
        maxDistance: '100 km',
        description: 'For heavy and bulky deliveries'
      }
    ];
  }

  /**
   * Select appropriate vehicle type based on order details
   * @param {Object} orderDetails - Order information
   * @returns {string} Recommended vehicle type
   */
  selectVehicleType(orderDetails) {
    const { items, distance } = orderDetails;
    const totalItems = items?.reduce((sum, item) => sum + item.quantity, 0) || 1;

    // Simple logic - customize based on your needs
    if (distance > 20) {
      return 'tempo';
    } else if (totalItems > 5) {
      return 'tempo';
    } else if (distance <= 5) {
      return 'bicycle';
    } else {
      return 'bike';
    }
  }

  /**
   * Map Porter status to internal order status
   * @param {string} porterStatus - Porter delivery status
   * @returns {string} Internal status
   */
  mapStatus(porterStatus) {
    const statusMap = {
      'open': 'pending',
      'assigned': 'assigned',
      'driver_assigned': 'driver_assigned',
      'pickup_arrived': 'driver_arrived',
      'picked_up': 'picked_up',
      'in_transit': 'in_transit',
      'nearby': 'nearby',
      'arrived': 'arrived',
      'delivered': 'delivered',
      'cancelled': 'cancelled',
      'failed': 'failed'
    };

    return statusMap[porterStatus] || 'unknown';
  }
}

export default PorterService;
