'use client';

import { observer } from 'mobx-react-lite';
import Image from 'next/image';
import { Minus, Plus, X } from 'lucide-react';
import { cartStore } from '../stores/cartStore';

interface CartProps {
  onPlaceOrder?: () => void;
}

export const Cart = observer(function Cart({ onPlaceOrder }: CartProps) {
  if (cartStore.items.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="text-6xl opacity-20">🍽️</div>
          <div>
            <h3 className="text-xl font-light neu-text mb-2">Your order is empty</h3>
            <p className="text-sm neu-text-secondary opacity-60">
              Start ordering by voice or browse the menu
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-white/95 to-gray-50/95 backdrop-blur-xl">
      {/* Floating Header - Minimal */}
      <div className="p-6 pb-4">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-2xl font-light neu-text tracking-tight">Your Order</h2>
            <p className="text-sm neu-text-secondary opacity-60 mt-1">
              {cartStore.itemCount} {cartStore.itemCount === 1 ? 'item' : 'items'}
            </p>
          </div>
        </div>
      </div>

      {/* Items - Flowing, Spacious Design */}
      <div className="flex-1 overflow-y-auto px-6 space-y-4">
        {cartStore.items.map((item, index) => (
          <div
            key={`${item.name}-${item.customization || 'default'}-${index}`}
            className="group relative"
            style={{
              animation: `fadeInUp 0.4s ease-out ${index * 0.1}s both`
            }}
          >
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100/50">
              <div className="flex gap-4">
                {/* Item Image - Larger, More Prominent */}
                {item.imageUrl && (
                  <div className="flex-shrink-0">
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      width={100}
                      height={100}
                      className="rounded-xl object-cover"
                    />
                  </div>
                )}

                {/* Item Details - Clean Layout */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-lg neu-text">{item.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{
                        backgroundColor: item.type === 'veg' ? '#dcfce7' : '#fee2e2',
                        color: item.type === 'veg' ? '#166534' : '#991b1b'
                      }}>
                        {item.type === 'veg' ? '🟢' : '🔴'}
                      </span>
                    </div>
                    {item.customization && (
                      <p className="text-sm neu-text-secondary opacity-60 mt-1">
                        {item.customization}
                      </p>
                    )}
                  </div>

                  {/* Quantity & Price - Inline */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-3 bg-gray-50/80 rounded-full px-3 py-1.5">
                      <button
                        onClick={() => {
                          if (item.quantity > 1) {
                            cartStore.updateQuantity(item.name, item.type, item.quantity - 1);
                          } else {
                            cartStore.removeItem(item.name, item.type);
                          }
                        }}
                        className="w-7 h-7 rounded-full bg-white shadow-sm hover:shadow transition-all flex items-center justify-center text-gray-600 hover:text-gray-900"
                      >
                        {item.quantity === 1 ? <X className="w-4 h-4" /> : <Minus className="w-3.5 h-3.5" />}
                      </button>
                      <span className="font-semibold neu-text min-w-[1.5rem] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => cartStore.updateQuantity(item.name, item.type, item.quantity + 1)}
                        className="w-7 h-7 rounded-full bg-white shadow-sm hover:shadow transition-all flex items-center justify-center text-gray-600 hover:text-gray-900"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-semibold neu-text-accent">
                        ₹{item.price * item.quantity}
                      </div>
                      {item.quantity > 1 && (
                        <div className="text-xs neu-text-secondary opacity-60">
                          ₹{item.price} each
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Total - Sticky Bottom with Glass Effect */}
      <div className="sticky bottom-0 p-6 bg-gradient-to-t from-white via-white/98 to-white/95 backdrop-blur-xl border-t border-gray-200/30">
        <div className="flex items-baseline justify-between mb-6">
          <span className="text-lg font-light neu-text-secondary">Total</span>
          <div className="text-right">
            <div className="text-3xl font-light neu-text tracking-tight">
              ₹{cartStore.total}
            </div>
            <div className="text-xs neu-text-secondary opacity-60 mt-1">
              incl. taxes
            </div>
          </div>
        </div>

        <button
          onClick={onPlaceOrder}
          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 rounded-2xl font-medium text-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          Place Order
        </button>
      </div>
    </div>
  );
});
