# Collaborative Ordering Integration Guide

Complete integration of PartyKit-based collaborative ordering with voice AI backend.

## PartyKit Deployment

✅ **Deployed at:** https://stonepot-collaborative-orders.suyeshs.partykit.dev

### WebSocket URL Format
```
wss://stonepot-collaborative-orders.suyeshs.partykit.dev/parties/collaborative_order/{roomId}
```

## Backend Integration (Completed)

### 1. Configuration

**File:** [config/shared.js](config/shared.js#L124-L128)

Added PartyKit configuration:
```javascript
partykit: {
  url: process.env.PARTYKIT_URL || 'https://stonepot-collaborative-orders.suyeshs.partykit.dev',
  wsUrl: process.env.PARTYKIT_WS_URL || 'wss://stonepot-collaborative-orders.suyeshs.partykit.dev'
}
```

### 2. Services Initialized

**File:** [VertexAILiveService.js](stonepot-restaurant/src/services/VertexAILiveService.js)

- ✅ CustomerService imported and initialized
- ✅ CircleService imported and initialized
- ✅ PartyKit config available via `this.config.partykit`

### 3. AI Functions Added

Four new voice AI functions for circle management:

#### `create_circle`
Creates a family or friends circle.

**Parameters:**
- `circleName` (string): Name for the circle (e.g., "Sharma Family")
- `circleType` (enum): 'family' or 'friends'

**Example Voice Command:**
> "Create a family circle called Sharma Family"

**Response:**
```json
{
  "success": true,
  "circle": {
    "id": "circle_abc123",
    "name": "Sharma Family",
    "type": "family",
    "members": [...]
  },
  "message": "Created family circle 'Sharma Family'. You can now invite members."
}
```

#### `invite_to_circle`
Invite someone to a circle.

**Parameters:**
- `circleId` (string): Circle ID
- `inviteeName` (string): Name of person to invite
- `inviteePhone` (string): Phone number (10 digits)

**Example Voice Command:**
> "Add Priya, phone number 9876543210, to my Sharma Family circle"

**Response:**
```json
{
  "success": true,
  "message": "Priya has been added to the circle"
}
```

#### `start_collaborative_order`
Start a collaborative group order.

**Parameters:**
- `circleId` (string): Circle ID to order with

**Example Voice Command:**
> "Start a group order with my Sharma Family circle"

**Response:**
```json
{
  "success": true,
  "collaborativeOrder": {
    "id": "collab_xyz789",
    "circleId": "circle_abc123",
    "sessionId": "session_123",
    "participants": [...],
    "items": [],
    "total": 0
  },
  "partykitRoomUrl": "wss://stonepot-collaborative-orders.suyeshs.partykit.dev/parties/collaborative_order/collab_xyz789",
  "message": "Started collaborative order for your circle. Share this session to let others join!"
}
```

**Backend Actions:**
1. Creates Firestore `collaborative_orders` document
2. Creates PartyKit room with same ID
3. Returns WebSocket URL for frontend to connect
4. Stores collaborative order ID in session state

#### `get_my_circles`
Get list of customer's circles.

**Parameters:** None

**Example Voice Command:**
> "What circles am I in?" or "Show my groups"

**Response:**
```json
{
  "success": true,
  "circles": [
    {
      "id": "circle_abc123",
      "name": "Sharma Family",
      "type": "family",
      "members": [...]
    }
  ],
  "message": "You are in 1 circle(s): Sharma Family"
}
```

## Frontend Integration (To Be Implemented)

### Step 1: Listen for Collaborative Order Start

When `start_collaborative_order` is called, the backend sends a WebSocket message:

```typescript
// In page.tsx, listen for collaborative order events
case 'collaborative_order_started':
  const { collaborativeOrder, partykitRoomUrl } = update.data;

  // Connect to PartyKit room
  connectToPartyKit(partykitRoomUrl, collaborativeOrder);
  break;
```

### Step 2: Connect to PartyKit

```typescript
let partykitConnection: WebSocket | null = null;

function connectToPartyKit(roomUrl: string, orderData: any) {
  partykitConnection = new WebSocket(roomUrl);

  partykitConnection.onopen = () => {
    console.log('[PartyKit] Connected to collaborative order room');

    // Join the order
    partykitConnection?.send(JSON.stringify({
      type: 'join',
      participantId: customerId,
      participantName: customerName,
      timestamp: Date.now(),
      data: {
        circleId: orderData.circleId,
        tenantId: orderData.tenantId,
        phone: customerPhone
      }
    }));
  };

  partykitConnection.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handlePartykitMessage(message);
  };

  partykitConnection.onerror = (error) => {
    console.error('[PartyKit] Error:', error);
  };

  partykitConnection.onclose = () => {
    console.log('[PartyKit] Disconnected from collaborative order');
  };
}
```

### Step 3: Handle PartyKit Messages

```typescript
function handlePartykitMessage(message: any) {
  switch (message.type) {
    case 'sync':
      // Initial state received
      updateCollaborativeOrderUI(message.data);
      break;

    case 'participant_joined':
      // Someone joined the order
      showNotification(`${message.participantName} joined the order`);
      updateCollaborativeOrderUI(message.data);
      break;

    case 'participant_left':
      // Someone left
      showNotification(`${message.participantName} left the order`);
      updateCollaborativeOrderUI(message.data);
      break;

    case 'item_added':
      // Item added to collaborative order
      const { item, orderState } = message.data;
      showNotification(`${message.participantName} added ${item.dishName}`);
      updateCollaborativeOrderUI(orderState);
      break;

    case 'item_removed':
      // Item removed
      showNotification(`${message.participantName} removed an item`);
      updateCollaborativeOrderUI(message.data.orderState);
      break;

    case 'quantity_updated':
      // Quantity changed
      updateCollaborativeOrderUI(message.data.orderState);
      break;

    case 'order_finalized':
      // Order finalized
      showNotification('Order has been finalized!');
      updateCollaborativeOrderUI(message.data);
      break;
  }
}
```

### Step 4: Add Items via Voice (Updates PartyKit)

When voice AI adds an item in collaborative mode:

```typescript
// In VertexAILiveService.js, after adding item to cart
if (session.orderState.collaborativeOrderId) {
  // Send to PartyKit as well
  await this.sendToPartyKit(session.orderState.collaborativeOrderId, {
    type: 'add_item',
    participantId: `${session.tenantId}_${session.orderState.customer.phone}`,
    participantName: session.orderState.customer.name,
    timestamp: Date.now(),
    data: {
      dishName: item.dishName,
      dishType: item.dishType,
      quantity: item.quantity,
      price: item.price,
      customization: item.customization
    }
  });
}
```

### Step 5: UI Components (To Create)

#### CollaborativeOrderPanel Component

```tsx
'use client';

import { observer } from 'mobx-react-lite';
import { useState, useEffect } from 'react';

interface Participant {
  id: string;
  name: string;
  phone: string;
  joinedAt: number;
}

interface CollaborativeOrderState {
  participants: Participant[];
  items: any[];
  total: number;
  status: 'active' | 'finalized';
}

export const CollaborativeOrderPanel = observer(function CollaborativeOrderPanel({
  orderState,
  onClose
}: {
  orderState: CollaborativeOrderState;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Group Order</h2>
            <p className="text-gray-600 text-sm mt-1">
              {orderState.participants.length} participant(s)
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {/* Participants */}
        <div className="mb-6">
          <h3 className="font-semibold mb-3">Participants</h3>
          <div className="flex flex-wrap gap-2">
            {orderState.participants.map((p) => (
              <div
                key={p.id}
                className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
              >
                {p.name}
              </div>
            ))}
          </div>
        </div>

        {/* Items */}
        <div className="mb-6">
          <h3 className="font-semibold mb-3">Items</h3>
          {orderState.items.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No items yet. Start adding via voice!
            </p>
          ) : (
            <div className="space-y-2">
              {orderState.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                >
                  <div>
                    <div className="font-medium">{item.dishName}</div>
                    <div className="text-sm text-gray-600">
                      Added by {item.addedByName} • Qty: {item.quantity}
                    </div>
                  </div>
                  <div className="text-lg font-semibold">
                    ₹{item.itemTotal}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Total */}
        <div className="border-t pt-4 flex items-center justify-between">
          <span className="text-lg font-semibold">Total</span>
          <span className="text-2xl font-bold text-blue-600">
            ₹{orderState.total}
          </span>
        </div>

        {/* Status */}
        {orderState.status === 'finalized' && (
          <div className="mt-4 bg-green-100 text-green-800 p-3 rounded-lg text-center">
            Order Finalized
          </div>
        )}
      </div>
    </div>
  );
});
```

## Voice Commands for Collaborative Ordering

### Setup Phase
1. **Provide Contact Info:**
   > "My name is Rajesh and my phone number is 9876543210"

2. **Create Circle:**
   > "Create a family circle called Sharma Family"
   > "Create a friends circle called Office Lunch Group"

3. **Invite Members:**
   > "Add Priya, phone number 9876543210, to Sharma Family circle"
   > "Invite Amit to my Office Lunch Group, his number is 9123456789"

4. **View Circles:**
   > "What circles am I in?"
   > "Show my groups"

### Ordering Phase
1. **Start Collaborative Order:**
   > "Start a group order with Sharma Family"
   > "Let's order together with Office Lunch Group"

2. **Add Items (Voice):**
   > "Add 2 Chicken Biryani"
   > "I want a Paneer Tikka"

3. **Others Join:**
   - Share session URL or QR code
   - Others connect and add their items via voice

4. **Finalize:**
   > "Finalize the order"
   > "We're done ordering"

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         Voice AI (Gemini)                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Functions: create_circle, invite_to_circle,               │  │
│  │            start_collaborative_order, get_my_circles      │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Function Calls
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Node.js)                             │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ CustomerService│  │  CircleService  │  │VertexAILiveService│
│  └────────┬───────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                   │                     │          │
│           ▼                   ▼                     ▼          │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    Firestore                              │ │
│  │  • customers          • circles                           │ │
│  │  • orders             • collaborative_orders              │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 │ Creates Room
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PartyKit Server                               │
│         https://stonepot-collaborative-orders.suyeshs           │
│                       .partykit.dev                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Room: /parties/collaborative_order/{orderId}            │  │
│  │  • Real-time WebSocket sync                              │  │
│  │  • Persistent state storage                              │  │
│  │  • Broadcast to all participants                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ WebSocket Connection
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Frontend Clients (Next.js)                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │  Participant 1   │  │  Participant 2   │  │ Participant 3│ │
│  │  (Initiator)     │  │                  │  │              │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
│           │                     │                     │         │
│           └─────────────────────┴─────────────────────┘         │
│                     Real-time Sync                               │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema

