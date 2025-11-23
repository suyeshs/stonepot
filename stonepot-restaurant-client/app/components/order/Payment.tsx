'use client';

import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { CreditCard, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { orderStore } from '../../stores/orderStore';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PaymentProps {
  backendUrl: string;
  onPaymentSuccess: (paymentDetails: any) => void;
  onPaymentError?: (error: any) => void;
}

export const Payment = observer(function Payment({
  backendUrl,
  onPaymentSuccess,
  onPaymentError
}: PaymentProps) {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setIsScriptLoaded(true);
    script.onerror = () => setError('Failed to load payment gateway');
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handlePayment = async () => {
    if (!orderStore.razorpayOrder || !orderStore.customer) {
      setError('Payment information not available');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const options = {
        key: orderStore.razorpayOrder.keyId,
        amount: orderStore.razorpayOrder.amount,
        currency: orderStore.razorpayOrder.currency,
        order_id: orderStore.razorpayOrder.id,
        name: 'Stonepot Restaurant',
        description: 'Food Order Payment',
        image: '/logo.png', // Update with your logo path
        prefill: {
          name: orderStore.customer.name,
          contact: orderStore.customer.phone,
          email: orderStore.customer.email || '',
        },
        theme: {
          color: '#f97316', // Orange theme
        },
        handler: async function (response: any) {
          try {
            // Verify payment signature
            const verifyResponse = await fetch(
              `${backendUrl}/api/restaurant/orders/${orderStore.currentOrder?.orderId}/verify-payment`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                }),
              }
            );

            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok || !verifyData.verified) {
              throw new Error('Payment verification failed');
            }

            onPaymentSuccess({
              orderId: orderStore.currentOrder?.orderId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              verified: true,
            });
          } catch (err) {
            console.error('Payment verification error:', err);
            setError('Payment verification failed. Please contact support.');
            if (onPaymentError) {
              onPaymentError(err);
            }
          } finally {
            setIsProcessing(false);
          }
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
            setError('Payment cancelled');
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      console.error('Payment initialization error:', err);
      setError('Failed to initialize payment');
      setIsProcessing(false);
      if (onPaymentError) {
        onPaymentError(err);
      }
    }
  };

  if (!isScriptLoaded) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto" />
          <p className="text-gray-600">Loading payment gateway...</p>
        </div>
      </div>
    );
  }

  if (!orderStore.currentOrder || !orderStore.razorpayOrder) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <p className="text-gray-600">Payment information not available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-white/95 to-gray-50/95 backdrop-blur-xl">
      {/* Header */}
      <div className="p-6 pb-4">
        <h2 className="text-2xl font-light neu-text tracking-tight">Payment</h2>
        <p className="text-sm neu-text-secondary opacity-60 mt-1">
          Complete your payment to place order
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 space-y-6">
        {/* Order Total */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
          <p className="text-sm opacity-90 mb-2">Total Amount</p>
          <p className="text-4xl font-bold">
            ₹{((orderStore.razorpayOrder.amount) / 100).toFixed(2)}
          </p>
          <p className="text-sm opacity-75 mt-2">
            Order #{orderStore.currentOrder.orderId}
          </p>
        </div>

        {/* Payment Methods */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-100/50">
          <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment Methods
          </h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Credit/Debit Cards
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              UPI (Google Pay, PhonePe, Paytm)
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Net Banking
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Wallets
            </div>
          </div>
        </div>

        {/* Security Info */}
        <div className="bg-blue-50/60 backdrop-blur-sm rounded-2xl p-5 border border-blue-200/50">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-blue-900 mb-1">Secure Payment</h4>
              <p className="text-sm text-blue-700">
                Your payment information is encrypted and secure. We use Razorpay for secure payment processing.
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50/80 backdrop-blur-sm rounded-xl p-4 border border-red-200/50">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer - Pay Button */}
      <div className="p-6 border-t border-gray-200/50">
        <button
          onClick={handlePayment}
          disabled={isProcessing}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              Pay ₹{((orderStore.razorpayOrder.amount) / 100).toFixed(2)}
            </>
          )}
        </button>
        <p className="text-xs text-gray-500 text-center mt-3">
          By continuing, you agree to our Terms & Conditions
        </p>
      </div>
    </div>
  );
});
