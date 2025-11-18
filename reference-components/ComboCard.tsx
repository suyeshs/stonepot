'use client';
import Image from 'next/image';
import { observer } from 'mobx-react-lite';
import { cartStore } from '../stores/cartStore';
import { ComboMenuItem, ComboCardProps } from '../types';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ComboCard: React.FC<ComboCardProps> = ({ item }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState(item.choices[0]);

  const handleAddToCart = () => {
    cartStore.addComboItem(item, selectedChoice);
  };

  const handleChoiceSelect = (choice: string) => {
    setSelectedChoice(choice);
    setIsExpanded(false);
  };

  return (
    <div className="mb-4">
      <div className="flex flex-col">
        <div className="flex justify-between">
          <div className="flex-1">
            {item.tag && (
              <div className="flex items-center mb-1">
                <span className="text-red-500 mr-1">🔥</span>
                <span className="text-red-500 text-sm font-semibold">{item.tag}</span>
              </div>
            )}
            <h3 className="text-lg font-semibold mb-1">{item.name}</h3>
            <p className="text-gray-700 font-bold mb-1">₹{item.price.toFixed(2)}</p>
            <div className="flex items-center mb-2">
              {item.rating && (
                <>
                  <span className="text-green-600 font-bold mr-1">★ {item.rating.toFixed(1)}</span>
                  <span className="text-gray-500 text-sm">({item.reviews})</span>
                </>
              )}
            </div>
            <p className="text-gray-600 text-sm mb-2">{item.description}</p>
            <button 
              className="text-pink-500 text-sm font-semibold mr-4 mb-2"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              Customise
            </button>
            <p className="text-gray-600 text-sm font-semibold mb-2">
              {selectedChoice}
            </p>
          </div>
          <div className="relative w-24 h-24 ml-4">
            <Image
              src={item.imageUrl}
              alt={item.name}
              width={96}
              height={96}
              className="rounded-md object-cover"
            />
            <button
              className="absolute bottom-2 right-2 bg-white text-green-600 font-bold py-1 px-4 rounded-md text-sm shadow-md"
              onClick={handleAddToCart}
            >
              ADD
            </button>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="mt-2 bg-gray-100 rounded-md overflow-hidden"
          >
            <p className="text-gray-700 text-sm font-semibold p-4 pb-2">Choose:</p>
            <ul className="divide-y divide-gray-200">
              {item.choices.map((choice, index) => (
                <li key={index} className="flex items-center p-4">
                  <input
                    type="radio"
                    id={`choice-${index}`}
                    name="choice"
                    value={choice}
                    checked={selectedChoice === choice}
                    onChange={() => handleChoiceSelect(choice)}
                    className="mr-3"
                  />
                  <label htmlFor={`choice-${index}`} className="flex items-center flex-1 cursor-pointer">
                    <span className="text-sm text-gray-700">{choice}</span>
                  </label>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default observer(ComboCard);