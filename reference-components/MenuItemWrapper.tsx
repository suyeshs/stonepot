// components/MenuItemWrapper.tsx
import ComboCard from './ComboCard';
import MenuItemCard from './MenuItemCard';
import { MenuItem } from '../types';

interface MenuItemWrapperProps {
  item: MenuItem;
}

const MenuItemWrapper: React.FC<MenuItemWrapperProps> = ({ item }) => {
  return item.category === 'combos' ? (
    <ComboCard item={item} />
  ) : (
    <MenuItemCard item={item} />
  );
};

export default MenuItemWrapper;
