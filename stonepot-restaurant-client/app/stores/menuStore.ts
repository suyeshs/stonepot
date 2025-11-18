import { makeAutoObservable } from 'mobx';

class MenuStore {
  highlightedItemName: string | null = null;
  scrollToItemName: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  highlightItem(itemName: string) {
    this.highlightedItemName = itemName;
    this.scrollToItemName = itemName;

    // Clear highlight after 5 seconds
    setTimeout(() => {
      if (this.highlightedItemName === itemName) {
        this.highlightedItemName = null;
      }
    }, 5000);
  }

  clearHighlight() {
    this.highlightedItemName = null;
  }

  clearScrollTarget() {
    this.scrollToItemName = null;
  }

  isHighlighted(itemName: string): boolean {
    return this.highlightedItemName === itemName;
  }
}

export const menuStore = new MenuStore();
