'use client';

import { observer } from 'mobx-react-lite';
import Image from 'next/image';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { cartStore } from '../stores/cartStore';

export const Cart = observer(function Cart() {
  if (cartStore.items.length === 0) {
    return (
      <div className="neu-card p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="neu-icon-container w-20 h-20">
            <ShoppingBag className="w-10 h-10 neu-text-secondary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold neu-text mb-2">Your cart is empty</h3>
            <p className="text-sm neu-text-secondary">
              Add items from the menu to get started
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="neu-card">
      {/* Cart Header */}
      <div className="p-4 border-b border-gray-200/50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold neu-text flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            Your Cart ({cartStore.itemCount} items)
          </h2>
          {cartStore.items.length > 0 && (
            <button
              onClick={() => cartStore.clearCart()}
              className="neu-button-small neu-button-ghost text-red-500 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Cart Items */}
      <div className="divide-y divide-gray-200/50">
        {cartStore.items.map((item, index) => (
          <div key={`${item.name}-${item.customization || 'default'}-${index}`} className="p-4 hover:bg-gray-50/30 transition-colors">
            <div className="flex gap-4">
              {/* Item Image */}
              {item.imageUrl && (
                <div className="neu-image-container flex-shrink-0">
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    width={80}
                    height={80}
                    className="rounded-lg object-cover"
                  />
                </div>
              )}

              {/* Item Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium neu-text">{item.name}</h3>
                      <span className={`neu-badge ${item.type === 'veg' ? 'neu-badge-success' : 'neu-badge-error'}`}>
                        {item.type === 'veg' ? '🟢 Veg' : '🔴 Non-Veg'}
                      </span>
                    </div>
                    {item.customization && (
                      <p className="text-sm neu-text-secondary mt-1">
                        With {item.customization}
                      </p>
                    )}
                    <p className="text-sm font-semibold neu-text-accent mt-1">
                      ₹{item.price}
                    </p>
                  </div>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (item.quantity > 1) {
                          cartStore.updateQuantity(item.name, item.type, item.quantity - 1);
                        }
                      }}
                      className="neu-button-icon neu-button-small"
                      disabled={item.quantity <= 1}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-12 text-center font-semibold neu-text">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => cartStore.updateQuantity(item.name, item.type, item.quantity + 1)}
                      className="neu-button-icon neu-button-small"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => cartStore.removeItem(item.name, item.type)}
                    className="neu-button-icon neu-button-small neu-button-ghost text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Item Total */}
            <div className="mt-3 pt-3 border-t border-gray-200/30 flex justify-between items-center">
              <span className="text-sm neu-text-secondary">Item Total</span>
              <span className="font-semibold neu-text">₹{item.price * item.quantity}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Cart Summary */}
      <div className="p-4 border-t border-gray-200/50 bg-gray-50/30">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="neu-text">Subtotal</span>
            <span className="font-semibold neu-text">₹{cartStore.total}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="neu-text-secondary">Taxes & Fees</span>
            <span className="neu-text-secondary">Calculated at checkout</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200/50">
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-semibold neu-text">Total</span>
            <span className="text-2xl font-bold neu-text-accent">₹{cartStore.total}</span>
          </div>

          <button className="neu-button neu-button-primary w-full">
            Proceed to Checkout
          </button>
        </div>
      </div>
    </div>
  );
});
