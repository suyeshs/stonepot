'use client';
import { useState } from 'react';

interface VoiceComboCardProps {
  data: {
    name: string;
    price: number;
    description?: string;
    imageUrl?: string;
    category?: string;
    type?: string;
    tag?: string;
    choices?: string[];
    available?: boolean;
  };
  onAction?: (action: string, data: any) => void;
}

export function VoiceComboCard({ data, onAction }: VoiceComboCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState(data.choices?.[0] || '');

  const handleAddToCart = () => {
    onAction?.('add_to_cart_verbal', {
      dishName: data.name,
      quantity: 1,
      customizations: selectedChoice
    });
  };

  return (
    <div className="neu-card overflow-hidden hover-lift animate-fade-in">
      {/* Image */}
      {data.imageUrl && (
        <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200">
          <img
            src={data.imageUrl}
            alt={data.name}
            className="w-full h-full object-cover"
          />
          {data.tag && (
            <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              <span>🔥</span>
              <span>{data.tag}</span>
            </div>
          )}
        </div>
      )}

      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-2xl font-bold neu-text mb-1">{data.name}</h3>
            <span className="text-xs neu-text-secondary uppercase tracking-wide">
              Combo Meal
            </span>
          </div>
          <div className="text-2xl font-bold neu-text-accent">₹{data.price}</div>
        </div>

        {/* Description */}
        {data.description && (
          <p className="text-sm neu-text-secondary leading-relaxed">
            {data.description}
          </p>
        )}

        {/* Selected Choice */}
        {selectedChoice && (
          <div className="neu-concave p-3 rounded-lg">
            <p className="text-xs neu-text-secondary mb-1">Selected:</p>
            <p className="text-sm font-semibold neu-text">{selectedChoice}</p>
          </div>
        )}

        {/* Customization Button */}
        {data.choices && data.choices.length > 0 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm font-semibold text-blue-500 hover:text-blue-600"
          >
            {isExpanded ? 'Hide Options' : 'Customize'}
          </button>
        )}

        {/* Choices Dropdown */}
        {isExpanded && data.choices && (
          <div className="neu-concave rounded-lg overflow-hidden animate-fade-in">
            <p className="text-xs font-semibold neu-text p-3 border-b border-gray-200">
              Choose your option:
            </p>
            <div className="divide-y divide-gray-200">
              {data.choices.map((choice, idx) => (
                <label
                  key={idx}
                  className="flex items-center p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="radio"
                    name="combo-choice"
                    value={choice}
                    checked={selectedChoice === choice}
                    onChange={() => setSelectedChoice(choice)}
                    className="mr-3"
                  />
                  <span className="text-sm neu-text">{choice}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Add to Cart Button */}
        <button
          onClick={handleAddToCart}
          disabled={data.available === false}
          className={`w-full neu-button-accent rounded-xl px-6 py-3 text-base font-semibold transition-all ${
            data.available === false ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {data.available === false ? 'Not Available' : `Add to Cart • ₹${data.price}`}
        </button>
      </div>
    </div>
  );
}