### Firestore Collections

#### `customers/{tenantId}_{phone}`
```json
{
  "tenantId": "restaurant_id",
  "phone": "9876543210",
  "name": "Rajesh Sharma",
  "email": "rajesh@example.com",
  "deliveryAddress": {...},
  "circles": [
    {
      "circleId": "circle_abc123",
      "type": "family",
      "joinedAt": "2025-01-19T10:00:00Z"
    }
  ]
}
```

#### `circles/{circleId}`
```json
{
  "tenantId": "restaurant_id",
  "name": "Sharma Family",
  "type": "family",
  "createdBy": "restaurant_id_9876543210",
  "members": [
    {
      "customerId": "restaurant_id_9876543210",
      "phone": "9876543210",
      "name": "Rajesh Sharma",
      "role": "owner",
      "joinedAt": "2025-01-19T10:00:00Z"
    }
  ],
  "activeOrders": ["collab_xyz789"]
}
```

#### `collaborative_orders/{orderId}`
```json
{
  "circleId": "circle_abc123",
  "tenantId": "restaurant_id",
  "sessionId": "session_123",
  "initiatedBy": "restaurant_id_9876543210",
  "participants": [...],
  "items": [
    {
      "id": "item_1",
      "dishName": "Chicken Biryani",
      "quantity": 2,
      "price": 299,
      "addedBy": "restaurant_id_9876543210",
      "addedByName": "Rajesh",
      "addedAt": 1234567890
    }
  ],
  "total": 598,
  "status": "active",
  "splitType": "equal"
}
```

