# Customer Management & Collaborative Ordering Implementation

This document summarizes the implementation of customer data management and collaborative ordering features for Stonepot Restaurant.

## Overview

Implemented a complete customer management system with expanded data schema, order history tracking, and real-time collaborative ordering using PartyKit.

## Changes Made

### 1. Customer Service (`stonepot-restaurant/src/services/CustomerService.js`)

**New Service Created** - Handles all customer-related operations:

- `upsertCustomer()` - Create or update customer profile with email, delivery address
- `getCustomer()` - Retrieve customer by phone number
- `getCustomerOrders()` - Fetch order history for a customer
- `createOrder()` - Store completed orders in Firestore
- `updateOrderStatus()` - Update order status (pending → confirmed → delivered)
- `addCustomerToCircle()` - Add customer to family/friend circle
- `removeCustomerFromCircle()` - Remove customer from circle
- `getCircleMembers()` - Get all members of a circle

**Key Features:**
- Uses phone number as unique identifier (format: `{tenantId}_{phone}`)
- Maintains dual storage: session state + Firestore persistence
- Tracks customer circles for collaborative ordering
- Supports order history with status tracking

### 2. Circle Service (`stonepot-restaurant/src/services/CircleService.js`)

**New Service Created** - Manages family/friend circles and collaborative orders:

- `createCircle()` - Create family or friend circle with owner
- `inviteToCircle()` - Add members to existing circle
- `removeMemberFromCircle()` - Remove members (except owner)
- `getCircle()` - Retrieve circle details
- `getCustomerCircles()` - Get all circles a customer belongs to
- `startCollaborativeOrder()` - Initialize group order session
- `joinCollaborativeOrder()` - Add participant to active collaborative order
- `addItemToCollaborativeOrder()` - Add items with owner tracking
- `finalizeCollaborativeOrder()` - Complete collaborative order

**Key Features:**
- Supports two circle types: 'family' and 'friends'
- Owner/member role system
- Tracks who added each item in collaborative orders
- Links to PartyKit rooms for real-time sync

### 3. Updated VertexAILiveService.js

