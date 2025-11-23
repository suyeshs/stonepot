# Quick Start - Collaborative Ordering

## 🚀 Start Development Server

```bash
cd stonepot-restaurant-client
npm install
npm run dev
```

Open http://localhost:3000

---

## 📱 Voice Commands Cheat Sheet

### Setup
```
"My name is Rajesh and my phone is 9876543210"
"Create a family circle called Sharma Family"
"Invite Priya to Sharma Family, her number is 9876543210"
```

### Start Collaborative Order
```
"Start a group order with Sharma Family"
"Start a group order with my Office Lunch circle"
```

### Ordering
```
"Add 2 Chicken Biryani"
"I want Paneer Tikka"
"Remove the biryani"
"What's in our order?"
```

### Finalize
```
"Finalize the order"
"We're done ordering"
```

---

## 🧪 Quick Test

### Single User Test (2 minutes)
1. Open browser → http://localhost:3000
2. Click blue FAB → "Start Voice Order"
3. Say: **"My name is Test and my phone is 1234567890"**
   ✅ Toast appears: "Welcome, Test!"
4. Say: **"Create a family circle called Test Family"**
   ✅ Toast: "Circle 'Test Family' created"
5. Say: **"Start a group order with Test Family"**
   ✅ Collaborative panel opens
   ✅ Shows "Test Family" header
   ✅ Shows 1 participant (you)
6. Say: **"Add 2 Chicken Biryani"**
   ✅ Item appears with green flash
   ✅ Split shows your amount
7. Say: **"Finalize the order"**
   ✅ Shows "Order Finalized ✓"

### Two-User Sync Test (5 minutes)
1. Open **Tab 1** → Complete steps 1-6 above (don't finalize)
2. Open **Tab 2** → New session
3. Tab 2: Say **"My name is Priya and my phone is 9876543210"**
4. Tab 1: Say **"Invite Priya to Test Family, her number is 9876543210"**
   ✅ Toast: "Priya added to circle"
5. Tab 2: Say **"Start a group order with Test Family"**
   ✅ Tab 1 shows toast: "Priya joined the order"
   ✅ Tab 2 sees existing biryani items
6. Tab 2: Say **"Add 1 Paneer Tikka"**
   ✅ Tab 1: Toast + amber flash
   ✅ Tab 2: Green flash
7. Both tabs: Check split calculator
   ✅ Equal split shows ₹X per person
   ✅ Itemized split shows who pays for what
8. Tab 1: Say **"Finalize the order"**
   ✅ Both tabs show "Order Finalized ✓"

---

## 🔍 Debug Console

```javascript
// Check collaborative order state:
window.collaborativeOrderStore

// Check participants:
collaborativeOrderStore.participants

// Check items:
collaborativeOrderStore.items

// Check split:
collaborativeOrderStore.splitAmounts

// Check connection:
collaborativeOrderStore.isConnected

// Manual PartyKit send:
window.partykitServiceRef?.current?.sendAddItem({
  dishName: 'Test Item',
  dishType: 'veg',
  quantity: 1,
  price: 100
})
```

---

## 📦 Key Files

| File | Purpose |
|------|---------|
| `app/page.tsx` | Main app with PartyKit integration |
| `app/stores/collaborativeOrderStore.ts` | MobX state |
| `app/services/PartyKitService.ts` | WebSocket client |
| `app/components/collaborative/CollaborativeOrderPanel.tsx` | Main UI |
| `app/components/Toast.tsx` | Notifications |

---

## 🎨 UI Components

### CollaborativeOrderPanel
- **Mobile**: Bottom sheet (85vh)
- **Desktop**: Right panel (600px wide)
- **Features**: Header, participants, items, split calculator, footer

### ParticipantsList
- **Mobile**: Horizontal scroll
- **Desktop**: Vertical list
- **Shows**: Avatar, online status, owner badge

### CollaborativeItemsList
- **Empty state**: Mic icon + instructions
- **Item cards**: Name, price, quantity, owner
- **Animations**: Green flash (yours), amber flash (others)

### SplitCalculator
- **Types**: Equal | By Items | Custom
- **Mobile**: Expandable bottom sheet
- **Desktop**: Fixed right sidebar

### Toast
- **Types**: success (green), error (red), info (blue), participant (blue)
- **Duration**: 4 seconds default
- **Position**: Top right
- **Animation**: Slide in from right

---

## 🐛 Common Issues

### "Failed to connect to group order"
**Fix**: Check customer info was captured (name + phone required)

### Items not syncing
**Fix**: Check browser console for WebSocket errors

### No toast notifications
**Fix**: Check `showToast()` function is called in event handlers

### Panel not opening
**Fix**: Check `showCollaborativeOrder` state is true

### Flash animation not working
**Fix**: Check `lastItemAddedBy` in collaborativeOrderStore

---

## 🚦 Status Indicators

| Indicator | Meaning |
|-----------|---------|
| 🟢 Green dot | Participant online |
| 👑 Crown icon | Circle owner |
| "You" label | Current user |
| Green flash | You added item |
| Amber flash | Someone else added |
| "Reconnecting..." banner | Connection lost |

---

## 📞 PartyKit Server

**URL**: https://stonepot-collaborative-orders.suyeshs.partykit.dev

**WebSocket**: wss://stonepot-collaborative-orders.suyeshs.partykit.dev

**Test Connection**:
```bash
npm install -g wscat
wscat -c "wss://stonepot-collaborative-orders.suyeshs.partykit.dev/parties/collaborative_order/test_room"

# Send:
{"type":"join","participantId":"test","participantName":"Test","timestamp":1234567890,"data":{"circleId":"test","tenantId":"test","phone":"1234567890"}}
```

---

## 🎯 Quick Fixes

### Reset state:
```javascript
collaborativeOrderStore.clear()
```

### Force reconnect:
```javascript
window.partykitServiceRef?.current?.disconnect()
window.location.reload()
```

### Clear toasts:
```javascript
setToasts([])
```

### Close collaborative panel:
```javascript
setShowCollaborativeOrder(false)
```

---

## ✅ Feature Checklist

- [x] PartyKit connection
- [x] Real-time participant sync
- [x] Real-time item sync
- [x] Flash animations
- [x] Toast notifications
- [x] Split calculator (3 types)
- [x] Mobile responsive
- [x] Desktop layout
- [x] Voice command integration
- [x] Connection status
- [x] Auto-reconnection
- [x] Finalize order
- [x] Leave order
- [ ] Sound effects (optional)
- [ ] Confetti animation (optional)
- [ ] Custom split editing (pending)
- [ ] Firebase Auth (future)
- [ ] Deep links (future)

---

## 📖 Documentation

- **Full Integration Guide**: `COLLABORATIVE_ORDERING_INTEGRATION.md`
- **Implementation Status**: `COLLABORATIVE_UI_IMPLEMENTATION_STATUS.md`
- **Complete Summary**: `COLLABORATIVE_ORDERING_COMPLETE.md`
- **Customer Features**: `CUSTOMER_MANAGEMENT_IMPLEMENTATION.md`

---

**Version**: 1.0.0
**Status**: ✅ Production Ready
**Last Updated**: January 19, 2025
