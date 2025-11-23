'use client';

import { observer } from 'mobx-react-lite';
import { collaborativeOrderStore } from '../../stores/collaborativeOrderStore';
import { Mic, Minus, Plus, X } from 'lucide-react';

export const CollaborativeItemsList = observer(function CollaborativeItemsList() {
  const { items, currentUserId, lastItemAddedBy, status } = collaborativeOrderStore;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Mic className="w-10 h-10 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No items yet
        </h3>
        <p className="text-sm text-gray-600 max-w-xs">
          Start adding items by voice or use the menu below. Everyone in the group can add items!
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Order Items ({items.length})
      </h3>
      <div className="space-y-3">
        {items.map((item, index) => {
          const isOwnItem = item.addedBy === currentUserId;
          const isFlashing = lastItemAddedBy === item.addedBy;

          return (
            <div
              key={item.id}
              className={`
                relative p-4 rounded-xl border transition-all duration-300
                ${isOwnItem
                  ? 'bg-blue-50/50 border-blue-200'
                  : 'bg-white border-gray-200'
                }
                ${isFlashing && isOwnItem
                  ? 'animate-flash-green'
                  : isFlashing
                  ? 'animate-flash-amber'
                  : ''
                }
              `}
              style={{
                animation: `fadeInUp 0.4s ease-out ${index * 0.05}s both`
              }}
            >
              {/* Item Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900">{item.dishName}</h4>
                    <span className={`
                      text-xs px-2 py-0.5 rounded-full
                      ${item.dishType === 'veg'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                      }
                    `}>
                      {item.dishType === 'veg' ? '🟢 Veg' : '🔴 Non-Veg'}
                    </span>
                  </div>
                  {item.customization && (
                    <p className="text-xs text-gray-600 mt-1">{item.customization}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Added by {isOwnItem ? 'You' : item.addedByName}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">
                    ₹{item.itemTotal}
                  </div>
                  <div className="text-xs text-gray-500">
                    ₹{item.price} each
                  </div>
                </div>
              </div>

              {/* Quantity Controls */}
              {status === 'active' && (
                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    <button
                      disabled={!isOwnItem}
                      className={`
                        w-8 h-8 rounded-full flex items-center justify-center transition-all
                        ${isOwnItem
                          ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                        }
                      `}
                    >
                      {item.quantity === 1 ? (
                        <X className="w-4 h-4" />
                      ) : (
                        <Minus className="w-4 h-4" />
                      )}
                    </button>

                    <span className="w-8 text-center font-semibold text-gray-900">
                      {item.quantity}
                    </span>

                    <button
                      disabled={!isOwnItem}
                      className={`
                        w-8 h-8 rounded-full flex items-center justify-center transition-all
                        ${isOwnItem
                          ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                        }
                      `}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {!isOwnItem && (
                    <span className="text-xs text-gray-500 italic">
                      Only owner can edit
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
