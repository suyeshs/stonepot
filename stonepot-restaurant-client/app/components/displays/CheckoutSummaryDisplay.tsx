'use client';

import { ShoppingBag, MapPin, Clock, CreditCard } from 'lucide-react';

interface CheckoutSummaryDisplayProps {
  data: {
    orderId: string;
    items: Array<{
      dishName: string;
      quantity: number;
      price: number;
    }>;
    subtotal: number;
    deliveryFee: number;
    tax: number;
    total: number;
    orderType: string;
    paymentMethod: string;
    deliveryAddress?: string;
    estimatedTime?: string;
  };
}

export function CheckoutSummaryDisplay({ data }: CheckoutSummaryDisplayProps) {
  return (
    <div className="h-full flex items-center justify-center p-8 bg-gradient-to-b from-white/95 to-gray-50/95 backdrop-blur-xl overflow-y-auto">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="relative inline-block">
            <div className="relative bg-gradient-to-br from-blue-500 to-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-lg">
              <ShoppingBag className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-light neu-text mt-4 mb-2">Order Summary</h2>
          <p className="text-sm text-gray-600">Order ID: {data.orderId}</p>
        </div>

        {/* Order Type */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span className="font-medium capitalize">{data.orderType}</span>
            </div>
            {data.estimatedTime && (
              <span className="text-sm opacity-90">{data.estimatedTime}</span>
            )}
          </div>
        </div>

        {/* Delivery Address */}
        {data.deliveryAddress && (
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 border border-gray-100/50">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-gray-900 mb-1">Delivery Address</h3>
                <p className="text-sm text-gray-700">{data.deliveryAddress}</p>
              </div>
            </div>
          </div>
        )}

        {/* Items */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-100/50">
          <h3 className="font-medium text-gray-900 mb-3">Items ({data.items.length})</h3>
          <div className="space-y-2">
            {data.items.map((item, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-gray-700">
                  {item.quantity}x {item.dishName}
                </span>
                <span className="font-medium text-gray-900">
                  ₹{(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Price Breakdown */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-100/50">
          <h3 className="font-medium text-gray-900 mb-3">Price Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span className="text-gray-900">₹{data.subtotal.toFixed(2)}</span>
            </div>
            {data.deliveryFee > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Delivery Fee</span>
                <span className="text-gray-900">₹{data.deliveryFee.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">GST (5%)</span>
              <span className="text-gray-900">₹{data.tax.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-gray-200 flex justify-between font-semibold">
              <span className="text-gray-900">Total</span>
              <span className="text-orange-600">₹{data.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 border border-gray-100/50">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-orange-600" />
            <div>
              <p className="text-sm text-gray-600">Payment Method</p>
              <p className="font-medium text-gray-900 capitalize">{data.paymentMethod}</p>
            </div>
          </div>
        </div>

        {/* Processing Message */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            {data.paymentMethod === 'online'
              ? 'Preparing payment...'
              : 'Processing your order...'}
          </p>
        </div>
      </div>
    </div>
  );
}
