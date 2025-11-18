'use client';
import { observer } from 'mobx-react-lite';
import { cartStore } from '../stores/cartStore';
import { menuStore } from '../stores/menuStore';
import { MenuItemCardProps } from '../types/types';
import { useState, useEffect, useRef } from 'react';

const MenuItemCard: React.FC<MenuItemCardProps> = ({ item, highlighted }) => {
  const [quantity, setQuantity] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const isHighlighted = highlighted || menuStore.isHighlighted(item.name);

  useEffect(() => {
    const cartItem = cartStore.items.find(i => i.name === item.name && i.type === item.type);
    setQuantity(cartItem ? cartItem.quantity : 0);
  }, [item.name, item.type, cartStore.items.length]);

  // Scroll into view when highlighted
  useEffect(() => {
    if (menuStore.scrollToItemName === item.name && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      menuStore.clearScrollTarget();
    }
  }, [menuStore.scrollToItemName, item.name]);

  const handleAddToCart = () => {
    cartStore.addMenuItem(item);
    setQuantity(1);
  };

  const handleIncreaseQuantity = () => {
    cartStore.updateQuantity(item.name, item.type as 'veg' | 'non-veg', quantity + 1);
    setQuantity(quantity + 1);
  };

  const handleDecreaseQuantity = () => {
    if (quantity > 1) {
      cartStore.updateQuantity(item.name, item.type as 'veg' | 'non-veg', quantity - 1);
      setQuantity(quantity - 1);
    } else if (quantity === 1) {
      cartStore.removeItem(item.name, item.type as 'veg' | 'non-veg');
      setQuantity(0);
    }
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
          {item.isBestseller && (
            <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              <span>🔥</span>
              <span>Bestseller</span>
            </div>
          )}
        </div>
      )}

      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-xl font-bold neu-text mb-1">{item.name}</h3>
            <div className="text-lg font-bold neu-text-accent">₹{item.price}</div>
          </div>
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

        {/* Add to Cart / Quantity Control */}
        {quantity === 0 ? (
          <button
            onClick={handleAddToCart}
            disabled={item.available === false}
            className={`w-full neu-button-accent rounded-xl px-6 py-3 text-base font-semibold transition-all ${
              item.available === false ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {item.available === false ? 'Not Available' : `Add to Cart • ₹${item.price}`}
          </button>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 neu-concave rounded-xl overflow-hidden p-1">
              <button
                onClick={handleDecreaseQuantity}
                className="w-10 h-10 flex items-center justify-center neu-button rounded-lg font-bold"
              >
                −
              </button>
              <span className="px-4 font-semibold neu-text min-w-[2rem] text-center">
                {quantity}
              </span>
              <button
                onClick={handleIncreaseQuantity}
                className="w-10 h-10 flex items-center justify-center neu-button rounded-lg font-bold"
              >
                +
              </button>
            </div>
            <div className="font-bold neu-text-accent">
              ₹{item.price * quantity}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default observer(MenuItemCard);
