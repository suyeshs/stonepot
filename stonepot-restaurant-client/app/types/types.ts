// Menu item types

export interface BaseMenuItem {
  name: string;
  price: number;
  description: string;
  category: string;
  type: 'veg' | 'non-veg';
  imageUrl?: string;
  rating?: number;
  reviews?: number;
  available?: boolean;
  isBestseller?: boolean;
  tag?: string;
}

export interface RegularMenuItem extends BaseMenuItem {
  category: string;
}

export interface ComboMenuItem extends BaseMenuItem {
  category: 'combos';
  choices: string[];
}

export type MenuItem = RegularMenuItem | ComboMenuItem;

// Cart item types
export interface CartItem {
  name: string;
  price: number;
  quantity: number;
  type: 'veg' | 'non-veg';
  customization?: string;
  imageUrl?: string;
}

// Component prop types
export interface MenuItemCardProps {
  item: RegularMenuItem;
  highlighted?: boolean;
}

export interface ComboCardProps {
  item: ComboMenuItem;
  highlighted?: boolean;
}
