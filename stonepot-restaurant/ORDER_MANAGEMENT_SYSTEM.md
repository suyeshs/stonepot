# Order Management System Documentation

## Overview

A comprehensive order management system for restaurant owners to view, accept, and manage orders with real-time updates and KOT generation.

---

## Components Built

### 1. KOT Service (`src/services/KOTService.js`)

**Purpose**: Generate Kitchen Order Tickets for kitchen staff

**Features**:
- ✅ Generates KOT with unique number from order ID
- ✅ Groups items by preparation station (Tandoor, Grill, Main Kitchen, Cold Station)
- ✅ Calculates order priority (1-5 scale) based on delivery time and order size
- ✅ Estimates preparation time
- ✅ Formats KOT as printable text for thermal printers
- ✅ Ready for printer integration (Epson TM-T82, Star TSP100)
- ✅ Supports KOT modifications for order updates

**KOT Format**:
```
========================================
        Stonepot Restaurant
      KITCHEN ORDER TICKET
========================================

KOT #: KOT-123456-AB12
Order #: ORD-1234567890-xyz
Time: 02:30:45 PM
Type: DELIVERY
Priority: ★★★★☆

Customer:
  John Doe
  +91-9876543210

========================================
ITEMS
========================================

[Tandoor]
----------------------------------------
2x  Tandoori Chicken
     * Extra spicy
     Spice: 🌶️🌶️🌶️🌶️
1x  Garlic Naan

[Main Kitchen]
----------------------------------------
1x  Butter Chicken
     Spice: 🌶️🌶️

========================================
Total Items: 4
Est. Prep Time: 25 mins
Delivery Time: 03:00 PM
========================================
```

---

### 2. Order Management Service (`src/services/OrderManagementService.js`)

**Purpose**: Handle all restaurant-side order operations

**Features**:

#### Order Retrieval
- ✅ Get all orders with filters (status, orderType, date range)
- ✅ Get single order by ID
- ✅ Enrich orders with elapsed time and urgency status
- ✅ Support pagination

####  Order Status Management
- ✅ Accept order (generates KOT, updates status to 'preparing')
- ✅ Update order status with timeline tracking
- ✅ Mark order as ready
- ✅ Mark order as delivered/completed
- ✅ Cancel order with reason tracking

#### Real-time Updates
- ✅ WebSocket support for restaurant dashboard connections
- ✅ Broadcast new orders to all connected dashboards
- ✅ Broadcast status updates in real-time
- ✅ Automatic cleanup of closed connections

#### Statistics & Analytics
- ✅ Get order statistics (today, yesterday, week, month)
- ✅ Calculate total revenue
- ✅ Track order counts by status
- ✅ Track order counts by type (delivery, pickup, dine-in)
- ✅ Calculate average order value
- ✅ Identify urgent orders

---

## API Endpoints (To be added to `restaurantRoutes.js`)

### Order Management

#### GET /api/restaurant/manage/orders
Get all orders with filters

**Query Parameters**:
```javascript
{
  status?: 'pending_payment' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled',
  orderType?: 'delivery' | 'pickup' | 'dine-in',
  startDate?: string (ISO date),
  endDate?: string (ISO date),
  limit?: number (default 50),
  offset?: number (default 0)
}
```

**Response**:
```javascript
{
  success: true,
  orders: [
    {
      orderId: string,
      customer: { name, phone, email },
      cart: { items, subtotal, tax, total },
      orderType: string,
      status: string,
      itemCount: number,
      elapsedTime: string, // e.g., "15m ago"
      isUrgent: boolean,
      createdAt: string,
      ...
    }
  ],
  total: number
}
```

---

#### GET /api/restaurant/manage/orders/:orderId
Get single order details

**Response**:
```javascript
{
  success: true,
  order: { /* enriched order object */ }
}
```

---

#### POST /api/restaurant/manage/orders/:orderId/accept
Accept an order and generate KOT

**Body**:
```javascript
{
  acceptedBy: string // Staff member name/ID
}
```

