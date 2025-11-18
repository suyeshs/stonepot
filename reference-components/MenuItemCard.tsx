'use client';
import Image from 'next/image';
import { observer } from 'mobx-react-lite';
import { cartStore } from '../stores/cartStore';
import { MenuItem, MenuItemCardProps } from '../types';
import { useState, useEffect } from 'react';
import CartIsland from './CartIsland';

const MenuItemCard: React.FC<MenuItemCardProps> = ({ item }) => {
  const [quantity, setQuantity] = useState(0);

  useEffect(() => {
    const cartItem = cartStore.items.find(i => i.name === item.name && i.type === item.type);
    setQuantity(cartItem ? cartItem.quantity : 0);
  }, [item.name, item.type]);

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
    <div className="flex flex-col mb-4">
      {item.isBestseller && (
        <div className="flex items-center mb-1">
          <span className="text-red-500 mr-1">🔥</span>
          <span className="text-red-500 text-sm font-semibold">Bestseller</span>
        </div>
      )}
      <h3 className="text-lg font-semibold mb-1">{item.name}</h3>
      <p className="text-gray-700 font-bold mb-1">₹{item.price}</p>
      <div className="flex items-center mb-2">
        <span className="text-green-600 font-bold mr-1">★ {item.rating?.toFixed(1)}</span>
        <span className="text-gray-500 text-sm">({item.reviews})</span>
      </div>
      <div className="flex justify-between items-end">
        <div className="flex-1">
          <p className="text-gray-600 text-sm mb-2">{item.description}</p>
          <button className="text-pink-500 text-sm font-semibold">
            Save to eatlist
          </button>
        </div>
        <div className="relative w-24 h-24 ml-4">
          {item.imageUrl && (
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              className="object-cover"

              sizes="(max-width: 20px) 100vw, 50vw"
              />
          )}
          {quantity === 0 ? (
            <button
              className="absolute bottom-2 right-2 bg-white text-green-600 font-bold py-1 px-4 rounded-md text-sm shadow-md"
              onClick={handleAddToCart}
            >
              ADD
            </button>
          ) : (
            <div className="absolute bottom-2 right-2 bg-white rounded-md shadow-md flex items-center">
              <button
                className="px-2 py-1 text-green-600 font-bold"
                onClick={handleDecreaseQuantity}
              >
                -
              </button>
              <span className="px-2 py-1 text-green-600 font-bold">{quantity}</span>
              <button
                className="px-2 py-1 text-green-600 font-bold"
                onClick={handleIncreaseQuantity}
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
      <div><CartIsland /></div>
    </div>
  );
};

export default observer(MenuItemCard);