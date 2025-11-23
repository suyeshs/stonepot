'use client';

import { observer } from 'mobx-react-lite';
import { collaborativeOrderStore, SplitType } from '../../stores/collaborativeOrderStore';
import { Check } from 'lucide-react';

interface SplitCalculatorProps {
  compact?: boolean; // Simplified view for mobile
}

export const SplitCalculator = observer(function SplitCalculator({ compact = false }: SplitCalculatorProps) {
  const { splitType, splitAmounts, total, customSplitValid } = collaborativeOrderStore;

  const handleSplitTypeChange = (type: SplitType) => {
    collaborativeOrderStore.setSplitType(type);
  };

  const tabs: { type: SplitType; label: string }[] = [
    { type: 'equal', label: 'Equal' },
    { type: 'itemized', label: 'By Items' },
    { type: 'custom', label: 'Custom' }
  ];

  if (compact) {
    // Mobile: Compact view
    return (
      <div>
        <div className="flex gap-2 mb-4">
          {tabs.map(tab => (
            <button
              key={tab.type}
              onClick={() => handleSplitTypeChange(tab.type)}
              className={`
                flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all
                ${splitType === tab.type
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {splitAmounts.map((split) => (
            <div
              key={split.participantId}
              className="flex items-center justify-between p-3 bg-white rounded-lg"
            >
              <span className="text-sm font-medium text-gray-900">
                {split.participantName}
              </span>
              <span className="text-lg font-semibold text-blue-600">
                ₹{split.amount}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Desktop: Full view
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Split Calculator
      </h3>

      {/* Split Type Tabs */}
      <div className="flex flex-col gap-2 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.type}
            onClick={() => handleSplitTypeChange(tab.type)}
            className={`
              flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all
              ${splitType === tab.type
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            <span>{tab.label}</span>
            {splitType === tab.type && <Check className="w-4 h-4" />}
          </button>
        ))}
      </div>

      {/* Split Breakdown */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          {splitType === 'equal' && 'Each person pays'}
          {splitType === 'itemized' && 'Based on items added'}
          {splitType === 'custom' && 'Custom split'}
        </div>

        {splitAmounts.map((split) => (
          <div
            key={split.participantId}
            className="p-3 bg-white rounded-xl border border-gray-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">
                {split.participantName}
              </span>
              <span className="text-lg font-semibold text-blue-600">
                ₹{split.amount}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${(split.amount / total) * 100}%` }}
              />
            </div>

            {/* Itemized details */}
            {splitType === 'itemized' && split.items && split.items.length > 0 && (
              <div className="mt-2 text-xs text-gray-600">
                {split.items.length} item{split.items.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Validation */}
      {splitType === 'custom' && !customSplitValid && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-xs text-red-800">
            ⚠️ Split amounts must equal ₹{total}
          </p>
        </div>
      )}

      {/* Total Summary */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Total Order</span>
          <span className="font-bold text-gray-900">₹{total}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-gray-600">Your Share</span>
          <span className="font-bold text-blue-600">
            ₹{collaborativeOrderStore.myShare}
          </span>
        </div>
      </div>
    </div>
  );
});
