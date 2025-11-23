# Mock Payment Service & Billing System

## Overview

The system now supports **mock payment testing** and includes a complete **GST-compliant billing system** for Indian restaurants.

## Features Implemented

### 1. Mock Payment Service
- ✅ Simulates Razorpay payment flow without requiring API credentials
- ✅ Creates mock payment orders with realistic structure
- ✅ Always returns successful payment verification (for testing)
- ✅ Logs all payment actions for debugging
- ✅ Can be toggled on/off via environment variable

### 2. Tax Service (Indian GST)
- ✅ Accurate GST calculation (5% for restaurant services)
- ✅ Splits GST into CGST (2.5%) and SGST (2.5%) for intra-state transactions
- ✅ Handles different order types (delivery/pickup/dine-in)
- ✅ Applies GST on both food items and delivery charges
- ✅ Generates complete tax breakdown

### 3. Invoice/Bill Generation
- ✅ Complete GST-compliant invoice with:
  - Invoice number (Order ID)
  - Customer details
  - Restaurant details (GSTIN placeholder)
  - Itemized list with quantities and amounts
  - Tax breakdown (CGST, SGST, Total GST)
  - Grand total
  - Payment method and status
- ✅ Formatted printable bill text
- ✅ Auto-prints to console (can be routed to thermal printer)

## Configuration

### Enable Mock Payment Mode

**File**: `stonepot-restaurant/.env`

```env
# Enable mock payment service (no Razorpay credentials needed)
USE_MOCK_PAYMENT=true

# GST Rate (5% for restaurants in India)
GST_RATE=0.05

# Enable invoice printing
ENABLE_INVOICE_PRINTING=true
```

### Disable Mock Payment (Use Real Razorpay)

```env
USE_MOCK_PAYMENT=false
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

## How It Works

### Voice Order Flow with Mock Payment

1. **User Places Order via Voice**:
   ```
   User: "I want to place an order"
   AI: "I'll help you complete your order. How would you like to pay?"
   User: "Cash on delivery"
   ```

2. **Order Finalization**:
   - System calculates: Subtotal + Delivery Fee + GST (5%)
   - Generates complete invoice with tax breakdown
   - Prints bill to console (logs)
   - Sends confirmation message

3. **For Online Payment**:
   ```
   User: "Pay online"
   ```
   - With `USE_MOCK_PAYMENT=true`: Creates mock Razorpay order
   - System simulates payment success
   - Sends "Thank you for ordering" message
   - Bill is generated after payment confirmation

### Manual Order Flow (UI Button)

When user clicks "Place Order" button:
1. Goes through order flow: Customer Info → Order Type → Address → Checkout
2. If Cash payment: Bill generated and printed immediately
3. If Online payment with mock mode: Simulates successful payment

## Sample Bill Output

```
═══════════════════════════════════════════════
       THE COORG FOOD COMPANY
═══════════════════════════════════════════════
Restaurant Address
Phone: Restaurant Phone
GSTIN: GSTIN_TO_BE_ADDED
───────────────────────────────────────────────
Invoice: ORD-1234567890-ABCDE
Date: 11/20/2025, 5:30:00 PM
───────────────────────────────────────────────
BILL TO:
John Doe
9876543210
123 Main Street, Bangalore
═══════════════════════════════════════════════
ITEMS:
───────────────────────────────────────────────
1. Coorg Pork Curry
   2 x ₹350 = ₹700.00
2. Akki Roti
   1 x ₹50 = ₹50.00
═══════════════════════════════════════════════
Subtotal:                        ₹750.00
Delivery Charges:                ₹40.00
CGST (2.5%):                      ₹19.75
SGST (2.5%):                      ₹19.75
───────────────────────────────────────────────
Total GST (5%):                  ₹39.50
═══════════════════════════════════════════════
GRAND TOTAL:                     ₹829.50
═══════════════════════════════════════════════
Payment Method: CASH
Payment Status: CONFIRMED
═══════════════════════════════════════════════
       Thank you for your order!
═══════════════════════════════════════════════
```

## GST Calculation Details

### Current GST Rates for Restaurants (India)

As per CBIC (Central Board of Indirect Taxes and Customs):

| Service Type | GST Rate | Components |
|-------------|----------|------------|
| Restaurant (Non-AC, No Liquor) | 5% | CGST 2.5% + SGST 2.5% |
| Restaurant (AC or Liquor) | 5% | CGST 2.5% + SGST 2.5% |
| Food Delivery/Takeaway | 5% | CGST 2.5% + SGST 2.5% |

**Reference**: [CBIC Official Notifications](https://www.cbic.gov.in/)

### Calculation Example

```
Item Total: ₹750
Delivery Fee: ₹40
Taxable Amount: ₹790

