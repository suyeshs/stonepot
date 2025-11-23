'use client';

import { observer } from 'mobx-react-lite';
import { collaborativeOrderStore } from '../../stores/collaborativeOrderStore';
import { ParticipantsList } from './ParticipantsList';
import { CollaborativeItemsList } from './CollaborativeItemsList';
import { SplitCalculator } from './SplitCalculator';
import { useState } from 'react';
import { X, Users, ChevronUp, ChevronDown } from 'lucide-react';

interface CollaborativeOrderPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CollaborativeOrderPanel = observer(function CollaborativeOrderPanel({
  isOpen,
  onClose
}: CollaborativeOrderPanelProps) {
  const [isSplitExpanded, setIsSplitExpanded] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    if (confirm('Are you sure you want to leave this group order?')) {
      onClose();
    }
  };

  const handleFinalize = () => {
    if (!collaborativeOrderStore.customSplitValid) {
      alert('Split amounts must equal the total order amount');
      return;
    }

    if (confirm(`Finalize this order for ₹${collaborativeOrderStore.total}?`)) {
      // This will be handled by PartyKitService in page.tsx
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={handleClose}
      />

      {/* Panel - Desktop: Right slide-in, Mobile: Bottom sheet */}
      <div className={`
        fixed z-50
        bg-gradient-to-b from-white/95 to-gray-50/95 backdrop-blur-xl
        shadow-2xl
        transition-all duration-400 ease-out

        ${isOpen ? 'translate-x-0 translate-y-0' : ''}

        /* Mobile: Bottom sheet */
        md:hidden
        bottom-0 left-0 right-0
        h-[85vh]
        rounded-t-3xl
        ${!isOpen ? 'translate-y-full' : ''}

        /* Desktop: Right panel */
        md:block md:top-0 md:right-0 md:bottom-0
        md:w-[600px] md:h-full
        md:rounded-none
        ${!isOpen ? 'md:translate-x-full md:translate-y-0' : ''}
      `}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-200/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {collaborativeOrderStore.circleName || 'Group Order'}
                </h2>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    {collaborativeOrderStore.onlineCount} online
                  </span>
                  {collaborativeOrderStore.status === 'finalized' && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                      Finalized
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Connection Status Banner */}
          {!collaborativeOrderStore.isConnected && (
            <div className={`
              mt-3 px-4 py-2 rounded-lg text-sm
              ${collaborativeOrderStore.isReconnecting
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
              }
            `}>
              {collaborativeOrderStore.isReconnecting
                ? 'Reconnecting...'
                : 'Connection lost. Trying to reconnect...'
              }
            </div>
          )}
        </div>

        {/* Content - Mobile: Single column, Desktop: Grid */}
        <div className="h-[calc(100%-160px)] md:h-[calc(100%-200px)] overflow-hidden">
          {/* Mobile Layout */}
          <div className="md:hidden h-full flex flex-col">
            {/* Participants - Compact horizontal scroll */}
            <div className="px-6 py-4 border-b border-gray-200/30">
              <ParticipantsList compact />
            </div>

            {/* Items - Scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <CollaborativeItemsList />
            </div>
          </div>

          {/* Desktop Layout - 3 columns */}
          <div className="hidden md:grid md:grid-cols-[220px_1fr_280px] h-full">
            {/* Left: Participants */}
            <div className="border-r border-gray-200/30 px-4 py-6 overflow-y-auto">
              <ParticipantsList />
            </div>

            {/* Center: Items */}
            <div className="px-6 py-6 overflow-y-auto">
              <CollaborativeItemsList />
            </div>

            {/* Right: Split Calculator */}
            <div className="border-l border-gray-200/30 px-4 py-6 overflow-y-auto">
              <SplitCalculator />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-gray-200/30 px-6 py-4">
          {/* Mobile: Split Toggle */}
          <button
            onClick={() => setIsSplitExpanded(!isSplitExpanded)}
            className="md:hidden w-full flex items-center justify-between mb-3 px-4 py-3 bg-gray-50 rounded-xl"
          >
            <div className="text-left">
              <div className="text-sm text-gray-600">Your share</div>
              <div className="text-lg font-semibold text-gray-900">
                ₹{collaborativeOrderStore.myShare}
              </div>
            </div>
            {isSplitExpanded ? (
              <ChevronDown className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronUp className="w-5 h-5 text-gray-600" />
            )}
          </button>

          {/* Mobile: Expandable Split */}
          {isSplitExpanded && (
            <div className="md:hidden mb-3 p-4 bg-gray-50 rounded-xl max-h-64 overflow-y-auto">
              <SplitCalculator compact />
            </div>
          )}

          {/* Total & Finalize Button */}
          <div className="flex items-center justify-between gap-4">
            <div className="text-left">
              <div className="text-sm text-gray-600">Total</div>
              <div className="text-2xl font-bold text-gray-900">
                ₹{collaborativeOrderStore.total}
              </div>
              <div className="text-xs text-gray-500">
                {collaborativeOrderStore.itemCount} items
              </div>
            </div>

            {collaborativeOrderStore.status === 'active' && (
              <button
                onClick={handleFinalize}
                disabled={!collaborativeOrderStore.customSplitValid}
                className={`
                  px-8 py-4 rounded-2xl font-semibold text-white text-lg
                  transition-all duration-300
                  ${collaborativeOrderStore.customSplitValid
                    ? 'bg-gradient-to-r from-green-500 to-green-600 hover:shadow-xl hover:scale-105 active:scale-95'
                    : 'bg-gray-300 cursor-not-allowed'
                  }
                `}
              >
                Finalize Order
              </button>
            )}

            {collaborativeOrderStore.status === 'finalized' && (
              <div className="px-8 py-4 bg-green-100 text-green-800 rounded-2xl font-semibold">
                Order Finalized ✓
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
});
