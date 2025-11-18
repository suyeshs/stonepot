'use client';
import { observer } from 'mobx-react-lite';
import { cartStore } from '../stores/cartStore';
import { menuStore } from '../stores/menuStore';
import { ComboCardProps } from '../types/types';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ComboCard: React.FC<ComboCardProps> = ({ item, highlighted }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState(item.choices[0]);
  const cardRef = useRef<HTMLDivElement>(null);
  const isHighlighted = highlighted || menuStore.isHighlighted(item.name);

  // Scroll into view when highlighted
  useEffect(() => {
    if (menuStore.scrollToItemName === item.name && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      menuStore.clearScrollTarget();
    }
  }, [menuStore.scrollToItemName, item.name]);

  const handleAddToCart = () => {
    cartStore.addComboItem(item, selectedChoice);
  };

  const handleChoiceSelect = (choice: string) => {
    setSelectedChoice(choice);
    setIsExpanded(false);
  };

  return (
    <div
      ref={cardRef}
      className={`neu-card overflow-hidden hover-lift transition-all duration-300 ${
        isHighlighted ? 'ring-4 ring-blue-400 shadow-2xl' : ''
      }`}
    >
      {/* Image */}
      {item.imageUrl && (
        <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
          />
          {item.tag && (
            <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              <span>🔥</span>
              <span>{item.tag}</span>
            </div>
          )}
        </div>
      )}

      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-xl font-bold neu-text mb-1">{item.name}</h3>
            <span className="text-xs neu-text-secondary uppercase tracking-wide">
              Combo Meal
            </span>
          </div>
          <div className="text-lg font-bold neu-text-accent">₹{item.price}</div>
        </div>

        {/* Rating & Type */}
        <div className="flex items-center gap-3">
          {item.rating && (
            <div className="flex items-center gap-1">
              <span className="text-yellow-500">⭐</span>
              <span className="font-semibold neu-text">{item.rating.toFixed(1)}</span>
              {item.reviews && (
                <span className="text-xs neu-text-secondary">({item.reviews})</span>
              )}
            </div>
          )}
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            item.type === 'veg'
              ? 'bg-green-100 text-green-700 border border-green-300'
              : 'bg-red-100 text-red-700 border border-red-300'
          }`}>
            {item.type === 'veg' ? '🌱 Veg' : '🍖 Non-Veg'}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm neu-text-secondary leading-relaxed">
          {item.description}
        </p>

        {/* Selected Choice */}
        {selectedChoice && (
          <div className="neu-concave p-3 rounded-lg">
            <p className="text-xs neu-text-secondary mb-1">Selected:</p>
            <p className="text-sm font-semibold neu-text">{selectedChoice}</p>
          </div>
        )}

        {/* Customization Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm font-semibold text-blue-500 hover:text-blue-600"
        >
          {isExpanded ? 'Hide Options' : 'Customize'}
        </button>

        {/* Choices Dropdown with Animation */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="neu-concave rounded-lg overflow-hidden"
            >
              <p className="text-xs font-semibold neu-text p-3 border-b border-gray-200">
                Choose your option:
              </p>
              <div className="divide-y divide-gray-200">
                {item.choices.map((choice, idx) => (
                  <label
                    key={idx}
                    className="flex items-center p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <input
                      type="radio"
                      name="combo-choice"
                      value={choice}
                      checked={selectedChoice === choice}
                      onChange={() => handleChoiceSelect(choice)}
                      className="mr-3"
                    />
                    <span className="text-sm neu-text">{choice}</span>
                  </label>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add to Cart Button */}
        <button
          onClick={handleAddToCart}
          disabled={item.available === false}
          className={`w-full neu-button-accent rounded-xl px-6 py-3 text-base font-semibold transition-all ${
            item.available === false ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {item.available === false ? 'Not Available' : `Add to Cart • ₹${item.price}`}
        </button>
      </div>
    </div>
  );
};

export default observer(ComboCard);
