'use client';

import { CheckCircle2, MapPin, Clock, CreditCard } from 'lucide-react';

interface OrderConfirmedProps {
  data: {
    orderId: string;
    orderType: string;
    paymentMethod: string;
    total: number;
    estimatedTime?: string;
    message?: string;
  };
}

export function OrderConfirmed({ data }: OrderConfirmedProps) {
  return (
    <div className="h-full flex items-center justify-center p-8 bg-gradient-to-b from-white/95 to-gray-50/95 backdrop-blur-xl">
      <div className="max-w-md w-full space-y-6">
        {/* Success Animation */}
        <div className="text-center">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-75" />
            <div className="relative bg-gradient-to-br from-green-500 to-green-600 w-24 h-24 rounded-full flex items-center justify-center mx-auto shadow-lg">
              <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <h2 className="text-3xl font-light neu-text mt-6 mb-2">Order Confirmed!</h2>
          <p className="text-gray-600">
            {data.message || 'Thank you for your order'}
          </p>
        </div>

        {/* Order ID */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-100/50 text-center">
          <p className="text-sm text-gray-600 mb-2">Order ID</p>
          <p className="text-2xl font-semibold text-gray-900 font-mono">{data.orderId}</p>
        </div>

        {/* Order Details */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-6 h-6" />
            <h3 className="text-lg font-semibold capitalize">{data.orderType} Order</h3>
          </div>
          {data.estimatedTime && (
            <p className="text-sm opacity-90">
              Estimated Time: {data.estimatedTime}
            </p>
          )}
          {!data.estimatedTime && (
            <p className="text-sm opacity-90">
              We'll prepare your order shortly
            </p>
          )}
        </div>

        {/* Payment Confirmation */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-100/50">
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 capitalize">
              {data.paymentMethod === 'online' ? 'Paid Online' : `Cash on ${data.orderType}`}
            </span>
            <span className="text-lg font-bold text-gray-900">₹{data.total.toFixed(2)}</span>
          </div>
          {data.paymentMethod === 'online' && (
            <div className="mt-2 inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
              ✓ Payment Successful
            </div>
          )}
        </div>

        {/* Track Order Info */}
        <div className="text-center space-y-2 py-4">
          <p className="text-sm text-gray-600">
            We'll notify you when your order is ready
          </p>
          <p className="text-xs text-gray-500">
            Keep this page for order reference
          </p>
        </div>
      </div>
    </div>
  );
}
