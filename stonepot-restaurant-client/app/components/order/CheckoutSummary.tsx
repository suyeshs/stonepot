'use client';

import { observer } from 'mobx-react-lite';
import Image from 'next/image';
import { MapPin, Clock, User, Phone, Mail } from 'lucide-react';
import { cartStore } from '../../stores/cartStore';
import { orderStore } from '../../stores/orderStore';

interface CheckoutSummaryProps {
  onConfirm: () => void;
  onBack?: () => void;
}

export const CheckoutSummary = observer(function CheckoutSummary({
  onConfirm,
  onBack
}: CheckoutSummaryProps) {
  const subtotal = cartStore.total;
  const deliveryFee = orderStore.orderType === 'delivery' ? orderStore.deliveryFee : 0;
  const taxRate = 0.05; // 5% GST
  const tax = Math.round((subtotal + deliveryFee) * taxRate * 100) / 100;
  const total = subtotal + deliveryFee + tax;

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-white/95 to-gray-50/95 backdrop-blur-xl">
      {/* Header */}
      <div className="p-6 pb-4">
        <h2 className="text-2xl font-light neu-text tracking-tight">Order Summary</h2>
        <p className="text-sm neu-text-secondary opacity-60 mt-1">
          Review your order before placing
        </p>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto px-6 space-y-6">
        {/* Customer Info */}
        {orderStore.customer && (
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-100/50">
            <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-4 h-4" />
              Customer Details
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-700">
                <User className="w-4 h-4 text-gray-400" />
                {orderStore.customer.name}
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <Phone className="w-4 h-4 text-gray-400" />
                {orderStore.customer.phone}
              </div>
              {orderStore.customer.email && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {orderStore.customer.email}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delivery Info */}
        {orderStore.orderType === 'delivery' && orderStore.deliveryAddress && (
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-100/50">
            <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Delivery Address
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              {orderStore.deliveryAddress.formatted}
            </p>
            {orderStore.estimatedDeliveryTime && (
              <div className="mt-3 flex items-center gap-2 text-sm text-orange-600">
                <Clock className="w-4 h-4" />
                Estimated: {orderStore.estimatedDeliveryTime}
              </div>
            )}
          </div>
        )}

        {/* Order Type Badge */}
        <div className="flex items-center gap-3">
          <div className="bg-orange-50 text-orange-700 px-4 py-2 rounded-full text-sm font-medium">
            {orderStore.orderType === 'delivery' ? '🚴 Delivery' : orderStore.orderType === 'pickup' ? '🏪 Pickup' : '🍽️ Dine-in'}
          </div>
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-medium">
            {orderStore.paymentMethod === 'online' ? '💳 Pay Online' : '💵 Cash on ' + (orderStore.orderType === 'delivery' ? 'Delivery' : 'Pickup')}
          </div>
        </div>

        {/* Cart Items */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-100/50">
          <h3 className="font-medium text-gray-900 mb-4">
            Order Items ({cartStore.itemCount})
          </h3>
          <div className="space-y-3">
            {cartStore.items.map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex gap-3">
                {item.imageUrl && (
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    width={60}
                    height={60}
                    className="rounded-lg object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium text-gray-900 text-sm">{item.name}</h4>
                      {item.customization && (
                        <p className="text-xs text-gray-500 mt-0.5">{item.customization}</p>
                      )}
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{
                      backgroundColor: item.type === 'veg' ? '#dcfce7' : '#fee2e2',
                      color: item.type === 'veg' ? '#166534' : '#991b1b'
                    }}>
                      {item.type === 'veg' ? '🟢' : '🔴'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">Qty: {item.quantity}</span>
                    <span className="text-sm font-semibold text-gray-900">₹{item.price * item.quantity}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Price Breakdown */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-100/50 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium text-gray-900">₹{subtotal.toFixed(2)}</span>
          </div>
          {deliveryFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Delivery Fee</span>
              <span className="font-medium text-gray-900">₹{deliveryFee.toFixed(2)}</span>
            </div>
          )}
          {deliveryFee === 0 && orderStore.orderType === 'delivery' && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Delivery Fee</span>
              <span className="font-medium text-green-600">FREE</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">GST (5%)</span>
            <span className="font-medium text-gray-900">₹{tax.toFixed(2)}</span>
          </div>
          <div className="pt-3 border-t border-gray-200">
            <div className="flex justify-between">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="font-bold text-xl text-orange-600">₹{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Special Instructions */}
        {orderStore.specialInstructions && (
          <div className="bg-amber-50/60 backdrop-blur-sm rounded-2xl p-4 border border-amber-200/50">
            <h4 className="text-sm font-medium text-amber-900 mb-2">Special Instructions</h4>
            <p className="text-sm text-amber-700">{orderStore.specialInstructions}</p>
          </div>
        )}
      </div>

      {/* Footer - Fixed Actions */}
      <div className="p-6 border-t border-gray-200/50 space-y-3">
        <button
          onClick={onConfirm}
          disabled={orderStore.isProcessing}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:cursor-not-allowed"
        >
          {orderStore.isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            <>
              {orderStore.paymentMethod === 'online' ? 'Proceed to Payment' : 'Place Order'} • ₹{total.toFixed(2)}
            </>
          )}
        </button>
        {onBack && (
          <button
            onClick={onBack}
            disabled={orderStore.isProcessing}
            className="w-full text-gray-600 hover:text-gray-900 py-2 transition-colors disabled:opacity-50"
          >
            Back
          </button>
        )}
      </div>
    </div>
  );
});
