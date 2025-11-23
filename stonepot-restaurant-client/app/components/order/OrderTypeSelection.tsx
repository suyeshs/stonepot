'use client';

import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Truck, ShoppingBag, Utensils, CreditCard, Banknote } from 'lucide-react';
import { orderStore } from '../../stores/orderStore';

interface OrderTypeSelectionProps {
  onContinue: () => void;
  onBack?: () => void;
}

export const OrderTypeSelection = observer(function OrderTypeSelection({
  onContinue,
  onBack
}: OrderTypeSelectionProps) {
  const [orderType, setOrderType] = useState<'delivery' | 'pickup' | 'dine-in'>(orderStore.orderType);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash'>(orderStore.paymentMethod);

  const handleContinue = () => {
    orderStore.setOrderType(orderType);
    orderStore.setPaymentMethod(paymentMethod);
    onContinue();
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-white/95 to-gray-50/95 backdrop-blur-xl">
      {/* Header */}
      <div className="p-6 pb-4">
        <h2 className="text-2xl font-light neu-text tracking-tight">Order Details</h2>
        <p className="text-sm neu-text-secondary opacity-60 mt-1">
          How would you like to receive your order?
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 space-y-6">
        {/* Order Type */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Order Type</h3>
          <div className="space-y-3">
            {/* Delivery */}
            <button
              onClick={() => setOrderType('delivery')}
              className={`w-full p-4 rounded-xl border-2 transition-all ${
                orderType === 'delivery'
                  ? 'border-orange-500 bg-orange-50/60'
                  : 'border-gray-200 bg-white/60 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  orderType === 'delivery' ? 'bg-orange-100' : 'bg-gray-100'
                }`}>
                  <Truck className={`w-6 h-6 ${
                    orderType === 'delivery' ? 'text-orange-600' : 'text-gray-600'
                  }`} />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900">Delivery</div>
                  <div className="text-sm text-gray-600">Get it delivered to your doorstep</div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  orderType === 'delivery'
                    ? 'border-orange-500 bg-orange-500'
                    : 'border-gray-300'
                }`}>
                  {orderType === 'delivery' && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </div>
            </button>

            {/* Pickup */}
            <button
              onClick={() => setOrderType('pickup')}
              className={`w-full p-4 rounded-xl border-2 transition-all ${
                orderType === 'pickup'
                  ? 'border-orange-500 bg-orange-50/60'
                  : 'border-gray-200 bg-white/60 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  orderType === 'pickup' ? 'bg-orange-100' : 'bg-gray-100'
                }`}>
                  <ShoppingBag className={`w-6 h-6 ${
                    orderType === 'pickup' ? 'text-orange-600' : 'text-gray-600'
                  }`} />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900">Pickup</div>
                  <div className="text-sm text-gray-600">Pick up from restaurant</div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  orderType === 'pickup'
                    ? 'border-orange-500 bg-orange-500'
                    : 'border-gray-300'
                }`}>
                  {orderType === 'pickup' && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </div>
            </button>

            {/* Dine-in */}
            <button
              onClick={() => setOrderType('dine-in')}
              className={`w-full p-4 rounded-xl border-2 transition-all ${
                orderType === 'dine-in'
                  ? 'border-orange-500 bg-orange-50/60'
                  : 'border-gray-200 bg-white/60 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  orderType === 'dine-in' ? 'bg-orange-100' : 'bg-gray-100'
                }`}>
                  <Utensils className={`w-6 h-6 ${
                    orderType === 'dine-in' ? 'text-orange-600' : 'text-gray-600'
                  }`} />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900">Dine-in</div>
                  <div className="text-sm text-gray-600">Order at table</div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  orderType === 'dine-in'
                    ? 'border-orange-500 bg-orange-500'
                    : 'border-gray-300'
                }`}>
                  {orderType === 'dine-in' && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Payment Method */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Payment Method</h3>
          <div className="space-y-3">
            {/* Online Payment */}
            <button
              onClick={() => setPaymentMethod('online')}
              className={`w-full p-4 rounded-xl border-2 transition-all ${
                paymentMethod === 'online'
                  ? 'border-blue-500 bg-blue-50/60'
                  : 'border-gray-200 bg-white/60 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  paymentMethod === 'online' ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  <CreditCard className={`w-6 h-6 ${
                    paymentMethod === 'online' ? 'text-blue-600' : 'text-gray-600'
                  }`} />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900">Pay Online</div>
                  <div className="text-sm text-gray-600">UPI, Cards, Wallets</div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  paymentMethod === 'online'
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                }`}>
                  {paymentMethod === 'online' && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </div>
            </button>

            {/* Cash Payment */}
            <button
              onClick={() => setPaymentMethod('cash')}
              className={`w-full p-4 rounded-xl border-2 transition-all ${
                paymentMethod === 'cash'
                  ? 'border-blue-500 bg-blue-50/60'
                  : 'border-gray-200 bg-white/60 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  paymentMethod === 'cash' ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  <Banknote className={`w-6 h-6 ${
                    paymentMethod === 'cash' ? 'text-blue-600' : 'text-gray-600'
                  }`} />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900">
                    Cash on {orderType === 'delivery' ? 'Delivery' : orderType === 'pickup' ? 'Pickup' : 'Table'}
                  </div>
                  <div className="text-sm text-gray-600">Pay when you receive</div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  paymentMethod === 'cash'
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                }`}>
                  {paymentMethod === 'cash' && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-gray-200/50 space-y-3">
        <button
          onClick={handleContinue}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all"
        >
          Continue
        </button>
        {onBack && (
          <button
            onClick={onBack}
            className="w-full text-gray-600 hover:text-gray-900 py-2 transition-colors"
          >
            Back
          </button>
        )}
      </div>
    </div>
  );
});