**Response**:
```javascript
{
  success: true,
  order: { /* updated order with status: 'preparing' */ },
  kot: {
    kotNumber: string,
    timestamp: string,
    items: [...],
    estimatedPrepTime: number,
    priority: number,
    ...
  }
}
```

---

#### PUT /api/restaurant/manage/orders/:orderId/status
Update order status

**Body**:
```javascript
{
  status: 'preparing' | 'ready' | 'delivered' | 'cancelled',
  updatedBy: string,
  cancellationReason?: string // Required if status is 'cancelled'
}
```

**Response**:
```javascript
{
  success: true,
  order: { /* updated order */ }
}
```

---

#### POST /api/restaurant/manage/orders/:orderId/ready
Mark order as ready (shortcut endpoint)

**Body**:
```javascript
{
  readyBy: string
}
```

---

#### POST /api/restaurant/manage/orders/:orderId/delivered
Mark order as delivered (shortcut endpoint)

**Body**:
```javascript
{
  deliveredBy: string
}
```

---

#### POST /api/restaurant/manage/orders/:orderId/cancel
Cancel an order (shortcut endpoint)

**Body**:
```javascript
{
  reason: string,
  cancelledBy: string
}
```

---

#### GET /api/restaurant/manage/statistics
Get order statistics

**Query Parameters**:
```javascript
{
  period?: 'today' | 'yesterday' | 'week' | 'month' (default: 'today')
}
```

**Response**:
```javascript
{
  success: true,
  statistics: {
    totalOrders: number,
    pendingOrders: number,
    preparingOrders: number,
    readyOrders: number,
    deliveredOrders: number,
    cancelledOrders: number,
    totalRevenue: number,
    averageOrderValue: number,
    deliveryOrders: number,
    pickupOrders: number,
    dineInOrders: number,
    urgentOrders: number
  }
}
```

---

#### GET /api/restaurant/manage/customers
Get customer list with order history

**Query Parameters**:
```javascript
{
  limit?: number (default 50),
  offset?: number (default 0),
  search?: string (search by name, phone, or email)
}
```

**Response**:
```javascript
{
  success: true,
  customers: [
    {
      phone: string,
      name: string,
      email: string | null,
      totalOrders: number,
      totalSpent: number,
      averageOrderValue: number,
      lastOrderDate: string,
      firstOrderDate: string
    }
  ],
  total: number
}
```

---

#### GET /api/restaurant/manage/customers/:phone
Get single customer details with full order history

**Response**:
```javascript
{
  success: true,
  customer: {
    phone: string,
    name: string,
    email: string | null,
    totalOrders: number,
    totalSpent: number,
    averageOrderValue: number,
    orders: [
      {
        orderId: string,
        createdAt: string,
        total: number,
        status: string,
        orderType: string,
        itemCount: number,
        deliveryAddress: object | null
      }
    ],
    favoriteItems: [
      {
        dishName: string,
        count: number
      }
    ],
    lastOrderDate: string,
    firstOrderDate: string
  }
}
```

---

#### WS /ws/restaurant-dashboard/:tenantId
WebSocket connection for real-time order updates

**Authentication**: Bearer token (same as regular API)

**Message Types Received**:
```javascript
{
  type: 'new_order' | 'order_accepted' | 'status_updated',
  order: { /* order object */ },
  timestamp: string
}
```

**Message Types Sent**:
```javascript
{
  type: 'ping'
}
```

---

## Order Status Flow

```
pending_payment  →  confirmed  →  preparing  →  ready  →  delivered
                        ↓
                    cancelled
```

### Status Definitions:

1. **pending_payment**: Online payment initiated, waiting for Razorpay confirmation
2. **confirmed**: Payment verified (or cash payment selected), order ready to be accepted
3. **preparing**: Order accepted by restaurant, KOT generated, kitchen is preparing
4. **ready**: Food is ready, waiting for pickup/delivery
5. **delivered**: Order completed and delivered to customer
6. **cancelled**: Order cancelled by customer or restaurant

---

## Integration Points

### 1. In VertexAILiveService.js

After order finalization (line ~1466), add:

