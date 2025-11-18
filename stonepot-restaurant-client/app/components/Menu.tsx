'use client';

import { useState, useRef, useEffect } from 'react';
import ComboCard from './ComboCard';
import MenuItemCard from './MenuItemCard';
import { observer } from 'mobx-react-lite';
import { ComboMenuItem, RegularMenuItem } from '../types/types';
import { menuItems, categories } from '../data/menuData';

const Menu: React.FC = observer(() => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const tabsRef = useRef<HTMLDivElement>(null);
  const [showVegOnly, setShowVegOnly] = useState<boolean>(false);

  const filteredItems = menuItems.filter(item =>
    (activeCategory === 'all' || item.category === activeCategory) &&
    (!showVegOnly || item.type === 'veg')
  );

  useEffect(() => {
    if (tabsRef.current) {
      const activeTab = tabsRef.current.querySelector(`[data-category="${activeCategory}"]`);
      if (activeTab) {
        activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [activeCategory]);

  return (
    <div className="w-full">
      <h2 className="text-3xl font-bold mb-6 text-center neu-text">Our Menu</h2>

      {/* Category Tabs */}
      <div className="relative mb-6 overflow-hidden">
        <div
          ref={tabsRef}
          className="flex overflow-x-auto pb-2 gap-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {categories.map((category) => (
            <button
              key={category}
              data-category={category}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                activeCategory === category
                  ? 'neu-button-accent'
                  : 'neu-button'
              }`}
              onClick={() => setActiveCategory(category)}
            >
              {category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Veg/Non-Veg Toggle */}
      <div className="flex justify-center items-center mb-6">
        <span className="mr-3 text-sm font-medium neu-text">All</span>
        <button
          className={`w-14 h-7 rounded-full p-1 transition-all duration-300 ${
            showVegOnly ? 'bg-green-400' : 'bg-gray-300'
          }`}
          onClick={() => setShowVegOnly(!showVegOnly)}
        >
          <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${
            showVegOnly ? 'translate-x-7' : 'translate-x-0'
          }`}></div>
        </button>
        <span className="ml-3 text-sm font-medium neu-text">Veg Only</span>
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item, index) => {
          if (item.category === 'combos') {
            return (
              <ComboCard
                key={`${item.name}-${index}`}
                item={item as ComboMenuItem}
              />
            );
          } else {
            return (
              <MenuItemCard
                key={`${item.name}-${index}`}
                item={item as RegularMenuItem}
              />
            );
          }
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <p className="text-lg neu-text-secondary">No items found in this category</p>
        </div>
      )}
    </div>
  );
});

export default Menu;
