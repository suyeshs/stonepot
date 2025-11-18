# Admin App → Firestore Integration

## Overview

The admin app (`facemash-platform/admin-app`) now provisions restaurant data to Firestore via the stonepot-restaurant backend API during the onboarding process.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Admin App (Cloudflare Pages)                                 │
│ https://facemash-admin.pages.dev                             │
└──────────────────────────────────────────────────────────────┘
                         │
                         │ Step 1: Create tenant (KV + D1)
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ POST /api/tenants                                            │
│ - Creates tenant in Cloudflare KV                           │
│ - Provisions D1 database                                    │
│ - Assigns subdomain                                         │
└──────────────────────────────────────────────────────────────┘
                         │
                         │ Steps 2-5: Collect data
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ Onboarding Wizard (localStorage)                            │
│ - Brand Identity                                            │
│ - Restaurant Profile                                        │
│ - AI Configuration                                          │
│ - Menu Setup                                                │
└──────────────────────────────────────────────────────────────┘
                         │
                         │ Step 6: Launch
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ PATCH /api/tenants/{tenantId}                               │
│ - Updates KV with onboarding data                          │
└──────────────────────────────────────────────────────────────┘
                         │
                         │ NEW: Provision Firestore
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ POST https://stonepot-restaurant.run.app                    │
│      /api/restaurant/tenants/provision                      │
│                                                              │
│ - Creates organization/{tenantId}                           │
│ - Creates ai_config/{tenantId}                             │
│ - Creates menu items in tenant_content/                    │
│ - Creates locations (if provided)                          │
└──────────────────────────────────────────────────────────────┘
                         │
                         ↓
┌──────────────────────────────────────────────────────────────┐
│ Google Firestore (sahamati-labs)                           │
│                                                              │
│ organizations/{tenantId}/                                   │
│   - name, cuisine, address, phone, hours                   │
│   - branding: { primaryColor, logo, tagline }              │
│   - status: 'active'                                       │
│                                                              │
│ ai_config/{tenantId}/                                       │
│   - voiceName, tone, responseLength                        │
│   - allowedLanguages                                       │
│                                                              │
│ tenant_content/                                             │
│   - Menu items with type: 'menu_item'                      │
│   - Full menu data for voice AI                            │
│                                                              │
│ organizations/{tenantId}/locations/                         │
│   - Multiple restaurant locations                          │
│   - Delivery radius, postal codes                          │
└──────────────────────────────────────────────────────────────┘
```

## Implementation Details

### Backend Endpoint

**File:** `stonepot-restaurant/src/routes/restaurantRoutes.js`
**Endpoint:** `POST /api/restaurant/tenants/provision`
**Lines:** 704-847

**Request Body:**
```typescript
{
  tenantId: string;           // Required - tenant identifier
  companyName: string;        // Required - restaurant name
  restaurantProfile: {        // Required
    cuisine: string;
    address: string;
    phone: string;
    hours: string;
    about?: string;
  };
  aiConfig?: {                // Optional
    voiceName: string;
    tone: object;
    responseLength: string;
    allowedLanguages: string[];
  };
  menuItems?: Array<{         // Optional
    name: string;
    description: string;
    price: number;
    category: string;
    type?: 'veg' | 'non-veg';
    imageUrl?: string;
  }>;
  brandIdentity?: {           // Optional
    primaryColor: string;
    logo?: string;
    tagline?: string;
  };
  locations?: Array<{         // Optional (future multi-location)
    name?: string;
    address: string;
    city: string;
    postalCode: string;
    latitude?: number;
    longitude?: number;
    deliveryRadius?: number;
    deliveryZones?: string[];
  }>;
}
```

**Response:**
```json
{
  "success": true,
  "message": "Restaurant provisioned successfully",
  "data": {
    "tenantId": "stonepot-koramangala",
    "organizationCreated": true,
    "aiConfigCreated": true,
    "menuItemsCreated": 5,
    "locationsCreated": 0
  }
}
```

### Frontend Integration

**File:** `admin-app/src/components/onboarding/RestaurantOnboardingWizard.tsx`
**Function:** `handleLaunch()`
**Lines:** 192-260

The integration happens in two steps:

1. **Update KV tenant data** (existing)
   ```typescript
   await fetch(`/api/tenants/${tenantId}`, {
     method: 'PATCH',
     body: JSON.stringify({ ...onboardingData })
   });
   ```

2. **Provision Firestore** (new)
   ```typescript
   await fetch('https://stonepot-restaurant.run.app/api/restaurant/tenants/provision', {
     method: 'POST',
     body: JSON.stringify({
       tenantId,
       companyName,
       restaurantProfile,
       aiConfig,
       menuItems,
       brandIdentity
     })
   });
   ```

**Error Handling:**
- If Firestore provisioning fails, the onboarding continues
- Error is logged to console for debugging
- User is not blocked from completing onboarding

## CORS Configuration

**Updated:** 2025-01-17

The stonepot-restaurant backend now accepts requests from:
- `https://stonepot-restaurant-client.suyesh.workers.dev` (voice client)
- `http://localhost:3000` (local development)
- `https://facemash-admin.pages.dev` (admin app production)
- `https://admin.thestonepot.pro` (custom domain)