GST (5%): ₹790 × 0.05 = ₹39.50
  ├─ CGST (2.5%): ₹19.75
  └─ SGST (2.5%): ₹19.75

Grand Total: ₹790 + ₹39.50 = ₹829.50
```

## API Response Structure

### Cash Payment Success Response

```json
{
  "success": true,
  "order": {
    "orderId": "ORD-1234567890-ABCDE",
    "customer": { "name": "...", "phone": "..." },
    "cart": {
      "subtotal": 750,
      "deliveryFee": 40,
      "tax": 39.50,
      "total": 829.50
    },
    "orderType": "delivery",
    "paymentMethod": "cash"
  },
  "invoice": {
    "invoiceNumber": "ORD-1234567890-ABCDE",
    "charges": {
      "subtotal": 750,
      "deliveryFee": 40,
      "cgst": 19.75,
      "sgst": 19.75,
      "totalGst": 39.50,
      "grandTotal": 829.50
    },
    "taxDetails": {
      "gstRate": "5%",
      "cgstRate": "2.5%",
      "sgstRate": "2.5%"
    }
  },
  "message": "Thank you for ordering! Order ID: ORD-1234567890-ABCDE. Total: ₹829.50 (including 5% GST). Will be delivered in 30-40 mins. Pay cash on delivery. Your bill has been generated."
}
```

### Mock Online Payment Response

```json
{
  "success": true,
  "order": { /* Same as above */ },
  "razorpayOrder": {
    "id": "order_mock_1700000000_abc12",
    "amount": 82950,
    "currency": "INR"
  },
  "message": "Order created successfully! Order ID: ORD-1234567890-ABCDE. Please complete the payment of ₹829.50.",
  "nextStep": "payment"
}
```

## Testing the Flow

### 1. Test Voice Order with Cash Payment

```bash
# Start backend with mock payment mode
cd stonepot-restaurant
USE_MOCK_PAYMENT=true npm start

# In voice session:
1. Add items to cart
2. Say "I want to place an order"
3. Provide customer details
4. Choose delivery/pickup
5. Say "Cash on delivery"
6. Check console for printed bill
```

### 2. Test Voice Order with Online Payment (Mock)

```bash
# Same setup
1. Add items to cart
2. Say "I want to place an order"
3. Provide customer details
4. Choose delivery/pickup
5. Say "Pay online"
6. Mock payment will auto-succeed
7. Check confirmation message
```

### 3. Test Manual UI Order

```bash
# Start frontend
cd stonepot-restaurant-client
npm run dev

# In browser:
1. Add items to cart
2. Click "Place Order"
3. Fill customer info
4. Select order type
5. Choose payment method
6. Complete flow
```

## Production Deployment

### Switch to Real Razorpay

1. Get Razorpay credentials (see [RAZORPAY_SETUP.md](./RAZORPAY_SETUP.md))
2. Update `.env`:
```env
USE_MOCK_PAYMENT=false
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=your_live_secret
```

### Add Restaurant GSTIN

Update `TaxService.js` line 106:
```javascript
billFrom: {
  name: 'The Coorg Food Company',
  gstin: 'YOUR_ACTUAL_GSTIN', // Replace with actual GSTIN
  address: 'Your Restaurant Address',
  phone: 'Your Restaurant Phone',
  email: 'your@email.com'
}
```

### Integrate Thermal Printer (Optional)

Replace console.log in `VertexAILiveService.js` (line 1430-1434) with actual printer integration:

```javascript
// Example with node-thermal-printer
import { ThermalPrinter } from 'node-thermal-printer';

const printer = new ThermalPrinter({
  type: 'epson',
  interface: 'tcp://192.168.1.100'
});

printer.println(billText);
await printer.execute();
```

## Benefits

✅ **No Razorpay Required for Testing** - Test entire order flow without payment gateway setup
✅ **GST Compliant** - Accurate tax calculation as per Indian regulations
✅ **Professional Invoices** - Complete bill generation with all required details
✅ **Easy Toggle** - Switch between mock and real payment with one environment variable
✅ **Production Ready** - Same code works in both test and production modes
✅ **Audit Trail** - All payments logged for compliance and debugging

## Voice Responses

The AI will now respond with:

**For Cash Orders**:
> "Thank you for ordering! Order ID: ORD-XXX. Total: ₹829.50 including 5% GST. Will be delivered in 30-40 mins. Pay cash on delivery. Your bill has been generated."

**For Online Orders (Mock)**:
> "Order created successfully! Order ID: ORD-XXX. Please complete the payment of ₹829.50."

## Next Steps

- [ ] Add actual Razorpay credentials for production
- [ ] Update restaurant GSTIN in TaxService
- [ ] Integrate thermal printer (optional)
- [ ] Add email/SMS invoice delivery
- [ ] Setup Firebase to store invoices
- [ ] Add invoice PDF generation (optional)
