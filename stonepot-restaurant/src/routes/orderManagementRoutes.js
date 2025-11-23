/**
 * Order Management Routes
 * API endpoints for restaurant order management, acceptance, status updates, and KOT generation
 */

import express from 'express';
import { body, query, param, validationResult } from 'express-validator';

/**
 * Create order management routes
 * @param {OrderManagementService} orderManagementService - Instance of OrderManagementService
 * @returns {express.Router} Express router with order management routes
 */
export function createOrderManagementRoutes(orderManagementService) {
  const router = express.Router();

  // Middleware to validate tenant authorization
  const validateTenant = (req, res, next) => {
    // Extract tenantId from authenticated user or request
    // For now, using query/body parameter, but should come from auth token
    const tenantId = req.query.tenantId || req.body.tenantId || req.params.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
    }

    req.tenantId = tenantId;
    next();
  };

  // Middleware to handle validation errors
  const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  };

  /**
   * GET /api/restaurant/manage/orders
   * Get all orders with optional filters
   */
  router.get(
    '/orders',
    validateTenant,
    [
      query('status').optional().isIn(['pending_payment', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled']),
      query('orderType').optional().isIn(['delivery', 'pickup', 'dine-in']),
      query('startDate').optional().isISO8601(),
      query('endDate').optional().isISO8601(),
      query('limit').optional().isInt({ min: 1, max: 500 }),
      query('offset').optional().isInt({ min: 0 })
    ],
    handleValidationErrors,
    async (req, res) => {
      try {
        const filters = {
          status: req.query.status,
          orderType: req.query.orderType,
          startDate: req.query.startDate,
          endDate: req.query.endDate,
          limit: parseInt(req.query.limit) || 50,
          offset: parseInt(req.query.offset) || 0
        };

        const orders = await orderManagementService.getOrders(req.tenantId, filters);

        res.json({
          success: true,
          orders,
          total: orders.length,
          filters: {
            status: filters.status || 'all',
            orderType: filters.orderType || 'all',
            limit: filters.limit,
            offset: filters.offset
          }
        });
      } catch (error) {
        console.error('[OrderManagementRoutes] Failed to get orders:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve orders',
          message: error.message
        });
      }
    }
  );

  /**
   * GET /api/restaurant/manage/orders/:orderId
   * Get single order details
   */
  router.get(
    '/orders/:orderId',
    validateTenant,
    [
      param('orderId').notEmpty().withMessage('Order ID is required')
    ],
    handleValidationErrors,
    async (req, res) => {
      try {
        const order = await orderManagementService.getOrderById(
          req.params.orderId,
          req.tenantId
        );

        res.json({
          success: true,
          order
        });
      } catch (error) {
        console.error('[OrderManagementRoutes] Failed to get order:', error);

        if (error.message === 'Order not found') {
          return res.status(404).json({
            success: false,
            error: 'Order not found'
          });
        }

        res.status(500).json({
          success: false,
          error: 'Failed to retrieve order',
          message: error.message
        });
      }
    }
  );

  /**
   * POST /api/restaurant/manage/orders/:orderId/accept
   * Accept an order and generate KOT
   */
  router.post(
    '/orders/:orderId/accept',
    validateTenant,
    [
      param('orderId').notEmpty().withMessage('Order ID is required'),
      body('acceptedBy').notEmpty().withMessage('acceptedBy is required')
    ],
    handleValidationErrors,
    async (req, res) => {
      try {
        const result = await orderManagementService.acceptOrder(
          req.params.orderId,
          req.tenantId,
          req.body.acceptedBy
        );

        res.json(result);
      } catch (error) {
        console.error('[OrderManagementRoutes] Failed to accept order:', error);

        if (error.message.includes('Cannot accept order')) {
          return res.status(400).json({
            success: false,
            error: error.message
          });
        }

        res.status(500).json({
          success: false,
          error: 'Failed to accept order',
          message: error.message
        });
      }
    }
  );

  /**
   * PUT /api/restaurant/manage/orders/:orderId/status
   * Update order status
   */
  router.put(
    '/orders/:orderId/status',
    validateTenant,
    [
      param('orderId').notEmpty().withMessage('Order ID is required'),
      body('status').isIn(['preparing', 'ready', 'delivered', 'cancelled']).withMessage('Invalid status'),
      body('updatedBy').notEmpty().withMessage('updatedBy is required'),
      body('cancellationReason').if(body('status').equals('cancelled')).notEmpty().withMessage('Cancellation reason is required when cancelling order')
    ],
    handleValidationErrors,
    async (req, res) => {
      try {
        const updates = {
          status: req.body.status,
          updatedBy: req.body.updatedBy
        };

        if (req.body.status === 'cancelled') {
          updates.cancellationReason = req.body.cancellationReason;
          updates.cancelledBy = req.body.updatedBy;
          updates.cancelledAt = new Date().toISOString();
        }

        const order = await orderManagementService.updateOrderStatus(
          req.params.orderId,
          req.tenantId,
          updates
        );

        res.json({
          success: true,
          order
        });
      } catch (error) {
        console.error('[OrderManagementRoutes] Failed to update order status:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to update order status',
          message: error.message
        });
      }
    }
  );

  /**
   * POST /api/restaurant/manage/orders/:orderId/ready
   * Mark order as ready (shortcut endpoint)
   */
  router.post(
    '/orders/:orderId/ready',
    validateTenant,
    [
      param('orderId').notEmpty().withMessage('Order ID is required'),
      body('readyBy').notEmpty().withMessage('readyBy is required')
    ],
    handleValidationErrors,
    async (req, res) => {
      try {
        const order = await orderManagementService.markOrderReady(
          req.params.orderId,
          req.tenantId,
          req.body.readyBy
        );

        res.json({
          success: true,
          order
        });
      } catch (error) {
        console.error('[OrderManagementRoutes] Failed to mark order ready:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to mark order as ready',
          message: error.message
        });
      }
    }
  );

  /**
   * POST /api/restaurant/manage/orders/:orderId/delivered
   * Mark order as delivered/completed (shortcut endpoint)
   */
  router.post(
    '/orders/:orderId/delivered',
    validateTenant,
    [
      param('orderId').notEmpty().withMessage('Order ID is required'),
      body('deliveredBy').notEmpty().withMessage('deliveredBy is required')
    ],
    handleValidationErrors,
    async (req, res) => {
      try {
        const order = await orderManagementService.markOrderDelivered(
          req.params.orderId,
          req.tenantId,
          req.body.deliveredBy
        );

        res.json({
          success: true,
          order
        });
      } catch (error) {
        console.error('[OrderManagementRoutes] Failed to mark order delivered:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to mark order as delivered',
          message: error.message
        });
      }
    }
  );

  /**
   * POST /api/restaurant/manage/orders/:orderId/cancel
   * Cancel an order (shortcut endpoint)
   */
  router.post(
    '/orders/:orderId/cancel',
    validateTenant,
    [
      param('orderId').notEmpty().withMessage('Order ID is required'),
      body('reason').notEmpty().withMessage('Cancellation reason is required'),
      body('cancelledBy').notEmpty().withMessage('cancelledBy is required')
    ],
    handleValidationErrors,
    async (req, res) => {
      try {
        const order = await orderManagementService.cancelOrder(
          req.params.orderId,
          req.tenantId,
          req.body.reason,
          req.body.cancelledBy
        );

        res.json({
          success: true,
          order
        });
      } catch (error) {
        console.error('[OrderManagementRoutes] Failed to cancel order:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to cancel order',
          message: error.message
        });
      }
    }
  );

  /**
   * GET /api/restaurant/manage/statistics
   * Get order statistics for dashboard
   */
  router.get(
    '/statistics',
    validateTenant,
    [
      query('period').optional().isIn(['today', 'yesterday', 'week', 'month'])
    ],
    handleValidationErrors,
    async (req, res) => {
      try {
        const period = req.query.period || 'today';
        const statistics = await orderManagementService.getOrderStatistics(
          req.tenantId,
          period
        );

        res.json({
          success: true,
          statistics,
          period
        });
      } catch (error) {
        console.error('[OrderManagementRoutes] Failed to get statistics:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve statistics',
          message: error.message
        });
      }
    }
  );

  /**
   * GET /api/restaurant/manage/customers
   * Get customer list with order history
   */
  router.get(
    '/customers',
    validateTenant,
    [
      query('limit').optional().isInt({ min: 1, max: 500 }),
      query('offset').optional().isInt({ min: 0 }),
      query('search').optional().isString()
    ],
    handleValidationErrors,
    async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const search = req.query.search;

        const customers = await orderManagementService.getCustomers(
          req.tenantId,
          { limit, offset, search }
        );

        res.json({
          success: true,
          customers,
          total: customers.length
        });
      } catch (error) {
        console.error('[OrderManagementRoutes] Failed to get customers:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve customers',
          message: error.message
        });
      }
    }
  );

  /**
   * GET /api/restaurant/manage/customers/:phone
   * Get single customer details with order history
   */
  router.get(
    '/customers/:phone',
    validateTenant,
    [
      param('phone').notEmpty().withMessage('Phone number is required')
    ],
    handleValidationErrors,
    async (req, res) => {
      try {
        const customer = await orderManagementService.getCustomerByPhone(
          req.params.phone,
          req.tenantId
        );

        if (!customer) {
          return res.status(404).json({
            success: false,
            error: 'Customer not found'
          });
        }

        res.json({
          success: true,
          customer
        });
      } catch (error) {
        console.error('[OrderManagementRoutes] Failed to get customer:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve customer',
          message: error.message
        });
      }
    }
  );

  /**
   * POST /api/restaurant/manage/orders/:orderId/sync
   * Sync order data from Durable Object to Firestore (called by ActiveOrderSession DO)
   */
  router.post(
    '/orders/:orderId/sync',
    validateTenant,
    [
      param('orderId').notEmpty().withMessage('Order ID is required'),
      body('orderData').notEmpty().withMessage('Order data is required')
    ],
    handleValidationErrors,
    async (req, res) => {
      try {
        const { orderData } = req.body;

        // Persist order data to Firestore
        await orderManagementService.syncOrderFromDO(
          req.params.orderId,
          req.tenantId,
          orderData
        );

        res.json({
          success: true,
          message: 'Order synced to Firestore successfully'
        });
      } catch (error) {
        console.error('[OrderManagementRoutes] Failed to sync order:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to sync order',
          message: error.message
        });
      }
    }
  );

  return router;
}

/**
 * Create WebSocket handler for restaurant dashboard real-time updates
 * @param {OrderManagementService} orderManagementService - Instance of OrderManagementService
 * @returns {Function} WebSocket handler function
 */
export function createRestaurantDashboardWebSocketHandler(orderManagementService) {
  return (ws, req) => {
    // Extract tenant ID from URL path: /ws/restaurant-dashboard/:tenantId
    const pathParts = req.url.split('/');
    const tenantId = pathParts[pathParts.length - 1];

    if (!tenantId) {
      ws.close(1008, 'Tenant ID is required');
      return;
    }

    console.log(`[OrderManagementRoutes] Restaurant dashboard WebSocket connected for tenant: ${tenantId}`);

    // Register connection
    orderManagementService.registerRestaurantConnection(tenantId, ws);

    // Handle incoming messages (e.g., ping)
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);

        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch (error) {
        console.error('[OrderManagementRoutes] Error handling WebSocket message:', error);
      }
    });

    // Send initial connection confirmation
    ws.send(JSON.stringify({
      type: 'connected',
      tenantId,
      timestamp: new Date().toISOString()
    }));
  };
}