**Environment Variable:**
```bash
ALLOWED_ORIGINS="https://stonepot-restaurant-client.suyesh.workers.dev http://localhost:3000 https://facemash-admin.pages.dev https://admin.thestonepot.pro"
```

## Firestore Schema

### organizations/{tenantId}
```javascript
{
  tenantId: "stonepot-koramangala",
  name: "Stonepot Koramangala",
  cuisine: "South Indian",
  address: "123 Main Road, Koramangala, Bangalore",
  phone: "+91-80-12345678",
  hours: "9:00 AM - 10:00 PM",
  about: "Traditional Coorgi cuisine...",
  status: "active",
  branding: {
    primaryColor: "#7c3aed",
    logo: "https://...",
    tagline: "Authentic Coorgi flavors"
  },
  createdAt: "2025-01-17T10:30:00.000Z",
  updatedAt: "2025-01-17T10:30:00.000Z"
}
```

### ai_config/{tenantId}
```javascript
{
  tenantId: "stonepot-koramangala",
  voiceName: "Puck",  // Indian English voice
  tone: {
    style: "friendly",
    personality: "helpful",
    formality: "balanced"
  },
  responseLength: "moderate",
  allowedLanguages: ["en", "hi"],
  createdAt: "2025-01-17T10:30:00.000Z",
  updatedAt: "2025-01-17T10:30:00.000Z"
}
```

### tenant_content/{itemId}
```javascript
{
  id: "auto-generated-id",
  tenantId: "stonepot-koramangala",
  type: "menu_item",
  name: "Pandi Curry Combo",
  description: "Traditional Coorgi pork curry with rice",
  price: 255,
  category: "combos",
  type: "non-veg",
  imageUrl: "https://...",
  available: true,
  createdAt: "2025-01-17T10:30:00.000Z",
  updatedAt: "2025-01-17T10:30:00.000Z"
}
```

### organizations/{tenantId}/locations/{locationId}
```javascript
{
  tenantId: "stonepot",
  name: "Stonepot Koramangala",
  address: "123 Main Road, Koramangala",
  city: "Bangalore",
  postalCode: "560034",
  latitude: 12.9352,
  longitude: 77.6245,
  deliveryRadius: 5.0,  // km
  deliveryZones: ["560034", "560047", "560095"],
  isActive: true,
  phone: "+91-80-12345678",
  hours: "9:00 AM - 10:00 PM",
  createdAt: "2025-01-17T10:30:00.000Z",
  updatedAt: "2025-01-17T10:30:00.000Z"
}
```

## Data Flow Summary

| Step | Action | Storage | Purpose |
|------|--------|---------|---------|
| 1 | Create tenant | Cloudflare KV | Tenant metadata, subdomain |
| 1 | Provision database | Cloudflare D1 | Tenant-specific data tables |
| 2-5 | Collect onboarding data | localStorage | Temporary storage during wizard |
| 6a | Update tenant | Cloudflare KV | Save complete onboarding data |
| 6b | **Provision restaurant** | **Firestore** | **Restaurant profile, AI config, menu** |

