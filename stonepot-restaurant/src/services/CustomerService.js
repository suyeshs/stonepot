/**
 * Customer Service for Stonepot Restaurant
 * Handles customer data management, order history, and circles
 */

import { getFirebaseService } from './FirebaseService.js';

class CustomerService {
  constructor(config) {
    this.config = config;
    this.firebaseService = getFirebaseService(config);
  }

  /**
   * Create or update customer profile
   */
  async upsertCustomer(tenantId, customerData) {
    await this.firebaseService.initialize();

    try {
      const { phone, name, email, deliveryAddress } = customerData;

      // Use phone as unique identifier
      const customerId = `${tenantId}_${phone}`;

      // Check if customer exists
      const existingCustomer = await this.firebaseService.getDocument('customers', customerId);

      const customerDoc = {
        tenantId,
        phone,
        name,
        email: email || null,
        // Keep legacy deliveryAddress for backwards compatibility
        deliveryAddress: deliveryAddress || null,
        // New multi-address system with labels
        savedAddresses: existingCustomer?.savedAddresses || [],
        circles: existingCustomer?.circles || [],
        createdAt: existingCustomer?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (existingCustomer) {
        // Update existing customer
        await this.firebaseService.updateDocument('customers', customerId, customerDoc);
        console.log('[CustomerService] Updated customer:', customerId);
      } else {
        // Create new customer
        await this.firebaseService.createDocument('customers', customerDoc, customerId);
        console.log('[CustomerService] Created new customer:', customerId);
      }

      return {
        success: true,
        customerId,
        customer: customerDoc,
        isNew: !existingCustomer
      };
    } catch (error) {
      console.error('[CustomerService] Error upserting customer:', error);
      throw error;
    }
  }

  /**
   * Add or update a saved address with label
   */
  async saveAddress(tenantId, phone, addressData) {
    await this.firebaseService.initialize();

    try {
      const customerId = `${tenantId}_${phone}`;
      const customer = await this.firebaseService.getDocument('customers', customerId);

      if (!customer) {
        throw new Error('Customer not found');
      }

      const {
        formatted,
        coordinates,
        placeId,
        pincode,
        city,
        state,
        apartment,
        landmark,
        instructions,
        label = 'other', // 'home', 'work', 'other'
        isDefault = false
      } = addressData;

      let savedAddresses = customer.savedAddresses || [];

      // If setting as default, unset all other defaults
      if (isDefault) {
        savedAddresses = savedAddresses.map(addr => ({
          ...addr,
          isDefault: false
        }));
      }

      // Check if address with same label exists
      const existingIndex = savedAddresses.findIndex(addr => addr.label === label);

      const newAddress = {
        formatted,
        coordinates,
        placeId,
        pincode,
        city,
        state,
        apartment,
        landmark,
        instructions,
        label,
        isDefault,
        updatedAt: new Date().toISOString()
      };

      if (existingIndex >= 0) {
        // Update existing address
        savedAddresses[existingIndex] = newAddress;
      } else {
        // Add new address
        savedAddresses.push(newAddress);
      }

      // If no default address, make first one default
      if (!savedAddresses.some(addr => addr.isDefault) && savedAddresses.length > 0) {
        savedAddresses[0].isDefault = true;
      }

      await this.firebaseService.updateDocument('customers', customerId, {
        savedAddresses,
        updatedAt: new Date().toISOString()
      });

      console.log('[CustomerService] Saved address with label:', customerId, label);

      return {
        success: true,
        savedAddresses
      };
    } catch (error) {
      console.error('[CustomerService] Error saving address:', error);
      throw error;
    }
  }

  /**
   * Get all saved addresses for a customer
   */
  async getSavedAddresses(tenantId, phone) {
    await this.firebaseService.initialize();

    try {
      const customerId = `${tenantId}_${phone}`;
      const customer = await this.firebaseService.getDocument('customers', customerId);

      if (!customer) {
        return [];
      }

      return customer.savedAddresses || [];
    } catch (error) {
      console.error('[CustomerService] Error getting saved addresses:', error);
      throw error;
    }
  }

  /**
   * Set an address as default
   */
  async setDefaultAddress(tenantId, phone, label) {
    await this.firebaseService.initialize();

    try {
      const customerId = `${tenantId}_${phone}`;
      const customer = await this.firebaseService.getDocument('customers', customerId);

      if (!customer) {
        throw new Error('Customer not found');
      }

      let savedAddresses = customer.savedAddresses || [];

      // Unset all defaults
      savedAddresses = savedAddresses.map(addr => ({
        ...addr,
        isDefault: addr.label === label
      }));

      await this.firebaseService.updateDocument('customers', customerId, {
        savedAddresses,
        updatedAt: new Date().toISOString()
      });

      console.log('[CustomerService] Set default address:', customerId, label);

      return {
        success: true,
        savedAddresses
      };
    } catch (error) {
      console.error('[CustomerService] Error setting default address:', error);
      throw error;
    }
  }

  /**
   * Delete a saved address
   */
  async deleteAddress(tenantId, phone, label) {
    await this.firebaseService.initialize();

    try {
      const customerId = `${tenantId}_${phone}`;
      const customer = await this.firebaseService.getDocument('customers', customerId);

      if (!customer) {
        throw new Error('Customer not found');
      }

      let savedAddresses = (customer.savedAddresses || []).filter(addr => addr.label !== label);

      // If deleted address was default, make first one default
      if (savedAddresses.length > 0 && !savedAddresses.some(addr => addr.isDefault)) {
        savedAddresses[0].isDefault = true;
      }

      await this.firebaseService.updateDocument('customers', customerId, {
        savedAddresses,
        updatedAt: new Date().toISOString()
      });

      console.log('[CustomerService] Deleted address:', customerId, label);

      return {
        success: true,
        savedAddresses
      };
    } catch (error) {
      console.error('[CustomerService] Error deleting address:', error);
      throw error;
    }
  }

  /**
   * Get customer by phone number
   */
  async getCustomer(tenantId, phone) {
    await this.firebaseService.initialize();

    try {
      const customerId = `${tenantId}_${phone}`;
      const customer = await this.firebaseService.getDocument('customers', customerId);

      return customer;
    } catch (error) {
      console.error('[CustomerService] Error getting customer:', error);
      throw error;
    }
  }

  /**
   * Get customer's order history
   */
  async getCustomerOrders(tenantId, phone, limit = 10) {
    await this.firebaseService.initialize();

    try {
      const customerId = `${tenantId}_${phone}`;

      const orders = await this.firebaseService.queryDocuments(
        'orders',
        { tenantId, customerId },
        { orderBy: 'createdAt', order: 'desc', limit }
      );

      return orders;
    } catch (error) {
      console.error('[CustomerService] Error getting customer orders:', error);
      throw error;
    }
  }

  /**
   * Create a new order
   */
  async createOrder(tenantId, orderData) {
    await this.firebaseService.initialize();

    try {
      const { customerId, cart, sessionId, orderType } = orderData;

      const order = {
        tenantId,
        customerId,
        sessionId,
        orderType: orderType || 'dine-in',
        items: cart.items || [],
        total: cart.total || 0,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const createdOrder = await this.firebaseService.createDocument('orders', order);

      console.log('[CustomerService] Created order:', createdOrder.id);

      return {
        success: true,
        order: createdOrder
      };
    } catch (error) {
      console.error('[CustomerService] Error creating order:', error);
      throw error;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId, status) {
    await this.firebaseService.initialize();

    try {
      await this.firebaseService.updateDocument('orders', orderId, {
        status,
        statusUpdatedAt: new Date().toISOString()
      });

      console.log('[CustomerService] Updated order status:', orderId, status);

      return { success: true, orderId, status };
    } catch (error) {
      console.error('[CustomerService] Error updating order status:', error);
      throw error;
    }
  }

  /**
   * Add customer to a circle
   */
  async addCustomerToCircle(tenantId, phone, circleId, circleType) {
    await this.firebaseService.initialize();

    try {
      const customerId = `${tenantId}_${phone}`;
      const customer = await this.firebaseService.getDocument('customers', customerId);

      if (!customer) {
        throw new Error('Customer not found');
      }

      const circles = customer.circles || [];

      // Check if already in circle
      if (!circles.some(c => c.circleId === circleId)) {
        circles.push({
          circleId,
          type: circleType,
          joinedAt: new Date().toISOString()
        });

        await this.firebaseService.updateDocument('customers', customerId, {
          circles
        });

        console.log('[CustomerService] Added customer to circle:', customerId, circleId);
      }

      return { success: true, customerId, circleId };
    } catch (error) {
      console.error('[CustomerService] Error adding customer to circle:', error);
      throw error;
    }
  }

  /**
   * Remove customer from a circle
   */
  async removeCustomerFromCircle(tenantId, phone, circleId) {
    await this.firebaseService.initialize();

    try {
      const customerId = `${tenantId}_${phone}`;
      const customer = await this.firebaseService.getDocument('customers', customerId);

      if (!customer) {
        throw new Error('Customer not found');
      }

      const circles = (customer.circles || []).filter(c => c.circleId !== circleId);

      await this.firebaseService.updateDocument('customers', customerId, {
        circles
      });

      console.log('[CustomerService] Removed customer from circle:', customerId, circleId);

      return { success: true, customerId, circleId };
    } catch (error) {
      console.error('[CustomerService] Error removing customer from circle:', error);
      throw error;
    }
  }

  /**
   * Get all customers in a circle
   */
  async getCircleMembers(circleId) {
    await this.firebaseService.initialize();

    try {
      // Query customers who have this circleId in their circles array
      const allCustomers = await this.firebaseService.queryDocuments('customers', {});

      const members = allCustomers.filter(customer =>
        customer.circles?.some(c => c.circleId === circleId)
      );

      return members;
    } catch (error) {
      console.error('[CustomerService] Error getting circle members:', error);
      throw error;
    }
  }
}

// Singleton instance
let customerService = null;

export function getCustomerService(config) {
  if (!customerService) {
    customerService = new CustomerService(config);
  }
  return customerService;
}

export default CustomerService;
