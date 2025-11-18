'use client';

import { observer } from 'mobx-react-lite';
import { ShoppingBag } from 'lucide-react';
import { cartStore } from '../stores/cartStore';

interface CartIslandProps {
  onClick?: () => void;
}

export const CartIsland = observer(function CartIsland({ onClick }: CartIslandProps) {
  if (cartStore.itemCount === 0) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 right-6 neu-card p-4 shadow-lg hover:shadow-xl transition-all duration-300 z-40 group"
      style={{
        minWidth: '180px',
        animation: 'slideInRight 0.3s ease-out'
      }}
    >
      <div className="flex items-center gap-3">
        {/* Cart Icon with Badge */}
        <div className="relative">
          <div className="neu-icon-container w-12 h-12">
            <ShoppingBag className="w-6 h-6 neu-text-accent" />
          </div>
          {cartStore.itemCount > 0 && (
            <div className="absolute -top-2 -right-2 neu-badge neu-badge-primary w-6 h-6 flex items-center justify-center text-xs font-bold">
              {cartStore.itemCount}
            </div>
          )}
        </div>

        {/* Cart Summary */}
        <div className="flex-1 text-left">
          <div className="text-xs neu-text-secondary font-medium">
            {cartStore.itemCount} {cartStore.itemCount === 1 ? 'item' : 'items'}
          </div>
          <div className="text-sm font-bold neu-text-accent">
            ₹{cartStore.total}
          </div>
        </div>
      </div>

      {/* Ripple animation on add */}
      <div className="absolute inset-0 rounded-2xl bg-green-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
});
