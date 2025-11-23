'use client';

import { CreditCard, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface PaymentPendingProps {
  data: {
    orderId: string;
    razorpayOrderId: string;
    amount: number;
    currency: string;
    customer: {
      name: string;
      phone: string;
      email?: string;
    };
  };
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function PaymentPending({ data }: PaymentPendingProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  useEffect(() => {
    // Load Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setRazorpayLoaded(true);
    script.onerror = () => setError('Failed to load payment gateway');
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handlePayment = () => {
    if (!razorpayLoaded || !window.Razorpay) {
      setError('Payment gateway not loaded. Please refresh and try again.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
      amount: Math.round(data.amount * 100), // Convert to paise
      currency: data.currency,
      name: 'The Coorg Food Company',
      description: `Order ${data.orderId}`,
      order_id: data.razorpayOrderId,
      prefill: {
        name: data.customer.name,
        contact: data.customer.phone,
        email: data.customer.email || ''
      },
      theme: {
        color: '#F97316'
      },
      handler: async function (response: any) {
        try {
          // Verify payment on backend
          const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stonepot-restaurant-334610188311.us-central1.run.app';
          const verifyRes = await fetch(`${backendUrl}/api/restaurant/payment/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: data.orderId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            })
          });

          const verifyData = await verifyRes.json();

          if (verifyData.success) {
            // Payment successful - display will be updated by backend
            console.log('Payment verified successfully');
          } else {
            setError('Payment verification failed. Please contact support.');
          }
        } catch (err) {
          console.error('Payment verification error:', err);
          setError('Payment verification failed. Please contact support.');
        } finally {
          setIsLoading(false);
        }
      },
      modal: {
        ondismiss: function () {
          setIsLoading(false);
          setError('Payment cancelled');
        }
      }
    };

    const razorpay = new window.Razorpay(options);
    razorpay.open();
  };

  return (
    <div className="h-full flex items-center justify-center p-8 bg-gradient-to-b from-white/95 to-gray-50/95 backdrop-blur-xl">
      <div className="max-w-md w-full space-y-6">
        {/* Payment Icon */}
        <div className="text-center">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-orange-100 rounded-full animate-pulse opacity-75" />
            <div className="relative bg-gradient-to-br from-orange-500 to-orange-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-lg">
              <CreditCard className="w-10 h-10 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-light neu-text mt-6 mb-2">Complete Payment</h2>
          <p className="text-gray-600">Order ID: {data.orderId}</p>
        </div>

        {/* Amount Card */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-100/50 text-center">
          <p className="text-sm text-gray-600 mb-2">Amount to Pay</p>
          <p className="text-4xl font-bold text-orange-600">₹{data.amount.toFixed(2)}</p>
        </div>

        {/* Customer Info */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-100/50">
          <h3 className="font-medium text-gray-900 mb-3">Payment Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Name:</span>
              <span className="font-medium text-gray-900">{data.customer.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Phone:</span>
              <span className="font-medium text-gray-900">{data.customer.phone}</span>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Pay Button */}
        <button
          onClick={handlePayment}
          disabled={isLoading || !razorpayLoaded}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing...
            </>
          ) : !razorpayLoaded ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading Payment Gateway...
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              Pay ₹{data.amount.toFixed(2)}
            </>
          )}
        </button>

        {/* Payment Methods Info */}
        <div className="text-center space-y-2">
          <p className="text-xs text-gray-500">
            Secure payment powered by Razorpay
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
            <span>UPI</span>
            <span>•</span>
            <span>Cards</span>
            <span>•</span>
            <span>Wallets</span>
            <span>•</span>
            <span>Net Banking</span>
          </div>
        </div>
      </div>
    </div>
  );
}
