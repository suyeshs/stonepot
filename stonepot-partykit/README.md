# Stonepot PartyKit Server

Real-time collaborative ordering server for Stonepot Restaurant using PartyKit.

## Features

- Real-time synchronization of collaborative orders
- Support for multiple participants in a single order
- Live updates when items are added/removed
- Split payment tracking (equal, itemized, custom)
- Persistent state storage via PartyKit
- Auto-reconnection support

## Architecture

PartyKit provides:
- WebSocket rooms with automatic scaling
- Built-in persistent storage
- Connection management
- Message broadcasting

Each collaborative order gets its own PartyKit "room" identified by a unique session ID.

## Setup

### Install Dependencies

```bash
cd stonepot-partykit
npm install
```

### Development

Run the PartyKit server locally:

```bash
npm run dev
```

This starts the server at `http://localhost:1999` (default PartyKit port).

### Deployment

Deploy to PartyKit cloud:

```bash
npm run deploy
```

You'll need to:
1. Create a PartyKit account at https://partykit.io
2. Login via CLI: `npx partykit login`
3. Deploy: `npm run deploy`

After deployment, you'll get a URL like:
```
https://stonepot-collaborative-orders.YOUR_USERNAME.partykit.dev
```

## Message Protocol

### Client → Server

#### Join Order
```json
{
  "type": "join",
  "participantId": "tenant_9876543210",
  "participantName": "John Doe",
  "timestamp": 1234567890,
  "data": {
    "circleId": "circle_abc123",
    "tenantId": "restaurant_id",
    "phone": "9876543210"
  }
}
```

#### Add Item
```json
{
  "type": "add_item",
  "participantId": "tenant_9876543210",
  "participantName": "John Doe",
  "timestamp": 1234567890,
  "data": {
    "dishName": "Chicken Biryani",
    "dishType": "non-veg",
    "quantity": 2,
    "price": 299,
    "customization": "Extra spicy"
  }
}
```

#### Remove Item
```json
{
  "type": "remove_item",
  "participantId": "tenant_9876543210",
  "participantName": "John Doe",
  "timestamp": 1234567890,
  "data": {
    "itemId": "item_xyz789"
  }
}
```

#### Update Quantity
```json
{
  "type": "update_quantity",
  "participantId": "tenant_9876543210",
  "participantName": "John Doe",
  "timestamp": 1234567890,
  "data": {
    "itemId": "item_xyz789",
    "quantity": 3
  }
}
```

#### Update Split Type
```json
{
  "type": "update_split",
  "participantId": "tenant_9876543210",
  "participantName": "John Doe",
  "timestamp": 1234567890,
  "data": {
    "splitType": "equal"
  }
}
```

#### Finalize Order
```json
{
  "type": "finalize",
  "participantId": "tenant_9876543210",
  "participantName": "John Doe",
  "timestamp": 1234567890
}
```

#### Leave Order
```json
{
  "type": "leave",
  "participantId": "tenant_9876543210",
  "participantName": "John Doe",
  "timestamp": 1234567890
}
```

### Server → Client

#### Sync (Initial State)
```json
{
  "type": "sync",
  "data": {
    "circleId": "circle_abc123",
    "tenantId": "restaurant_id",
    "sessionId": "session_xyz",
    "initiatedBy": "tenant_9876543210",
    "participants": [...],
    "items": [...],
    "total": 1200,
    "splitType": "equal",
    "status": "active"
  },
  "timestamp": 1234567890
}
```

#### Participant Joined
```json
{
  "type": "participant_joined",
  "participantId": "tenant_1234567890",
  "participantName": "Jane Smith",
  "data": { /* full order state */ },
  "timestamp": 1234567890
}
```

#### Item Added
```json
{
  "type": "item_added",
  "participantId": "tenant_9876543210",
  "participantName": "John Doe",
  "data": {
    "item": { /* item details */ },
    "orderState": { /* full order state */ }
  },
  "timestamp": 1234567890
}
```

## Integration with Backend

The stonepot-restaurant backend should:

1. Create a PartyKit room when starting a collaborative order
2. Store the room ID in Firestore `collaborative_orders` collection
3. Send room ID to clients via WebSocket
4. Clients connect to PartyKit room directly
5. Backend receives finalized order from PartyKit webhook (optional)

## Environment Variables

Create `.env.local`:

```env
PARTYKIT_API_URL=https://stonepot-collaborative-orders.USERNAME.partykit.dev
```

## Testing

### Test WebSocket Connection

Use `wscat` to test:

```bash
npm install -g wscat
wscat -c ws://localhost:1999/parties/collaborative_order/test_session_123
```

Then send:
```json
{
  "type": "join",
  "participantId": "test_user",
  "participantName": "Test User",
  "timestamp": 1234567890,
  "data": {
    "circleId": "test_circle",
    "tenantId": "test_tenant",
    "phone": "1234567890"
  }
}
```

## Security Considerations

- Add authentication via PartyKit's connection context
- Validate participant permissions (circle membership)
- Rate limit messages per connection
- Sanitize user input before broadcasting

## Future Enhancements

- Add voice participant markers
- Real-time payment split calculator
- Order history within room
- Admin controls for order owner
- Timeout inactive orders