## Testing

### Test Voice Commands

1. Start a voice session
2. Say: "My name is Rajesh and my phone is 9876543210"
3. Say: "Create a family circle called Test Family"
4. Say: "Start a group order with Test Family"
5. Verify PartyKit room is created in logs

### Test PartyKit Connection

```bash
npm install -g wscat

wscat -c "wss://stonepot-collaborative-orders.suyeshs.partykit.dev/parties/collaborative_order/test_room"

# Send join message:
{"type":"join","participantId":"test_user","participantName":"Test User","timestamp":1234567890,"data":{"circleId":"test_circle","tenantId":"test_tenant","phone":"1234567890"}}

# Send add item:
{"type":"add_item","participantId":"test_user","participantName":"Test User","timestamp":1234567890,"data":{"dishName":"Biryani","dishType":"non-veg","quantity":1,"price":299}}
```

## Next Steps

1. **Frontend Implementation:**
   - Create CollaborativeOrderPanel component
   - Add PartyKit WebSocket connection logic
   - Handle real-time message updates
   - Show participant list and live items

2. **Payment Split:**
   - Implement split calculator UI
   - Support equal/itemized/custom splits
   - Generate per-person payment amounts

3. **Notifications:**
   - Push notifications when someone joins
   - Notify on item additions
   - Alert when order is finalized

4. **Voice Enhancements:**
   - "Finalize order" voice command
   - "Remove [person]'s items" command
   - "Show who added what" command

5. **Admin Features:**
   - Circle management UI
   - Remove members from circle
   - Delete circles
   - View past collaborative orders

## Environment Variables

Add to `.env`:

```bash
PARTYKIT_URL=https://stonepot-collaborative-orders.suyeshs.partykit.dev
PARTYKIT_WS_URL=wss://stonepot-collaborative-orders.suyeshs.partykit.dev
```

## Deployment Checklist

- [x] PartyKit server deployed
- [x] Backend services created (CustomerService, CircleService)
- [x] AI functions implemented
- [x] Firestore schema documented
- [x] Config updated with PartyKit URLs
- [ ] Frontend PartyKit integration
- [ ] Collaborative order UI components
- [ ] Payment split calculator
- [ ] Push notifications
- [ ] E2E testing

---

**Status:** Backend fully integrated ✅ | Frontend pending 🔄
