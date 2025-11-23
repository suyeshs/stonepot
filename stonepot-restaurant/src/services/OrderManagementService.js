/**
 * Order Management Service
 * Handles all restaurant-side order operations: viewing, accepting, status updates, KOT generation
 */

import { KOTService } from './KOTService.js';

export class OrderManagementService {
  constructor(firebaseService, config = {}) {
    this.firebaseService = firebaseService;
    this.kotService = new KOTService(config);

    // WebSocket connections for real-time updates
    this.restaurantConnections = new Map(); // tenantId -> Set of WebSocket connections
  }

  /**
   * Get all orders for a restaurant with optional filters
   * @param {string} tenantId - Restaurant/tenant ID
   * @param {object} filters - Filter options
   * @returns {Promise<Array>} Orders array
   */
  async getOrders(tenantId, filters = {}) {
    const {
      status, // 'pending_payment', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'
      orderType, // 'delivery', 'pickup', 'dine-in'
      startDate,
      endDate,
      limit = 50,
      offset = 0
    } = filters;

    try {
      let query = { tenantId };

      // Add status filter
      if (status) {
        query.status = status;
      }

      // Add order type filter
      if (orderType) {
        query.orderType = orderType;
      }

      // Query Firestore
      let orders = await this.firebaseService.queryDocuments('orders', query, {
        orderBy: 'createdAt',
        direction: 'desc',
        limit
      });

      // Filter by date range if specified
      if (startDate || endDate) {
        orders = orders.filter(order => {
          const orderDate = new Date(order.createdAt);
          if (startDate && orderDate < new Date(startDate)) return false;
          if (endDate && orderDate > new Date(endDate)) return false;
          return true;
        });
      }

      // Enrich orders with additional data
      const enrichedOrders = orders.map(order => ({
        ...order,
        itemCount: order.cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
        elapsedTime: this.calculateElapsedTime(order.createdAt),
        isUrgent: this.isOrderUrgent(order)
      }));

      return enrichedOrders;
    } catch (error) {
      console.error('[OrderManagement] Failed to get orders:', error);
      throw error;
    }
  }

  /**
   * Get a single order by ID
   */
  async getOrderById(orderId, tenantId) {
    try {
      const orders = await this.firebaseService.queryDocuments('orders', {
        orderId,
        tenantId
      });

      if (orders.length === 0) {
        throw new Error('Order not found');
      }

      const order = orders[0];

      // Enrich with additional data
      return {
        ...order,
        itemCount: order.cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
        elapsedTime: this.calculateElapsedTime(order.createdAt),
        isUrgent: this.isOrderUrgent(order)
      };
    } catch (error) {
      console.error('[OrderManagement] Failed to get order:', error);
      throw error;
    }
  }

