'use client';

import { observer } from 'mobx-react-lite';
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
      className="fixed bottom-8 right-6 z-40 group"
      style={{
        animation: 'slideInRight 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}
    >
      {/* Floating Pill Design */}
      <div className="relative bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-4 rounded-full shadow-xl hover:shadow-2xl transition-all duration-normal hover:scale-105 active:scale-95">
        {/* Glow Effect */}
        <div className="absolute inset-0 rounded-full bg-primary-400/50 blur-xl opacity-60 group-hover:opacity-80 transition-opacity" />

        {/* Content */}
        <div className="relative flex items-center gap-4">
          {/* Count Badge */}
          <div className="bg-white/20 backdrop-blur-sm rounded-full w-10 h-10 flex items-center justify-center">
            <span className="text-lg font-bold">{cartStore.itemCount}</span>
          </div>

          {/* Order Summary */}
          <div className="text-left">
            <div className="text-xs font-medium opacity-90">
              Your Order
            </div>
            <div className="text-lg font-bold">
              ₹{cartStore.total}
            </div>
          </div>

          {/* Arrow Indicator */}
          <svg className="w-5 h-5 opacity-80 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </div>

        {/* Pulse Animation */}
        <div className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping" style={{ animationDuration: '2s' }} />
      </div>
    </button>
  );
});
