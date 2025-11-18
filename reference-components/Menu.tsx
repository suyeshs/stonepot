// components/Menu.tsx
'use client'

import { useState, useRef, useEffect } from 'react';
import ComboCard from './ComboCard';
import MenuItemCard from './MenuItemCard';
import { observer } from 'mobx-react-lite';
import { cartStore } from '../stores/cartStore';
import { MenuItem, ComboMenuItem, RegularMenuItem } from '../types/types';



const Menu: React.FC = observer(() => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const tabsRef = useRef<HTMLDivElement>(null);
  const [showVegOnly, setShowVegOnly] = useState<boolean>(false);
  const menuItems = [
    // Combos
    {
      name: 'Veg Kuttu Curry Combo [serves 1]',
      price: 199,
      description: 'Puttus, Otti or Rice of your choice - serves One',
      category: 'combos',
      type: 'veg',
      tag: 'bestseller',
      choices: ['Paputtu', 'Kadambuttu', 'Noolputtu', 'Akki Otti', 'Ney Kulu', 'Steamed Rice'],
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/7770c2bb-c535-4854-6ee6-a356bb407300/public',
      available: true,
      rating: 4.5
    },
    {
      name: 'Veg Curry Combo (Bimballe curry)',
      price: 199,
      description: 'Puttus, Otti or Rice of your choice - serves One',
      category: 'combos',
      type: 'veg',
      choices: ['Paputtu', 'Kadambuttu', 'Noolputtu', 'Akki Otti', 'Ney Kulu', 'Steamed Rice'],
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/7770c2bb-c535-4854-6ee6-a356bb407300/public'
    },
    {
      name: 'Egg Curry Combo -1ps Eggserve 1',
      price: 240,
      description: 'Choose any one Puttu / Rice of your choice',
      category: 'combos',
      type: 'non-veg',
      choices: ['Paputtu', 'Kadambuttu', 'Noolputtu', 'Akki Otti', 'Ney Kulu', 'Steamed Rice'],
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/7770c2bb-c535-4854-6ee6-a356bb407300/public'
    },
    {
      name: 'Pandi Curry Combo',
      price: 255,
      description: 'Choose any one Puttu / Rice of your choice',
      category: 'combos',
      type: 'non-veg',
      choices: ['Paputtu', 'Kadambuttu', 'Noolputtu', 'Akki Otti', 'Ney Kulu', 'Steamed Rice'],
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/dc08d86c-83d9-466f-56fc-959070195600/public'
    },
    {
      name: 'Koli Curry Combo (Chicken)',
      price: 250,
      description: 'Choose any one Puttu / Rice of your choice',
      category: 'combos',
      type: 'non-veg',
      choices: ['Paputtu', 'Kadambuttu', 'Noolputtu', 'Akki Otti', 'Ney Kulu', 'Steamed Rice'],
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/7770c2bb-c535-4854-6ee6-a356bb407300/public'
    },
  
    // Appetizers
    {
      name: 'Spicy Smoked Pork(onake Erachi)',
      price: 460,
      description: 'Onake Erachi Spicy Smoked Pork',
      category: 'appetizers',
      rating: 4.7,
      type: 'non-veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/30bd3da1-423d-42f5-6a53-e7c3f471df00/public'
    },
    {
      name: 'Mutton Pepper Fry',
      price: 460,
      description: 'Mutton roasted in fresh pepper sourced from our estates in Coorg.',
      category: 'appetizers',
      rating: 4.6,
      type: 'non-veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/30bd3da1-423d-42f5-6a53-e7c3f471df00/public'
    },
    {
      name: 'Pepper Chicken Fry(kodava Koli Bharthad',
      price: 300,
      description: 'Succulent pepper chicken fry.',
      category: 'appetizers',
      rating: 4.1,
      type: 'non-veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/c4e60a3d-43a7-41d2-2b19-d64c18cc9600/public'
    },
    {
      name: 'Chicken Cutlet-4ps',
      price: 315,
      description: 'Mildly spiced, soft chicken cutlets.',
      category: 'appetizers',
      rating: 4.1,
      type: 'non-veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/c4e60a3d-43a7-41d2-2b19-d64c18cc9600/public'
    },
    {
      name: 'Pork Fry (pandi Barthad)-220gm',
      price: 340,
      description: 'Slow cooked pork in traditional black masala.',
      category: 'appetizers',
      rating: 4.2,
      type: 'non-veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/c4e60a3d-43a7-41d2-2b19-d64c18cc9600/public'
    },
    {
      name: 'Veg Cutlet',
      price: 225,
      description: 'Check for the day special.',
      category: 'appetizers',
      type: 'veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2a0b331f-03f2-4daa-b9a0-5f25e2d6df00/public'
    },
    {
      name: 'Crispy Bhendi Fry',
      price: 225,
      description: 'Ladies finger batter fried to a crisp with spices.',
      category: 'appetizers',
      type: 'veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/6ce44b67-2b64-4211-9f8f-4f22b921e700/public'
    },
    {
      name: 'Tangy Bitter Gourd Fry(kaipake Fry)',
      price: 225,
      description: 'Tangy bitter gourd fried, and seasoned with chilli and lime.',
      category: 'appetizers',
      type: 'veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/d20f696b-956c-4f89-bd05-679c3e5d3400/public'
    },
    {
      name: 'Kadle Palya',
      price: 210,
      description: 'Steamed black chana seasoned in spices.',
      category: 'appetizers',
      type: 'veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/cee7e8b9-efed-41e5-c10c-2417d02fa300/public'
    },
    {
      name: 'Crispy Banana Fritters(bale Kai Fry)',
      price: 225,
      description: 'Crispy Tangy raw banana fritters.',
      category: 'appetizers',
      type: 'veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public'
    },
  
    // Ottis-Puttus-Rice
    {
      name: 'Paputtu',
      price: 60,
      description: 'Traditional Coorgi rice cake',
      category: 'ottis-puttus-rice',
      type: 'veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/30bd3da1-423d-42f5-6a53-e7c3f471df00/public'
    },
    {
      name: 'Kadambuttu',
      price: 60,
      description: 'Rice dumplings',
      category: 'ottis-puttus-rice',
      type: 'veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/30bd3da1-423d-42f5-6a53-e7c3f471df00/public'
    },
    {
      name: 'Noolputtu',
      price: 60,
      description: 'String hoppers',
      category: 'ottis-puttus-rice',
      type: 'veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/30bd3da1-423d-42f5-6a53-e7c3f471df00/public'
    },
  
    // Curries
    {
      name: 'Pandi Curry',
      price: 245,
      description: 'Traditional Coorgi pork curry',
      category: 'curries',
      type: 'non-veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/30bd3da1-423d-42f5-6a53-e7c3f471df00/public'
    },
    {
      name: 'Kadle Curry',
      price: 165,
      description: 'Black chickpea curry',
      category: 'curries',
      type: 'veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/30bd3da1-423d-42f5-6a53-e7c3f471df00/public'
    },
    {
      name: 'Koli Curry',
      price: 225,
      description: 'Spicy chicken curry',
      category: 'curries',
      type: 'non-veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/30bd3da1-423d-42f5-6a53-e7c3f471df00/public'
    },
  
    // Desserts
    {
      name: 'Payasam',
      price: 80,
      description: 'Sweet milk pudding with vermicelli',
      category: 'desserts',
      type: 'veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public'
    },
    {
      name: 'Elaneer Payasam',
      price: 90,
      description: 'Tender coconut pudding',
      category: 'desserts',
      type: 'veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public'
    },
    {
      name: 'Chikkrotti',
      price: 70,
      description: 'Traditional Coorgi sweet',
      category: 'desserts',
      type: 'veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public'
    },
  
    // Coolers
    {
      name: 'Neer More',
      price: 60,
      description: 'Spiced buttermilk',
      category: 'coolers',
      type: 'veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public'
    },
    {
      name: 'Fresh Lime Soda',
      price: 70,
      description: 'Refreshing lime soda',
      category: 'coolers',
      type: 'veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public'
    },
    {
      name: 'Tender Coconut Water',
      price: 80,
      description: 'Natural coconut water',
      category: 'coolers',
      type: 'veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public'
    },
  
    // Soups
    {
      name: 'Tomato Soup',
      price: 90,
      description: 'Classic tomato soup',
      category: 'soups',
      type: 'veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public'
    },
    {
      name: 'Chicken Sweet Corn Soup',
      price: 110,
      description: 'Creamy chicken and corn soup',
      category: 'soups',
      type: 'non-veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public'
    },
    {
      name: 'Mushroom Soup',
      price: 100,
      description: 'Creamy mushroom soup',
      category: 'soups',
      type: 'veg',
      imageUrl: 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/2810bb84-7864-4891-4e2f-324568792500/public'
    }
  ];
  

  const filteredItems = menuItems.filter(item => 
    (activeCategory === 'all' || item.category === activeCategory) &&
    (!showVegOnly || item.type === 'veg')
  );

  const categories = ['all', 'combos', 'appetizers', 'ottis-puttus-rice', 'curries', 'desserts', 'coolers', 'soups'];

  useEffect(() => {
    if (tabsRef.current) {
      const activeTab = tabsRef.current.querySelector(`[data-category="${activeCategory}"]`);
      if (activeTab) {
        activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [activeCategory]);


  return (
    <div className="my-12 max-w-6xl mx-auto px-4">
      <h2 className="text-3xl font-bold mb-6 text-center">Our Menu</h2>
      
      {/* Improved Category Tabs */}
      <div className="relative mb-6 overflow-hidden">
        <div 
          ref={tabsRef}
          className="flex overflow-x-auto pb-2 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {categories.map((category) => (
            <button
              key={category}
              data-category={category}
              className={`flex-shrink-0 px-4 py-2 mx-1 rounded-full text-sm font-medium transition-all duration-200 ease-in-out
                ${activeCategory === category 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              onClick={() => setActiveCategory(category)}
            >
              {category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </button>
          ))}
        </div>
        <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-gray-200">
          <div 
            className="h-full bg-blue-600 transition-all duration-300 ease-in-out"
            style={{
              width: `${100 / categories.length}%`,
              transform: `translateX(${categories.indexOf(activeCategory) * 100}%)`
            }}
          />
        </div>
      </div>
  
      {/* Veg/Non-Veg Toggle */}
      <div className="flex justify-center items-center mb-6">
        <span className="mr-2">All</span>
        <button 
          className="w-12 h-6 bg-gray-300 rounded-full p-1 duration-300 ease-in-out"
          onClick={() => setShowVegOnly(!showVegOnly)}
        >
          <div className={`w-4 h-4 rounded-full ${showVegOnly ? 'bg-green-500 ml-6' : 'bg-red-500 ml-0'} duration-300 ease-in-out`}></div>
        </button>
        <span className="ml-2">Veg Only</span>
      </div>
  
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item, index) => {
          if (item.category === 'combos') {
            return (
              <ComboCard 
                key={index}
                item={item as ComboMenuItem}
              />
            );
          } else {
            return (
              <MenuItemCard 
                key={index}
                item={item as RegularMenuItem}
              />
            );
          }
        })}
      </div>
    </div>
  );
});

export default Menu;