  /**
   * Accept/confirm an order
   */
  async acceptOrder(orderId, tenantId, acceptedBy) {
    try {
      const order = await this.getOrderById(orderId, tenantId);

      if (order.status !== 'confirmed' && order.status !== 'pending_payment') {
        throw new Error(`Cannot accept order with status: ${order.status}`);
      }

      // Generate KOT
      const kot = this.kotService.generateKOT(order);

      // Print KOT (if printer enabled)
      await this.kotService.printKOT(kot);

      // Update order status
      const updatedOrder = await this.updateOrderStatus(orderId, tenantId, {
        status: 'preparing',
        acceptedBy,
        acceptedAt: new Date().toISOString(),
        kot: {
          kotNumber: kot.kotNumber,
          generatedAt: kot.timestamp.toISOString(),
          estimatedPrepTime: kot.estimatedPrepTime
        }
      });

      // Broadcast update to all restaurant connections
      this.broadcastOrderUpdate(tenantId, updatedOrder, 'order_accepted');

      return {
        success: true,
        order: updatedOrder,
        kot
      };
    } catch (error) {
      console.error('[OrderManagement] Failed to accept order:', error);
      throw error;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId, tenantId, updates) {
    try {
      const order = await this.getOrderById(orderId, tenantId);

      // Build status timeline
      const statusTimeline = order.statusTimeline || [];
      if (updates.status && updates.status !== order.status) {
        statusTimeline.push({
          status: updates.status,
          timestamp: new Date().toISOString(),
          updatedBy: updates.updatedBy || 'system'
        });
      }

      // Prepare update object
      const updateData = {
        ...updates,
        statusTimeline,
        updatedAt: new Date().toISOString()
      };

      // Update in Firestore
      await this.firebaseService.updateDocument('orders', order.id, updateData);

      // Get updated order
      const updatedOrder = await this.getOrderById(orderId, tenantId);

      // Broadcast update
      this.broadcastOrderUpdate(tenantId, updatedOrder, 'status_updated');

      return updatedOrder;
    } catch (error) {
      console.error('[OrderManagement] Failed to update order status:', error);
      throw error;
    }
  }

  /**
   * Mark order as ready
   */
  async markOrderReady(orderId, tenantId, readyBy) {
    try {
      const updatedOrder = await this.updateOrderStatus(orderId, tenantId, {
        status: 'ready',
        readyBy,
        readyAt: new Date().toISOString()
      });

      // If delivery order, notify delivery partner
      if (updatedOrder.orderType === 'delivery') {
        // TODO: Integrate with Porter or delivery partner API
        console.log('[OrderManagement] Order ready for delivery:', orderId);
      }

      return updatedOrder;
    } catch (error) {
      console.error('[OrderManagement] Failed to mark order ready:', error);
      throw error;
    }
  }

  /**
   * Mark order as delivered/completed
   */
  async markOrderDelivered(orderId, tenantId, deliveredBy) {
    try {
      const updatedOrder = await this.updateOrderStatus(orderId, tenantId, {
        status: 'delivered',
        deliveredBy,
        deliveredAt: new Date().toISOString()
      });

      return updatedOrder;
    } catch (error) {
      console.error('[OrderManagement] Failed to mark order delivered:', error);
      throw error;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId, tenantId, reason, cancelledBy) {
    try {
      const updatedOrder = await this.updateOrderStatus(orderId, tenantId, {
        status: 'cancelled',
        cancellationReason: reason,
        cancelledBy,
        cancelledAt: new Date().toISOString()
      });

      // If payment was made, initiate refund
      if (updatedOrder.paymentMethod === 'online' && updatedOrder.paymentDetails) {
        // TODO: Integrate refund through PaymentService
        console.log('[OrderManagement] Refund needed for order:', orderId);
      }

      return updatedOrder;
    } catch (error) {
      console.error('[OrderManagement] Failed to cancel order:', error);
      throw error;
    }
  }

  /**
   * Get order statistics for dashboard
   */
  async getOrderStatistics(tenantId, period = 'today') {
    try {
      const { startDate, endDate } = this.getDateRange(period);

      const allOrders = await this.getOrders(tenantId, {
        startDate,
        endDate,
        limit: 1000
      });

      // Calculate statistics
      const stats = {
        totalOrders: allOrders.length,
        pendingOrders: allOrders.filter(o => o.status === 'confirmed').length,
        preparingOrders: allOrders.filter(o => o.status === 'preparing').length,
        readyOrders: allOrders.filter(o => o.status === 'ready').length,
        deliveredOrders: allOrders.filter(o => o.status === 'delivered').length,
        cancelledOrders: allOrders.filter(o => o.status === 'cancelled').length,
        totalRevenue: allOrders
          .filter(o => o.status !== 'cancelled')
          .reduce((sum, o) => sum + (o.cart?.total || 0), 0),
        averageOrderValue: 0,
        deliveryOrders: allOrders.filter(o => o.orderType === 'delivery').length,
        pickupOrders: allOrders.filter(o => o.orderType === 'pickup').length,
        dineInOrders: allOrders.filter(o => o.orderType === 'dine-in').length,
        urgentOrders: allOrders.filter(o => this.isOrderUrgent(o)).length
      };

      stats.averageOrderValue = stats.totalOrders > 0
        ? (stats.totalRevenue / stats.totalOrders).toFixed(2)
        : 0;

      return stats;
    } catch (error) {
      console.error('[OrderManagement] Failed to get statistics:', error);
      throw error;
    }
  }

  /**
   * Register a restaurant dashboard WebSocket connection for real-time updates
   */
  registerRestaurantConnection(tenantId, ws) {
    if (!this.restaurantConnections.has(tenantId)) {
      this.restaurantConnections.set(tenantId, new Set());
    }
    this.restaurantConnections.get(tenantId).add(ws);

    console.log(`[OrderManagement] Restaurant dashboard connected for tenant: ${tenantId}`);

    // Handle disconnection
    ws.on('close', () => {
      const connections = this.restaurantConnections.get(tenantId);
      if (connections) {
        connections.delete(ws);
        if (connections.size === 0) {
          this.restaurantConnections.delete(tenantId);
        }
      }
      console.log(`[OrderManagement] Restaurant dashboard disconnected for tenant: ${tenantId}`);
    });
  }

  /**
   * Broadcast order update to all connected restaurant dashboards
   */
  broadcastOrderUpdate(tenantId, order, eventType) {
    const connections = this.restaurantConnections.get(tenantId);
    if (!connections || connections.size === 0) {
      return;
    }

    const message = JSON.stringify({
      type: eventType,
      order,
      timestamp: new Date().toISOString()
    });

    connections.forEach(ws => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(message);
      }
    });

    console.log(`[OrderManagement] Broadcasted ${eventType} to ${connections.size} connections`);
  }