## Testing

### Local Testing

1. **Start admin app:**
   ```bash
   cd /Users/stonepot-tech/facemash-platform/admin-app
   npm run dev
   ```

2. **Navigate to restaurant onboarding:**
   ```
   http://localhost:3000/onboarding/restaurant
   ```

3. **Complete onboarding wizard:**
   - Step 1: Restaurant Basics
   - Step 2: Brand Identity
   - Step 3: Restaurant Profile
   - Step 4: AI Configuration
   - Step 5: Menu Setup (add at least 1 item)
   - Step 6: Review & Launch

4. **Check Firestore console:**
   ```
   https://console.firebase.google.com/project/sahamati-labs/firestore/data
   ```

   Verify collections:
   - `organizations/{tenantId}` exists
   - `ai_config/{tenantId}` exists
   - `tenant_content/` has menu items

### Production Testing

1. **Deploy admin app:**
   ```bash
   cd /Users/stonepot-tech/facemash-platform/admin-app
   npm run deploy
   ```

2. **Test at:**
   ```
   https://facemash-admin.pages.dev/onboarding/restaurant
   ```

3. **Check backend logs:**
   ```bash
   gcloud run services logs read stonepot-restaurant \
     --region=us-central1 \
     --limit=50
   ```

   Look for:
   ```
   [RestaurantRoutes] Provisioning restaurant from admin app
   [RestaurantRoutes] Created organization document
   [RestaurantRoutes] Created AI config
   [RestaurantRoutes] Created menu items
   ```

## Troubleshooting

### Error: CORS blocked

**Symptom:** Admin app console shows CORS error when calling provision endpoint

**Solution:** Verify ALLOWED_ORIGINS includes admin app domain:
```bash
gcloud run services describe stonepot-restaurant \
  --region=us-central1 \
  --format="value(spec.template.spec.containers[0].env)" | grep ALLOWED_ORIGINS
```

### Error: Failed to provision restaurant

**Symptom:** Provision endpoint returns 500 error

**Possible causes:**
1. **Firebase not initialized** - Check service account credentials
2. **Invalid data** - Verify request body matches schema
3. **Firestore permissions** - Check IAM roles

**Debug:**
```bash
# Check backend logs
gcloud run services logs read stonepot-restaurant --region=us-central1 --limit=100

# Test endpoint directly
curl -X POST https://stonepot-restaurant.run.app/api/restaurant/tenants/provision \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "test-restaurant",
    "companyName": "Test Restaurant",
    "restaurantProfile": {
      "cuisine": "Indian",
      "address": "123 Test St",
      "phone": "+91-1234567890",
      "hours": "9-9"
    }
  }'
```

### Menu items not appearing in voice AI

**Symptom:** Voice AI can't find dishes even though they're in Firestore

**Cause:** Voice AI uses static menu by default (config.useStaticMenu = true)

**Solution:** Either:
1. Update static menu file to match Firestore data
2. Set `useStaticMenu: false` in MenuManagementService config

## Future Enhancements

### 1. Multi-Location Support
- Add location collection step in onboarding wizard (Step 3.5)
- Collect multiple addresses, delivery zones
- Provision D1 + Firestore for each location

### 2. Menu Excel Upload Processing
- Parse uploaded Excel file in admin app
- Convert to menu items array
- Send to provisioning endpoint

### 3. Bulk Menu Import
- Add endpoint: `POST /api/restaurant/tenants/{id}/menu/bulk`
- Support CSV/Excel upload after onboarding

### 4. Cloudflare Geo Integration
- Capture CF geo data on session start
- Save suggested location with order
- Use for delivery radius validation

### 5. Real-time Sync
- Add webhook from admin app when menu updated
- Sync Firestore → D1 for edge performance
- Invalidate static menu cache

## Related Documentation

- [Firestore Setup Guide](./FIRESTORE_SETUP.md)
- [Multi-Location Architecture](./MULTI_LOCATION_RESTAURANT_ARCHITECTURE.md)
- [Admin App Documentation](../facemash-platform/admin-app/README.md)
- [Stonepot Restaurant API](./stonepot-restaurant/README.md)
