# Firestore Collections Schema

This document describes the Firestore collections structure for the Stonepot Restaurant backend.

## Collections

### 1. `customers`
Stores customer profiles with order history tracking.

**Document ID Format:** `{tenantId}_{phone}`

**Schema:**
```javascript
{
  tenantId: string,
  phone: string,           // 10-digit phone number as string
  name: string,
  email: string | null,
  deliveryAddress: {
    street: string,
    apartment: string,
    city: string,
    state: string,
    pincode: string,
    landmark: string
  } | null,
  circles: [
    {
      circleId: string,    // Reference to circles collection
      type: 'family' | 'friends',
      joinedAt: ISO timestamp
    }
  ],
  createdAt: ISO timestamp,
  updatedAt: ISO timestamp
}
```

**Indexes:**
- `tenantId` (ascending)
- `phone` (ascending)
- Composite: `tenantId` + `phone`

---

### 2. `orders`
Stores completed orders with full order details.

**Document ID:** Auto-generated

**Schema:**
```javascript
{
  tenantId: string,
  customerId: string,      // Reference to customers collection
  sessionId: string,       // Voice session ID
  orderType: 'dine-in' | 'takeaway' | 'delivery',
  items: [
    {
      id: string,
      dishName: string,
      dishType: 'veg' | 'non-veg',
      quantity: number,
      price: number,
      itemTotal: number,
      customization: string | null
    }
  ],
  total: number,
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled',
  statusUpdatedAt: ISO timestamp,
  createdAt: ISO timestamp,
  updatedAt: ISO timestamp
}
```

**Indexes:**
- `tenantId` (ascending)
- `customerId` (ascending)
- `createdAt` (descending)
- Composite: `tenantId` + `customerId` + `createdAt` (descending)
- Composite: `tenantId` + `status` + `createdAt` (descending)

---

### 3. `circles`
Stores family/friend circles for collaborative ordering.

**Document ID:** Auto-generated

**Schema:**
```javascript
{
  tenantId: string,
  name: string,            // Circle name (e.g., "Sharma Family", "Work Friends")
  type: 'family' | 'friends',
  createdBy: string,       // Customer ID of creator
  members: [
    {
      customerId: string,
      phone: string,
      name: string,
      role: 'owner' | 'member',
      invitedBy: string | null,
      joinedAt: ISO timestamp
    }
  ],
  activeOrders: [string],  // Array of collaborative_orders IDs
  status: 'active' | 'inactive',
  createdAt: ISO timestamp,
  updatedAt: ISO timestamp
}
```

**Indexes:**
- `tenantId` (ascending)
- `status` (ascending)
- `createdBy` (ascending)

---

### 4. `collaborative_orders`
Stores active collaborative orders for circles.

**Document ID:** Auto-generated

**Schema:**
```javascript
{
  circleId: string,        // Reference to circles collection
  tenantId: string,
  sessionId: string,       // PartyKit room ID
  initiatedBy: string,     // Customer ID of initiator
  participants: [
    {
      customerId: string,
      phone: string,
      name: string,
      joinedAt: ISO timestamp
    }
  ],
  items: [
    {
      id: string,
      dishName: string,
      dishType: 'veg' | 'non-veg',
      quantity: number,
      price: number,
      itemTotal: number,
      customization: string | null,
      addedBy: string,     // Customer ID who added this item
      addedAt: ISO timestamp
    }
  ],
  total: number,
  status: 'active' | 'finalized' | 'cancelled',
  splitType: 'equal' | 'itemized' | 'custom',
  splitDetails: {
    // For 'equal' split
    perPerson: number,

    // For 'itemized' split
    byCustomer: {
      [customerId]: {
        items: [string],   // Item IDs
        subtotal: number
      }
    },

    // For 'custom' split
    customSplits: [
      {
        customerId: string,
        amount: number
      }
    ]
  } | null,
  finalizedAt: ISO timestamp | null,
  createdAt: ISO timestamp,
  updatedAt: ISO timestamp
}
```

**Indexes:**
- `tenantId` (ascending)
- `circleId` (ascending)
- `status` (ascending)
- `sessionId` (ascending)
- Composite: `circleId` + `status` + `createdAt` (descending)

---

### 5. `sessions` (Existing)
Stores voice session state.

**Schema:** (No changes, already exists)

---

### 6. `organizations` (Existing)
Stores restaurant/tenant profiles.

**Schema:** (No changes, already exists)

---

### 7. `tenant_content` (Existing)
Stores menu items and other tenant content.

**Schema:** (No changes, already exists)

---

### 8. `ai_config` (Existing)
Stores AI configuration per tenant.

**Schema:** (No changes, already exists)

---

## Setup Instructions

### Create Indexes via Firebase Console

1. Navigate to Firestore Database in Firebase Console
2. Click on "Indexes" tab
3. Create composite indexes as specified above

### Create Indexes via Firebase CLI

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Deploy indexes
firebase deploy --only firestore:indexes
```

### Example `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "customers",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "phone", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "customerId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "collaborative_orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "circleId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

## Security Rules

Add these security rules to protect customer data:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Customers collection - read/write only by backend
    match /customers/{customerId} {
      allow read, write: if false; // Backend only
    }

    // Orders collection - read/write only by backend
    match /orders/{orderId} {
      allow read, write: if false; // Backend only
    }

    // Circles collection - read/write only by backend
    match /circles/{circleId} {
      allow read, write: if false; // Backend only
    }

    // Collaborative orders - read/write only by backend
    match /collaborative_orders/{orderId} {
      allow read, write: if false; // Backend only
    }

    // Existing collections (keep your current rules)
    match /sessions/{sessionId} {
      allow read, write: if false; // Backend only
    }

    match /organizations/{tenantId} {
      allow read: if true; // Public read for restaurant info
      allow write: if false; // Backend only
    }

    match /tenant_content/{contentId} {
      allow read: if true; // Public read for menu
      allow write: if false; // Backend only
    }
  }
}
```

## Migration Notes

- All existing data remains unchanged
- New collections will be created automatically when first documents are inserted
- No data migration needed for existing `sessions`, `organizations`, `tenant_content` collections
- Customer data from sessions will be copied to new `customers` collection on next order