  /**
   * Broadcast new order notification
   */
  broadcastNewOrder(tenantId, order) {
    this.broadcastOrderUpdate(tenantId, order, 'new_order');
  }

  /**
   * Calculate elapsed time since order creation
   */
  calculateElapsedTime(createdAt) {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMinutes = Math.floor((now - created) / 1000 / 60);

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    return `${diffHours}h ago`;
  }

  /**
   * Check if order is urgent (based on delivery time or elapsed time)
   */
  isOrderUrgent(order) {
    // Check delivery time
    if (order.deliveryTime) {
      const deliveryDate = new Date(order.deliveryTime);
      const now = new Date();
      const minutesUntilDelivery = (deliveryDate - now) / 1000 / 60;

      if (minutesUntilDelivery < 30) {
        return true;
      }
    }

    // Check elapsed time since creation
    const created = new Date(order.createdAt);
    const now = new Date();
    const elapsedMinutes = (now - created) / 1000 / 60;

    // Mark as urgent if order is more than 30 minutes old and not delivered
    if (elapsedMinutes > 30 && order.status !== 'delivered' && order.status !== 'cancelled') {
      return true;
    }

    return false;
  }

  /**
   * Get customer list with order history
   */
  async getCustomers(tenantId, options = {}) {
    try {
      const { limit = 50, offset = 0, search } = options;

      // Get all orders for this tenant
      const allOrders = await this.getOrders(tenantId, { limit: 1000 });

      // Group orders by customer phone number
      const customerMap = new Map();

      allOrders.forEach(order => {
        const phone = order.customer?.phone;
        if (!phone) return;

        if (!customerMap.has(phone)) {
          customerMap.set(phone, {
            phone,
            name: order.customer.name,
            email: order.customer.email || null,
            orders: [],
            totalOrders: 0,
            totalSpent: 0,
            lastOrderDate: null,
            firstOrderDate: null
          });
        }

        const customer = customerMap.get(phone);
        customer.orders.push({
          orderId: order.orderId,
          createdAt: order.createdAt,
          total: order.cart?.total || 0,
          status: order.status,
          orderType: order.orderType
        });
        customer.totalOrders++;
        customer.totalSpent += order.cart?.total || 0;

        const orderDate = new Date(order.createdAt);
        if (!customer.lastOrderDate || orderDate > new Date(customer.lastOrderDate)) {
          customer.lastOrderDate = order.createdAt;
        }
        if (!customer.firstOrderDate || orderDate < new Date(customer.firstOrderDate)) {
          customer.firstOrderDate = order.createdAt;
        }
      });

      // Convert to array and sort by total orders (most frequent customers first)
      let customers = Array.from(customerMap.values())
        .sort((a, b) => b.totalOrders - a.totalOrders);

      // Apply search filter if provided
      if (search) {
        const searchLower = search.toLowerCase();
        customers = customers.filter(customer =>
          customer.name?.toLowerCase().includes(searchLower) ||
          customer.phone?.includes(search) ||
          customer.email?.toLowerCase().includes(searchLower)
        );
      }

      // Apply pagination
      const paginatedCustomers = customers.slice(offset, offset + limit);

      // Remove full order list from paginated results (keep summary stats only)
      return paginatedCustomers.map(customer => ({
        phone: customer.phone,
        name: customer.name,
        email: customer.email,
        totalOrders: customer.totalOrders,
        totalSpent: customer.totalSpent,
        averageOrderValue: customer.totalOrders > 0 ? (customer.totalSpent / customer.totalOrders).toFixed(2) : 0,
        lastOrderDate: customer.lastOrderDate,
        firstOrderDate: customer.firstOrderDate
      }));
    } catch (error) {
      console.error('[OrderManagement] Failed to get customers:', error);
      throw error;
    }
  }

