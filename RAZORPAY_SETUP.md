# Razorpay Setup Guide

## Getting Razorpay Credentials

### 1. Sign Up for Razorpay
Visit [https://razorpay.com](https://razorpay.com) and create an account.

### 2. Access the Dashboard
After signing up, log in to the [Razorpay Dashboard](https://dashboard.razorpay.com).

### 3. Get API Keys

#### Test Mode (For Development)
1. In the dashboard, click on **Settings** (gear icon) in the left sidebar
2. Go to **API Keys** under "Developer Controls"
3. Click **Generate Test Key** if you don't have one
4. You'll see:
   - **Key ID**: Starts with `rzp_test_`
   - **Key Secret**: Click "Show" to reveal (keep this secret!)

#### Live Mode (For Production)
1. Complete KYC verification in the dashboard
2. Switch to **Live Mode** toggle at the top
3. Generate Live API keys (starts with `rzp_live_`)

### 4. Configure Environment Variables

**Backend** (`stonepot-restaurant/.env`):
```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
RAZORPAY_KEY_SECRET=your_secret_key_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
```

**Frontend** (`stonepot-restaurant-client/.env.local`):
```env
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
```

⚠️ **IMPORTANT**:
- Only the **Key ID** should be in the frontend (it's safe to expose)
- The **Key Secret** must NEVER be exposed to the frontend
- Keep webhook secret secure for verifying webhook authenticity

### 5. Setup Webhooks

Webhooks notify your server about payment events (success, failure, refund, etc.).

1. In Razorpay Dashboard, go to **Settings** → **Webhooks**
2. Click **Add New Webhook**
3. Configure:
   - **Webhook URL**: `https://your-domain.com/api/webhooks/razorpay`
   - **Secret**: Generate a random string (this is your `RAZORPAY_WEBHOOK_SECRET`)
   - **Events**: Select the events you want to receive:
     - ✅ `payment.captured` - Payment successful
     - ✅ `payment.failed` - Payment failed
     - ✅ `order.paid` - Order completed
     - ✅ `refund.created` - Refund initiated
     - ✅ `refund.processed` - Refund completed
4. Click **Create Webhook**

### 6. Test Payment Flow

Razorpay provides test cards for development:

**Successful Payment**:
- Card Number: `4111 1111 1111 1111`
- CVV: Any 3 digits
- Expiry: Any future date

**UPI Test**:
- Use `success@razorpay` as VPA

**Failed Payment**:
- Card Number: `4000 0000 0000 0002`

### 7. Pricing

Razorpay charges:
- **2% + ₹0** per transaction for domestic cards
- **3% + ₹0** for international cards
- **0.7%** for UPI transactions (capped at ₹1000)
- **Free** for the first ₹100,000 in transactions (promotional offer)

No setup fees or annual maintenance charges.

### 8. Going Live

Before going live:
1. ✅ Complete KYC verification
2. ✅ Test all payment flows in test mode
3. ✅ Setup webhooks for production URL
4. ✅ Update environment variables with live keys
5. ✅ Enable only required payment methods in dashboard
6. ✅ Setup email notifications for payments
7. ✅ Configure settlement cycle (default is T+3 days)

## Current Implementation Status

✅ **Backend Integration Complete**:
- PaymentService with order creation
- Payment signature verification
- Webhook handling
- Refund support

✅ **Frontend Integration Complete**:
- Payment component with Razorpay SDK
- Multiple payment methods (UPI, Cards, Wallets, Net Banking)
- Payment verification flow
- Error handling

⏳ **Pending**:
- Add actual Razorpay credentials to environment variables
- Test payment flow end-to-end
- Setup production webhooks

## Testing Checklist

- [ ] Create order with online payment
- [ ] Complete payment with test card
- [ ] Verify payment signature
- [ ] Check order status updated in Firebase
- [ ] Test payment failure scenario
- [ ] Test webhook delivery
- [ ] Test refund flow
- [ ] Test COD (Cash on Delivery) flow

## Security Best Practices

1. ✅ Never expose Key Secret in frontend code
2. ✅ Always verify payment signature on backend
3. ✅ Validate webhook signatures
4. ✅ Use HTTPS for webhook URLs
5. ✅ Store credentials in environment variables
6. ✅ Use different keys for test and production
7. ⚠️ Implement rate limiting on payment endpoints
8. ⚠️ Add fraud detection for suspicious transactions
