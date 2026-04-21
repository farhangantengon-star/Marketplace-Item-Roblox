export type ItemType = 'Regular' | 'Limited' | 'LimitedU';

export interface MarketplaceItem {
  id: string;
  name: string;
  creator: string;
  type: ItemType;
  price: number;
  initialPrice: number;
  stock?: number;
  initialStock?: number;
  soldCount: number;
  imageUrl: string;
  category: 'Hat' | 'Face' | 'Gear' | 'Bundle' | 'Accessory' | 'Animation' | 'T-Shirt';
  lastPriceIncrease?: number;
  previousPrice?: number;
  hikeTarget?: number;
  likes?: number;
  dislikes?: number;
  favorites?: number;
  targetLikes?: number;
  targetDislikes?: number;
  targetFavorites?: number;
  isOffsale?: boolean;
  commissionMode?: 'full' | 'trickle';
  isTshirt?: boolean;
  creatorId?: string;
}

export interface InventoryItem {
  id: string;
  itemId: string;
  purchasePrice: number;
  purchaseDate: number;
}

export interface UserState {
  balance: number;
  pendingBalance: number;
  inventory: InventoryItem[];
  likedItems: string[];
  dislikedItems: string[];
  favoriteItems: string[];
}

export interface MarketplaceListing {
  id: string;
  inventoryItemId?: string; // Undefined for bots
  itemId: string;
  price: number;
  sellerName: string;
  sellerType: 'User' | 'Bot';
}

export interface Transaction {
  id: string;
  itemId: string;
  price: number;
  timestamp: number;
  buyer: 'User' | 'Bot';
}