  /**
   * Get single customer by phone with full order history
   */
  async getCustomerByPhone(phone, tenantId) {
    try {
      // Get all orders for this customer
      const allOrders = await this.getOrders(tenantId, { limit: 1000 });
      const customerOrders = allOrders.filter(order => order.customer?.phone === phone);

      if (customerOrders.length === 0) {
        return null;
      }

      // Build customer profile
      const latestOrder = customerOrders[0]; // Orders are sorted by createdAt desc
      const customer = {
        phone,
        name: latestOrder.customer.name,
        email: latestOrder.customer.email || null,
        totalOrders: customerOrders.length,
        totalSpent: customerOrders.reduce((sum, order) => sum + (order.cart?.total || 0), 0),
        orders: customerOrders.map(order => ({
          orderId: order.orderId,
          createdAt: order.createdAt,
          total: order.cart?.total || 0,
          status: order.status,
          orderType: order.orderType,
          itemCount: order.itemCount,
          deliveryAddress: order.deliveryAddress
        })),
        favoriteItems: this.calculateFavoriteItems(customerOrders),
        lastOrderDate: customerOrders[0].createdAt,
        firstOrderDate: customerOrders[customerOrders.length - 1].createdAt
      };

      customer.averageOrderValue = customer.totalOrders > 0
        ? (customer.totalSpent / customer.totalOrders).toFixed(2)
        : 0;

      return customer;
    } catch (error) {
      console.error('[OrderManagement] Failed to get customer by phone:', error);
      throw error;
    }
  }

  /**
   * Calculate favorite items for a customer based on order history
   */
  calculateFavoriteItems(orders) {
    const itemCounts = new Map();

    orders.forEach(order => {
      order.cart?.items?.forEach(item => {
        const existing = itemCounts.get(item.dishName) || { dishName: item.dishName, count: 0 };
        existing.count += item.quantity;
        itemCounts.set(item.dishName, existing);
      });
    });

    // Return top 5 most ordered items
    return Array.from(itemCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /**
   * Get date range for statistics period
   */
  getDateRange(period) {
    const now = new Date();
    let startDate, endDate;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = now;
        break;
      case 'yesterday':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = now;
    }

    return { startDate, endDate };
  }

  /**
   * Sync order data from Durable Object to Firestore
   * Called by ActiveOrderSession DO for async persistence
   */
  async syncOrderFromDO(orderId, tenantId, orderData) {
    try {
      console.log(`[OrderManagement] Syncing order ${orderId} from DO to Firestore`);

      const orderRef = this.firebaseService.db
        .collection('restaurants')
        .doc(tenantId)
        .collection('orders')
        .doc(orderId);

      // Update order with data from Durable Object
      await orderRef.update({
        ...orderData,
        lastSyncedAt: new Date().toISOString(),
        updatedAt: orderData.updatedAt || new Date().toISOString()
      });

      console.log(`[OrderManagement] Successfully synced order ${orderId} to Firestore`);
      return true;
    } catch (error) {
      console.error(`[OrderManagement] Failed to sync order ${orderId}:`, error);
      throw error;
    }
  }
}