```javascript
// Generate and print KOT
const kotService = new KOTService({
  restaurantName: this.config.restaurantName || 'Stonepot Restaurant',
  kitchenPrinterEnabled: this.config.kitchenPrinterEnabled || false
});

const kot = kotService.generateKOT(orderData);
await kotService.printKOT(kot);

// Broadcast new order to restaurant dashboard
if (this.orderManagementService) {
  this.orderManagementService.broadcastNewOrder(session.tenantId, orderData);
}
```

### 2. Initialize OrderManagementService

In `src/index.js` or wherever services are initialized:

```javascript
import { OrderManagementService } from './services/OrderManagementService.js';

const orderManagementService = new OrderManagementService(firebaseService, {
  restaurantName: 'Stonepot Restaurant',
  kitchenPrinterEnabled: false // Set to true when printer is connected
});

// Pass to routes
app.use('/api/restaurant/manage', createOrderManagementRoutes(orderManagementService));
```

---

## Frontend Dashboard (To be built)

### Recommended UI Components:

1. **Order List View**
   - Filter by status (tabs: New, Preparing, Ready, Completed)
   - Sort by time, priority, order type
   - Show urgent orders prominently
   - Real-time updates via WebSocket

2. **Order Detail View**
   - Customer information
   - Items list grouped by station
   - Order timeline
   - Action buttons (Accept, Mark Ready, Mark Delivered, Cancel)

3. **Statistics Dashboard**
   - Cards showing key metrics
   - Revenue chart
   - Order count by status (pie chart)
   - Recent orders list

4. **KOT Display/Print**
   - View KOT before printing
   - Print KOT to thermal printer
   - Reprint option

### Tech Stack Recommendation:
- React + TypeScript
- Real-time updates with WebSocket
- UI library: Tailwind CSS (neumorphic design matching main app)
- State management: MobX or Zustand
- Charts: Recharts or Chart.js

---

## Database Schema Updates

### Firestore Collection: `orders`

Add new fields to track order management:

```javascript
{
  // Existing fields...

  // New fields for order management:
  kot: {
    kotNumber: string,
    generatedAt: string,
    estimatedPrepTime: number,
    printedAt: string
  },
  acceptedBy: string,
  acceptedAt: string,
  readyBy: string,
  readyAt: string,
  deliveredBy: string,
  deliveredAt: string,
  cancelledBy: string,
  cancelledAt: string,
  cancellationReason: string,
  statusTimeline: [
    {
      status: string,
      timestamp: string,
      updatedBy: string
    }
  ]
}
```

---

## Configuration

Add to `.env`:

```env
# Kitchen Printer Configuration
KITCHEN_PRINTER_ENABLED=false
KITCHEN_PRINTER_TYPE=thermal  # thermal, receipt, label
KITCHEN_PRINTER_IP=192.168.1.100  # For network printers
KITCHEN_PRINTER_PORT=9100

# Order Management
RESTAURANT_NAME=Stonepot Restaurant
AUTO_ACCEPT_ORDERS=false  # Set to true to skip manual acceptance
```

---

## Deployment Status

### Completed (Backend):
1. [x] Created KOTService.js for kitchen ticket generation
2. [x] Created OrderManagementService.js for order operations
3. [x] Created orderManagementRoutes.js with all API endpoints
4. [x] Integrated order management routes into restaurantRoutes.js
5. [x] Set up WebSocket endpoint for restaurant dashboard
6. [x] Added express-validator dependency to package.json

### API Endpoints Available:
All endpoints are now accessible at:
- **Base URL**: `https://stonepot-restaurant-334610188311.us-central1.run.app/api/restaurant/manage`

Available endpoints:

**Order Management:**
- `GET /orders` - List orders with filters
- `GET /orders/:orderId` - Get single order
- `POST /orders/:orderId/accept` - Accept order and generate KOT
- `PUT /orders/:orderId/status` - Update order status
- `POST /orders/:orderId/ready` - Mark order as ready
- `POST /orders/:orderId/delivered` - Mark order as delivered
- `POST /orders/:orderId/cancel` - Cancel order
- `GET /statistics` - Get order statistics

**Customer Management:**
- `GET /customers` - List customers with order history
- `GET /customers/:phone` - Get customer details and favorite items

