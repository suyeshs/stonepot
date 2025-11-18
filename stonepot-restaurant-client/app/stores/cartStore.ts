import { makeAutoObservable } from 'mobx';
import { CartItem, MenuItem, ComboMenuItem } from '../types/types';

class CartStore {
  items: CartItem[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  addMenuItem(item: MenuItem) {
    const existingItem = this.items.find(
      i => i.name === item.name && i.type === item.type && !i.customization
    );

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      this.items.push({
        name: item.name,
        price: item.price,
        quantity: 1,
        type: item.type,
        imageUrl: item.imageUrl
      });
    }
  }

  addComboItem(item: ComboMenuItem, selectedChoice: string) {
    const existingItem = this.items.find(
      i => i.name === item.name && i.customization === selectedChoice
    );

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      this.items.push({
        name: item.name,
        price: item.price,
        quantity: 1,
        type: item.type,
        customization: selectedChoice,
        imageUrl: item.imageUrl
      });
    }
  }

  updateQuantity(name: string, type: 'veg' | 'non-veg', newQuantity: number) {
    const item = this.items.find(i => i.name === name && i.type === type);
    if (item) {
      item.quantity = newQuantity;
    }
  }

  removeItem(name: string, type: 'veg' | 'non-veg') {
    this.items = this.items.filter(i => !(i.name === name && i.type === type));
  }

  get total() {
    return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  get itemCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  clearCart() {
    this.items = [];
  }
}

export const cartStore = new CartStore();