**Modified Files:**
- [VertexAILiveService.js:7-11](stonepot-restaurant/src/services/VertexAILiveService.js#L7-L11) - Added CustomerService import
- [VertexAILiveService.js:14-30](stonepot-restaurant/src/services/VertexAILiveService.js#L14-L30) - Initialize CustomerService in constructor
- [VertexAILiveService.js:140-146](stonepot-restaurant/src/services/VertexAILiveService.js#L140-L146) - Expanded session orderState with email and deliveryAddress fields
- [VertexAILiveService.js:280-286](stonepot-restaurant/src/services/VertexAILiveService.js#L280-L286) - Added system instructions for phone number capture
- [VertexAILiveService.js:691-732](stonepot-restaurant/src/services/VertexAILiveService.js#L691-L732) - Updated capture_customer_info handler

**Updated capture_customer_info Handler:**
```javascript
case 'capture_customer_info':
  // Store in session with expanded fields
  session.orderState.customer = {
    name: args.name,
    phone: args.phone,
    email: args.email || null,
    deliveryAddress: args.deliveryAddress || null,
    confirmedAt: Date.now()
  };

  // Persist to Firebase session
  await this.persistSessionState(session);

  // Upsert customer in customers collection
  const customerResult = await this.customerService.upsertCustomer(
    session.tenantId,
    {
      phone: args.phone,
      name: args.name,
      email: args.email,
      deliveryAddress: args.deliveryAddress
    }
  );

  result = {
    success: true,
    message: `Customer info saved: ${args.name}`,
    customer: session.orderState.customer,
    customerId: customerResult.customerId,
    isNewCustomer: customerResult.isNew
  };
```

**System Instructions Added:**
```
**Collecting Customer Information:**
- When collecting phone numbers, ask the customer to say each digit clearly
- CRITICAL: Store phone numbers as strings with all 10 digits intact (e.g., "9876543210")
- After hearing the number, confirm it back digit-by-digit: "Let me confirm: nine, eight, seven, six..."
- NEVER convert phone numbers to numerical format or spoken words like "nine million"
- If collecting delivery address, ask for street, apartment/flat, landmark, and pincode separately
- For email, spell it out clearly and confirm the spelling
```

### 4. Firestore Schema (`FIRESTORE_SCHEMA.md`)

**New Collections:**

#### `customers`
- Document ID: `{tenantId}_{phone}`
- Fields: name, phone, email, deliveryAddress (street, apartment, city, state, pincode, landmark), circles[], createdAt, updatedAt
- Indexes: tenantId + phone composite

#### `orders`
- Auto-generated ID
- Fields: tenantId, customerId, sessionId, orderType, items[], total, status, statusUpdatedAt, createdAt, updatedAt
- Indexes: tenantId + customerId + createdAt, tenantId + status + createdAt

#### `circles`
- Auto-generated ID
- Fields: tenantId, name, type (family/friends), createdBy, members[], activeOrders[], status, createdAt, updatedAt
- Indexes: tenantId, status, createdBy

#### `collaborative_orders`
- Auto-generated ID
- Fields: circleId, tenantId, sessionId (PartyKit room), initiatedBy, participants[], items[] (with addedBy tracking), total, status, splitType, splitDetails, finalizedAt, createdAt, updatedAt
- Indexes: circleId + status + createdAt

**Security Rules:**
All new collections are backend-only (read/write: false) for security.

### 5. PartyKit Server (`stonepot-partykit/`)

**New Directory Structure:**
```
stonepot-partykit/
├── package.json
├── partykit.json
├── tsconfig.json
├── src/
│   └── server.ts
├── .gitignore
└── README.md
```

**PartyKit Server Features:**
- Real-time WebSocket synchronization
- Persistent state storage via PartyKit
- Connection management with auto-cleanup
- Message types: join, leave, add_item, remove_item, update_quantity, update_split, finalize
- Broadcast updates to all participants
- CORS support for cross-origin requests

**Message Protocol:**
- Client → Server: join, add_item, remove_item, update_quantity, update_split, finalize, leave
- Server → Client: sync, participant_joined, participant_left, item_added, item_removed, quantity_updated, split_updated, order_finalized

**State Management:**
- Each collaborative order gets its own PartyKit "room"
- Room ID = collaborative order session ID
- State persists across reconnections
- Auto-cleanup on connection close

### 6. Function Declarations Updated

The `capture_customer_info` function declaration in [VertexAILiveService.js](stonepot-restaurant/src/services/VertexAILiveService.js) now includes:

```javascript
{
  name: 'capture_customer_info',
  description: 'Store customer information when provided...',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Customer full name' },
      phone: {
        type: 'string',
        description: 'Phone number as string of exactly 10 digits (e.g., "9876543210")'
      },
      email: { type: 'string', description: 'Customer email address (optional)' },
      deliveryAddress: {
        type: 'object',
        description: 'Delivery address details (optional)',
        properties: {
          street: { type: 'string' },
          apartment: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          pincode: { type: 'string' },
          landmark: { type: 'string' }
        }
      }
    },
    required: ['name', 'phone']
  }
}
```

## Integration Guide

### Backend Integration

1. **Import Services:**
```javascript
import { getCustomerService } from './services/CustomerService.js';
import { getCircleService } from './services/CircleService.js';
```

2. **Initialize in Constructor:**
```javascript
this.customerService = getCustomerService(config);
this.circleService = getCircleService(config);
```

3. **Create Order on Completion:**
```javascript
// When order is finalized
const customerId = `${session.tenantId}_${session.orderState.customer.phone}`;
await this.customerService.createOrder(session.tenantId, {
  customerId,
  cart: session.orderState.cart,
  sessionId: session.id,
  orderType: 'dine-in' // or 'takeaway', 'delivery'
});
```

### Frontend Integration (Future)

1. **Connect to PartyKit:**
```typescript
const ws = new WebSocket(
  `wss://stonepot-collaborative-orders.USERNAME.partykit.dev/parties/collaborative_order/${sessionId}`
);

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'join',
    participantId: customerId,
    participantName: customerName,
    timestamp: Date.now(),
    data: { circleId, tenantId, phone }
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  // Handle: sync, participant_joined, item_added, etc.
};
```

2. **Add Items:**
```typescript
ws.send(JSON.stringify({
  type: 'add_item',
  participantId: customerId,
  participantName: customerName,
  timestamp: Date.now(),
  data: {
    dishName: 'Chicken Biryani',
    dishType: 'non-veg',
    quantity: 2,
    price: 299
  }
}));
```

### PartyKit Deployment

```bash
cd stonepot-partykit
npm install
npx partykit login
npm run deploy
```

After deployment, update environment variables with PartyKit URL.

## Data Flow

### Customer Registration Flow
1. User provides name + phone (+ optional email/address) via voice
2. AI calls `capture_customer_info` function
3. Backend stores in session state
4. Backend upserts to Firestore `customers` collection
5. Returns customerId to AI
6. AI confirms to user

### Order Creation Flow
1. User completes voice order
2. Backend creates order in `orders` collection
3. Links order to customer via customerId
4. Order includes full cart details, status tracking
5. Customer can retrieve order history

### Collaborative Ordering Flow
1. User creates/joins circle
2. Circle owner starts collaborative order
3. Backend creates Firestore `collaborative_orders` document
4. Backend creates PartyKit room with same session ID
5. Participants connect to PartyKit room
6. Real-time sync via WebSocket
7. Items added with owner tracking
8. Owner finalizes order
9. PartyKit marks as finalized
10. Backend creates individual orders or single group order

## Phone Number Handling

**Problem:** LLM was converting phone numbers to numerical format ("nine million...")

**Solution:**
1. Function parameter description emphasizes string format
2. System instructions include explicit digit-by-digit confirmation
3. AI asks user to say each digit clearly
4. AI confirms back digit-by-digit: "Let me confirm: nine, eight, seven, six..."
5. Backend always stores as string (e.g., "9876543210")

## Testing

### Test Customer Creation
```bash
# Via voice: "My name is John and my phone number is 9876543210"
# AI should call capture_customer_info with:
# { name: "John", phone: "9876543210" }
```

### Test Order History
```javascript
const orders = await customerService.getCustomerOrders('tenant_id', '9876543210', 5);
console.log('Recent orders:', orders);
```

### Test PartyKit
```bash
npm install -g wscat
cd stonepot-partykit
npm run dev

# In another terminal:
wscat -c ws://localhost:1999/parties/collaborative_order/test_session

# Send:
{"type":"join","participantId":"test_user","participantName":"Test","timestamp":1234567890,"data":{"circleId":"test","tenantId":"test","phone":"1234567890"}}
```

## Security Considerations

1. **Firestore Rules:** All customer/order collections are backend-only
2. **PartyKit Auth:** Add authentication via connection context (future)
3. **Phone Validation:** Validate 10-digit phone format before storage
4. **Circle Membership:** Verify user is circle member before allowing collaborative order actions
5. **Rate Limiting:** Implement on PartyKit messages (future)

## Future Enhancements

1. **AI Functions for Circles:**
   - `create_circle` - Create family/friend circle
   - `invite_to_circle` - Invite member
   - `start_collaborative_order` - Start group order
   - `get_circle_members` - List circle members

2. **Frontend Components:**
   - CircleManager - Manage circles UI
   - CollaborativeOrderPanel - Live order view
   - SplitCalculator - Payment split UI
   - OrderHistory - Past orders view

3. **PartyKit Enhancements:**
   - Voice participant markers
   - Real-time split calculator
   - Admin controls for order owner
   - Timeout inactive orders

4. **Backend Webhooks:**
   - PartyKit → Backend webhook on finalize
   - Automatic order creation from collaborative orders
   - Payment integration with split amounts

## Files Created/Modified

### Created:
- `stonepot-restaurant/src/services/CustomerService.js`
- `stonepot-restaurant/src/services/CircleService.js`
- `stonepot-restaurant/FIRESTORE_SCHEMA.md`
- `stonepot-partykit/package.json`
- `stonepot-partykit/partykit.json`
- `stonepot-partykit/tsconfig.json`
- `stonepot-partykit/src/server.ts`
- `stonepot-partykit/.gitignore`
- `stonepot-partykit/README.md`
- `CUSTOMER_MANAGEMENT_IMPLEMENTATION.md` (this file)

### Modified:
- `stonepot-restaurant/src/services/VertexAILiveService.js` - Added CustomerService import, updated constructor, expanded orderState, updated capture_customer_info handler, added system instructions for phone numbers

## Next Steps

1. Deploy PartyKit server to production
2. Create AI functions for circle management
3. Build frontend components for collaborative ordering
4. Test end-to-end collaborative ordering flow
5. Add payment split functionality
6. Implement order history UI in client
7. Add push notifications for collaborative order updates
8. Create admin dashboard for circle/order management