**Real-time:**
- `WS /ws/restaurant-dashboard/:tenantId` - Real-time order updates

## Next Steps

### Immediate (Backend):
1. [x] Add order management routes to `restaurantRoutes.js` ✅
2. [x] Initialize OrderManagementService in main app ✅
3. [ ] Add KOT generation to order finalization flow in VertexAILiveService
4. [x] Set up WebSocket endpoint for restaurant dashboard ✅
5. [ ] Add database indexes for order queries
6. [ ] Test all API endpoints

### Short-term (Frontend):
1. [ ] Create restaurant dashboard React app
2. [ ] Build order list component with filters
3. [ ] Build order detail view with action buttons
4. [ ] Implement WebSocket connection for real-time updates
5. [ ] Build statistics dashboard
6. [ ] Add KOT print functionality
7. [ ] Add authentication for restaurant staff

### Long-term (Enhancements):
1. [ ] Integrate thermal printer (node-thermal-printer library)
2. [ ] Add sound notifications for new orders
3. [ ] Build mobile app for kitchen staff
4. [ ] Add delivery partner integration (Porter API)
5. [ ] Implement order analytics and reporting
6. [ ] Add staff management and permissions
7. [ ] Build customer feedback system
8. [ ] Add inventory management integration

---

## Testing

### Manual Testing Checklist:

- [ ] Create order from voice client
- [ ] View order in management dashboard
- [ ] Accept order (verify KOT generation)
- [ ] Update order status through all stages
- [ ] Cancel order with reason
- [ ] View statistics for different periods
- [ ] Test real-time updates across multiple browser tabs
- [ ] Test urgent order detection
- [ ] Test order filtering and sorting
- [ ] Test KOT text formatting

### Load Testing:
- [ ] Test with 100+ concurrent orders
- [ ] Test WebSocket with multiple dashboard connections
- [ ] Test database query performance with large datasets

---

## Support & Maintenance

### Monitoring:
- Track order status transition times
- Monitor KOT generation failures
- Alert on stuck orders (preparing > 1 hour)
- Track order acceptance rate and time

### Logs:
- All order status changes logged with timestamp
- KOT generation and printing logged
- WebSocket connection/disconnection logged
- API errors logged with order context

---

## Files Created

1. `src/services/KOTService.js` - Kitchen Order Ticket generation
2. `src/services/OrderManagementService.js` - Order management business logic
3. `src/routes/orderManagementRoutes.js` - API endpoints and WebSocket handler
4. `ORDER_MANAGEMENT_SYSTEM.md` - This documentation

## Files Modified

1. `src/routes/restaurantRoutes.js` - Added order management routes and dashboard WebSocket
2. `package.json` - Added express-validator dependency

## Files To Create

1. `src/middleware/restaurantAuth.js` - Authentication for restaurant staff (optional enhancement)
2. Frontend dashboard (separate React app or integrated)

---

## Example Usage

### Backend:

```javascript
// Initialize service
const orderMgmt = new OrderManagementService(firebaseService);

// Get pending orders
const orders = await orderMgmt.getOrders('demo', { status: 'confirmed' });

// Accept an order
const result = await orderMgmt.acceptOrder('ORD-123', 'demo', 'John (Chef)');
console.log('KOT:', result.kot.kotNumber);

// Mark as ready
await orderMgmt.markOrderReady('ORD-123', 'demo', 'John (Chef)');

// Get statistics
const stats = await orderMgmt.getOrderStatistics('demo', 'today');
console.log('Revenue:', stats.totalRevenue);
```

### Frontend (React):

```typescript
// Connect to WebSocket
const ws = new WebSocket('wss://api.example.com/ws/restaurant-dashboard/demo');

ws.on('message', (data) => {
  const { type, order } = JSON.parse(data);

  if (type === 'new_order') {
    playNotificationSound();
    updateOrderList(order);
  }
});

// Accept order
const acceptOrder = async (orderId) => {
  const response = await fetch(`/api/restaurant/manage/orders/${orderId}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acceptedBy: currentUser.name })
  });

  const { kot } = await response.json();
  printKOT(kot);
};
```

---

**End of Documentation**
