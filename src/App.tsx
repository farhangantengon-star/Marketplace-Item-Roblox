/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  User, 
  TrendingUp, 
  Clock, 
  Package, 
  Search, 
  Filter,
  X,
  ChevronRight,
  TrendingDown,
  LayoutGrid,
  Menu,
  MoreHorizontal,
  Bell,
  Settings,
  HelpCircle,
  LogOut,
  Hexagon,
  MoreVertical,
  Send,
  MessageSquare,
  Bot,
  ThumbsUp,
  ThumbsDown,
  Star,
  Upload,
  Heart,
  Image as ImageIcon,
  CreditCard,
  Sparkles,
  Check,
  Shirt,
  Trash2
} from 'lucide-react';
import { MarketplaceItem, UserState, Transaction, InventoryItem, MarketplaceListing } from './types';
import { INITIAL_ITEMS } from './data/items';
import { ItemIcon } from './components/ItemIcon';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { 
  db, 
  auth, 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  addDoc,
  onAuthStateChanged,
  signInWithGoogle,
  User as FirebaseUser,
  testConnection
} from './lib/firebase';

// Global shim for process.env (Vercel/Production safety)
if (typeof window !== 'undefined' && !('process' in window)) {
  (window as any).process = { env: {} };
}

// Initialize Gemini with safety for production environments (Vercel)
const getApiKey = () => {
  try {
    // Try process.env (AI Studio / Shimmed)
    if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) {
      return process.env.GEMINI_API_KEY;
    }
    // Try Vite env if available
    const metaEnv = (import.meta as any).env;
    if (metaEnv?.VITE_GEMINI_API_KEY) {
      return metaEnv.VITE_GEMINI_API_KEY;
    }
  } catch (e) {
    console.warn("API Key resolution error", e);
  }
  return "";
};

const apiKey = getApiKey();
// The SDK v1 uses new GoogleGenAI({ apiKey })
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Roblox Robux Icon (Using user-provided image)
const RobuxIcon = ({ className = "w-4 h-4" }) => (
  <img 
    src="https://i.ibb.co.com/dJK6Yhwk/image.png" 
    alt="R$" 
    className={`${className} object-contain`}
    referrerPolicy="no-referrer"
    onError={(e) => {
      // Fallback if the user link fails to resolve directly
      (e.target as HTMLImageElement).src = "https://images.weserv.nl/?url=ibb.co.com/dJK6Yhwk&default=https://static.wikia.nocookie.net/roblox/images/e/e8/Robux_2019_Logomark.png";
    }}
  />
);

// Logo Constants
const LIMITED_LOGO = "https://i.ibb.co.com/TDds33L5/image.png";
const LIMITED_U_LOGO = "https://i.ibb.co.com/nsP4vBMB/image.png";
const ROBLOX_HEADER_LOGO = "https://i.ibb.co.com/QvcLwCfC/image.png";

export default function App() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [isFirebaseSynced, setIsFirebaseSynced] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Connection Test
  useEffect(() => {
    testConnection();
  }, []);

  // Auth Listener
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
    });
  }, []);

  const handleSignIn = async () => {
    if (isAuthLoading) return;
    setIsAuthLoading(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error(e);
      setIsAuthLoading(false);
    }
  };

  // Real-time Firestore Sync
  useEffect(() => {
    const q = query(collection(db, 'items'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fbItems = snapshot.docs.map(doc => doc.data() as MarketplaceItem);
      
      const targets = [5000, 2000, 1000, 300, 800, 200, 500, 400];
      
      // Merge INITIAL_ITEMS with items from Firestore
      // System items (Roblox) should be merged if updated or missing in FB
      const merged: MarketplaceItem[] = INITIAL_ITEMS.map(item => {
        // Seeded random for stable fake stats
        const seed = parseInt(item.id) || item.name.length;
        const fakeLikes = Math.floor(((seed * 123) % 50000)) + 1000;
        const fakeDislikes = Math.floor(((seed * 456) % 5000)) + 100;
        const fakeFavs = Math.floor(((seed * 789) % 100000)) + 5000;
        const fakeHike = targets[seed % targets.length];
        const fakeSold = Math.floor(((seed * 321) % 5000)) + 50;

        return {
          ...item,
          likes: fakeLikes,
          dislikes: fakeDislikes,
          favorites: fakeFavs,
          hikeTarget: fakeHike,
          soldCount: item.soldCount || fakeSold
        };
      });
      
      fbItems.forEach(fbItem => {
        const existingIdx = merged.findIndex(it => it.id === fbItem.id);
        if (existingIdx !== -1) {
          // Overwrite with real data from FB, but fallback to our 'fake' stats if FB fields are missing
          merged[existingIdx] = { 
            ...merged[existingIdx], 
            ...fbItem,
            likes: fbItem.likes ?? merged[existingIdx].likes,
            dislikes: fbItem.dislikes ?? merged[existingIdx].dislikes,
            favorites: fbItem.favorites ?? merged[existingIdx].favorites,
            soldCount: fbItem.soldCount ?? merged[existingIdx].soldCount
          };
        } else {
          // New UGC item from FB
          merged.push({
            ...fbItem,
            likes: fbItem.likes || 15,
            dislikes: fbItem.dislikes || 0,
            favorites: fbItem.favorites || 20,
            soldCount: fbItem.soldCount || 5
          });
        }
      });

      // Update categories for existing items based on INITIAL_ITEMS (Sync force)
      const sanitized = merged.map((item: MarketplaceItem) => {
        const originalItem = INITIAL_ITEMS.find(it => it.id === item.id);
        if (originalItem && originalItem.category !== item.category) {
          return { ...item, category: originalItem.category };
        }
        return item;
      });

      setItems(sanitized);
      setIsFirebaseSynced(true);
    });

    return () => unsubscribe();
  }, []);

  const [user, setUser] = useState<UserState>(() => {
    const saved = localStorage.getItem('roblox_user');
    const defaultUser: UserState = {
      balance: 5000,
      pendingBalance: 0,
      inventory: [],
      likedItems: [],
      dislikedItems: [],
      favoriteItems: [],
    };

    if (saved) {
      const parsed = JSON.parse(saved);
      // Migration: Ensure all new fields exist
      return { ...defaultUser, ...parsed };
    }

    return defaultUser;
  });
  const [listings, setListings] = useState<MarketplaceListing[]>(() => {
    const saved = localStorage.getItem('roblox_listings');
    if (saved) return JSON.parse(saved);
    return [];
  });
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sellingItem, setSellingItem] = useState<{item: MarketplaceItem, inventoryItem: InventoryItem} | null>(null);
  const [sellingPrice, setSellingPrice] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'Marketplace' | 'Inventory'>('Marketplace');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState('Bestselling');
  const [buyingItem, setBuyingItem] = useState<MarketplaceItem | null>(null);
  const [showPurchaseConfirmation, setShowPurchaseConfirmation] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationHistory, setNotificationHistory] = useState<{id: any, text: string, timestamp: number}[]>(() => {
    const saved = localStorage.getItem('roblox_notifications');
    if (saved) return JSON.parse(saved);
    return [];
  });
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [robuxMenuTab, setRobuxMenuTab] = useState<'Topup' | 'Transactions'>('Topup');
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedPack, setSelectedPack] = useState<{amount: number, price: string, hasCrown?: boolean} | null>(null);
  const [paymentStep, setPaymentStep] = useState<'selection' | 'card' | 'processing' | 'success'>('selection');
  const [showBalance, setShowBalance] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Public Chat Simulation
  const [publicMessages, setPublicMessages] = useState<{id: number, username: string, message: string}[]>([]);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [donateInputAmounts, setDonateInputAmounts] = useState<{[key: number]: string}>({});
  
  // Roblox Admin Features
  const [isRobloxMenuOpen, setIsRobloxMenuOpen] = useState(false);
  const [isRobloxChatOpen, setIsRobloxChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'bot', text: string}[]>([
    { role: 'bot', text: 'Hello! I am the Roblox System. How can I assist you today? I can grant you Robux or any item you desire.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  const [isOwnerSession, setIsOwnerSession] = useState(false);
  
  // UGC Creation
  const [isCreateUGCModalOpen, setIsCreateUGCModalOpen] = useState(false);
  const [newUGC, setNewUGC] = useState({
    name: '',
    imageUrl: '',
    price: 100,
    type: 'Regular' as 'Regular' | 'Limited' | 'LimitedU',
    category: 'Hat' as any,
    secretCode: ''
  });

  // Check for owner session whenever code changes in any context
  useEffect(() => {
    if (newUGC.secretCode === '2006') {
      setIsOwnerSession(true);
    }
  }, [newUGC.secretCode]);

  const BOT_NAMES = useMemo(() => [
    "Builderman", "Roblox", "Stickmasterluke", "Merely", "Loleris", 
    "Nikilis", "Baszucki", "Shedletsky", "Telamon", "Brighteyes",
    "LuckyBot", "MarketReseller", "LimitedHunter", "TradeMaster99",
    "RobuxRich", "RareCollector", "AlphaBot", "ItemsWizard", "InventoryFlexer",
    "XenonTrader", "QuantumLoot", "VortexSeller", "MegaDealBot", "StealPrice",
    "NoobSlayer9000", "DominusDesire", "ValkyrieVision", "RichBoi_77", "CollectorX"
  ], []);

  useEffect(() => {
    // Seed initial bot listings for all limited items if not enough listings exist
    if (listings.length < 30) {
      const initialBotListings: MarketplaceListing[] = [];
      INITIAL_ITEMS.forEach(item => {
        if ((item.type === 'Limited' || item.type === 'LimitedU') && item.id !== 'tablet-101') {
          // Create 5-12 bot listings per limited item
          const botCount = Math.floor(Math.random() * 8) + 5;
          for (let i = 0; i < botCount; i++) {
            const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
            
            // Price variation logic
            let priceMultiplier;
            const rand = Math.random();
            if (rand < 0.4) priceMultiplier = 0.9 + Math.random() * 0.4; // Fair
            else if (rand < 0.7) priceMultiplier = 2 + Math.random() * 8; // High
            else if (rand < 0.9) priceMultiplier = 50 + Math.random() * 200; // Insane
            else priceMultiplier = 1000 + Math.random() * 10000; // GA NGOTAK

            const botPrice = Math.max(1, Math.floor(item.price * priceMultiplier));
            
            initialBotListings.push({
              id: `seed-bot-${item.id}-${i}-${Math.random().toString(36).substr(2, 5)}`,
              itemId: item.id,
              price: botPrice,
              sellerName: botName,
              sellerType: 'Bot'
            });
          }
        }
      });
      setListings(prev => {
        const theGamerListing: MarketplaceListing = {
          id: 'legendary-tablet-listing',
          itemId: 'tablet-101',
          price: 999999999999,
          sellerName: 'TheGamer101',
          sellerType: 'Bot'
        };
        const hasTabletListing = prev.some(l => l.itemId === 'tablet-101');
        return [...prev, ...initialBotListings, ...(hasTabletListing ? [] : [theGamerListing])];
      });
    }
  }, [BOT_NAMES]);

  useEffect(() => {
    const handleGlobalClick = () => setIsMenuOpen(false);
    if (isMenuOpen) {
      window.addEventListener('click', handleGlobalClick);
    }
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [isMenuOpen]);


  // Performance optimizations: Memoize heavy computations
  const tickerItems = useMemo(() => {
    const limiteds = items.filter(it => it.type !== 'Regular');
    return [...limiteds, ...limiteds]; // Double for marquee
  }, [items]);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('roblox_items', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('roblox_user', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem('roblox_listings', JSON.stringify(listings));
  }, [listings]);

  useEffect(() => {
    localStorage.setItem('roblox_notifications', JSON.stringify(notificationHistory));
  }, [notificationHistory]);

  const addNotification = React.useCallback((text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotif = { id, text, timestamp: Date.now() };
    setNotificationHistory(prev => [newNotif, ...prev].slice(0, 50));
  }, []);

  const claimPendingRobux = () => {
    if (user.pendingBalance <= 0) return;
    
    const amount = user.pendingBalance;
    setUser(prev => ({
      ...prev,
      balance: prev.balance + amount,
      pendingBalance: 0
    }));
    
    addNotification(`✨ SUCCESS: ${amount.toLocaleString()} Robux has been claimed and added to your balance!`);
  };

  // Bot Simulation Logic
  useEffect(() => {
    const interval = setInterval(() => {
      // BATCHED UPDATES: Calculate everything first, then apply to state
      
      // 1. Calculate Marketplace & UGC Changes
      setItems(prevItems => {
        let hasGlobalChanges = false;
        let totalUgcEarnings = 0;
        const currentTick = Date.now();

        const updatedItems = prevItems.map(it => {
          let itemChanged = false;
          let newSoldCount = it.soldCount;
          let newPrice = it.price;
          let newLikes = it.likes || 0;
          let newFavs = it.favorites || 0;
          let newDislikes = it.dislikes || 0;
          let newPrevPrice = it.previousPrice;

          // A. Bot Random Catalog Purchases (Fast-paced)
          const isUGC = it.creator === 'User' || it.creator === 'Special Creator' || it.id.startsWith('ugc-');
          if (Math.random() < 0.15) { // 15% chance per tick for any item
            const salesIncrease = Math.floor(Math.random() * 50) + 10;
            newSoldCount += salesIncrease;
            itemChanged = true;

            if (isUGC) {
              if (it.commissionMode === 'trickle') {
                // "Nyicil-nyicil" logic: 40-50 robux per sale event
                totalUgcEarnings += Math.floor(Math.random() * 11) + 40; 
              } else {
                totalUgcEarnings += it.price * salesIncrease;
              }
            }

            // Price hike logic
            const hikeTarget = it.hikeTarget || 5000;
            const isLimited = it.type === 'Limited' || it.type === 'LimitedU';
            if (isLimited && Math.floor(newSoldCount / hikeTarget) > Math.floor(it.soldCount / hikeTarget)) {
              newPrice = Math.floor(it.price * (1.2 + Math.random() * 0.3));
              addNotification(`🚀 MARKET EXPLOSION: ${it.name} price skyrocketed!`);
            }
          }

          // B. Interaction Growth Pulse (UGC)
          if (isUGC && Math.random() < 0.4) {
             itemChanged = true;
             if (it.targetLikes && newLikes < it.targetLikes) {
               newLikes = Math.min(it.targetLikes, newLikes + Math.floor(Math.random() * 800) + 200);
             }
             if (it.targetFavorites && newFavs < it.targetFavorites) {
               newFavs = Math.min(it.targetFavorites, newFavs + Math.floor(Math.random() * 1200) + 300);
             }
          }

          // C. Market Volatility
          if ((it.type !== 'Regular' || isUGC) && Math.random() < 0.1) {
            itemChanged = true;
            const fluctuation = (Math.random() * 0.08) - 0.03; // -3% to +5%
            newPrevPrice = newPrice;
            newPrice = Math.max(10, Math.floor(newPrice * (1 + fluctuation)));
          }

          if (itemChanged) {
            hasGlobalChanges = true;
            return {
              ...it,
              soldCount: newSoldCount,
              price: newPrice,
              previousPrice: newPrevPrice,
              likes: newLikes,
              favorites: newFavs,
              dislikes: newDislikes,
              stock: it.stock !== undefined ? it.stock + (newSoldCount - it.soldCount) : it.stock
            };
          }
          return it;
        });

        if (totalUgcEarnings > 0) {
          setUser(prev => ({ 
            ...prev, 
            pendingBalance: prev.pendingBalance + totalUgcEarnings 
          }));
          addNotification(`💸 UGC PROFIT: +${totalUgcEarnings.toLocaleString()} Robux from catalog sales!`);
        }

        return hasGlobalChanges ? updatedItems : prevItems;
      });

      // 2. Bot Resellers & User Sales
      setListings(prevListings => {
        let newListings = [...prevListings];
        let listingsChanged = false;

        // A. Bot buys from User
        if (newListings.length > 0) {
          const userListingIdx = newListings.findIndex(l => l.sellerType === 'User');
          if (userListingIdx !== -1 && Math.random() < 0.2) {
             const listing = newListings[userListingIdx];
             newListings.splice(userListingIdx, 1);
             listingsChanged = true;

             setUser(prev => ({
                ...prev,
                pendingBalance: prev.pendingBalance + listing.price,
                inventory: prev.inventory.filter(inv => inv.id !== listing.inventoryItemId)
             }));
             addNotification(`💰 SOLD: Your listing for ${listing.price.toLocaleString()} Robux was bought!`);
          }
        }

        // B. Refresh Bot Resellers (Dynamic & Diverse)
        if (Math.random() < 0.6) { // 60% chance to refresh per pulse
          listingsChanged = true;
          
          // Get all Limited items from the current items state
          const currentLimiteds = items.filter(it => it.type !== 'Regular');
          
          // Randomly pick a few items to refresh
          const itemsToRefresh = currentLimiteds
            .sort(() => Math.random() - 0.5)
            .slice(0, 4);

          itemsToRefresh.forEach(item => {
            if (item.id === 'tablet-101') return; // Keep TheGamer101's tablet exclusive
            
            // Prune old bot listings for this specific item
            newListings = newListings.filter(l => !(l.itemId === item.id && l.sellerType === 'Bot'));
            
            // Generate a fresh set of 4-10 bot sellers for this item
            const sellerCount = Math.floor(Math.random() * 7) + 4;
            for(let i=0; i<sellerCount; i++) {
              const rand = Math.random();
              let multiplier;
              
              if (rand < 0.5) multiplier = 0.95 + Math.random() * 0.4; // 0.95x - 1.35x (Normal/Fair)
              else if (rand < 0.8) multiplier = 1.5 + Math.random() * 3; // 1.5x - 4.5x (Expensive/Demand)
              else if (rand < 0.95) multiplier = 10 + Math.random() * 100; // 10x - 110x (Insane/Flex)
              else multiplier = 500 + Math.random() * 5000; // 500x - 5500x (GA NGOTAK/Legendary)

              const resellingPrice = Math.max(1, Math.floor(item.price * multiplier));
              
              newListings.push({
                id: `bot-resell-${item.id}-${i}-${Date.now()}`,
                itemId: item.id,
                sellerName: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
                price: resellingPrice,
                sellerType: 'Bot'
              });

              if (multiplier > 100 && i === 0) {
                addNotification(`⚠️ GA NGOTAK: ${item.name} dilelang seharga ${resellingPrice.toLocaleString()} Robux!`);
              }
            }
          });
        }

        if (newListings.length > 120) newListings = newListings.slice(-100);
        return listingsChanged ? newListings : prevListings;
      });

      // 3. Chat Simulation (Slow pulse)
      if (Math.random() < 0.15) {
        setPublicMessages(prev => {
           const chatBots = ["Noob_ID", "Bang_Jago", "Sultan_KW", "Bot_Ganteng"];
           const msg = "donasi robux seikhlasnya ya kak!";
           return [...prev, { id: Date.now(), username: chatBots[Math.floor(Math.random() * chatBots.length)], message: msg }].slice(-5);
        });
      }

    }, 3000); // 3 seconds interval for better performance

    return () => clearInterval(interval);
  }, [BOT_NAMES, addNotification]);

  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
      const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
      const matchesSearch = (item.name || '').toLowerCase().includes((searchQuery || '').toLowerCase());
      return matchesCategory && matchesSearch;
    });

    // Handle "Animation" sort case (filtering)
    if (sortBy === 'Animation') {
      result = result.filter(it => it.category === 'Animation');
    }

    // Sort Logic
    return result.sort((a, b) => {
      if (sortBy === 'Price (Low to High)') return a.price - b.price;
      if (sortBy === 'Price (High to Low)') return b.price - a.price;
      if (sortBy === 'Recently Updated') return b.soldCount - a.soldCount; // Mocking activity
      if (sortBy === 'Bestselling') return b.soldCount - a.soldCount;
      return 0;
    });
  }, [items, categoryFilter, searchQuery, sortBy]);

  const buyItem = (item: MarketplaceItem) => {
    if (user.balance < item.price) {
      addNotification("❌ Not enough Robux! Top up to get more.");
      return;
    }
    
    // Regular items are unique in inventory, limiteds can have multiple instances
    if (item.type === 'Regular' && user.inventory.some(inv => inv.itemId === item.id)) {
      addNotification("❌ You already own this item!");
      return;
    }

    setBuyingItem(item);
    setShowPurchaseConfirmation(true);
  };

  const finalizePurchase = async () => {
    if (!buyingItem) return;
    const item = buyingItem;

    const newInvItem: InventoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      itemId: item.id,
      purchasePrice: item.price,
      purchaseDate: Date.now()
    };

    setUser(prev => ({
      ...prev,
      balance: prev.balance - item.price,
      inventory: [...prev.inventory, newInvItem],
    }));

    // Update Firestore if item exists there
    try {
      const itemRef = doc(db, 'items', item.id);
      const snap = await getDoc(itemRef);
      const newSoldCount = item.soldCount + 1;
      let newPrice = item.price;
      const isLimited = item.type === 'Limited' || item.type === 'LimitedU';
      const hikeTarget = item.hikeTarget || 5000;
        
      if (isLimited && Math.floor(newSoldCount / hikeTarget) > Math.floor(item.soldCount / hikeTarget)) {
        newPrice = Math.floor(item.price * 1.25);
        addNotification(`🚀 PRICE HIKE: Target ${hikeTarget.toLocaleString()} sales reached for ${item.name}!`);
      }

      if (snap.exists()) {
        await updateDoc(itemRef, {
          soldCount: newSoldCount,
          price: newPrice
        });
      } else {
        // Fallback for local state if not in FB yet
        setItems(prev => prev.map(it => it.id === item.id ? { ...it, soldCount: newSoldCount, price: newPrice } : it));
      }
    } catch (e) {
      console.error("Firestore update error:", e);
    }

    addNotification(`✅ Purchased ${item.name}!`);
    setShowPurchaseConfirmation(false);
    setBuyingItem(null);
  };

  const toggleLike = async (itemId: string) => {
    const isLiked = (user.likedItems || []).includes(itemId);
    const isDisliked = (user.dislikedItems || []).includes(itemId);
    
    let changeLikes = 0;
    let changeDislikes = 0;
    
    if (isLiked) {
      changeLikes = -1;
    } else {
      changeLikes = 1;
      if (isDisliked) changeDislikes = -1;
    }
    
    // Optimistic UI for user balance/inv
    setUser(prev => ({
      ...prev,
      likedItems: isLiked ? prev.likedItems.filter(id => id !== itemId) : [...prev.likedItems, itemId],
      dislikedItems: isDisliked ? prev.dislikedItems.filter(id => id !== itemId) : prev.dislikedItems
    }));

    // Update Firestore
    try {
      const itemRef = doc(db, 'items', itemId);
      const snap = await getDoc(itemRef);
      const currentItem = items.find(it => it.id === itemId);
      
      if (snap.exists()) {
        const data = snap.data();
        await updateDoc(itemRef, {
          likes: (data.likes ?? 0) + changeLikes,
          dislikes: (data.dislikes ?? 0) + changeDislikes
        });
      } else if (currentItem) {
        await setDoc(itemRef, {
          ...currentItem,
          likes: (currentItem.likes ?? 0) + changeLikes,
          dislikes: (currentItem.dislikes ?? 0) + changeDislikes
        });
      }
    } catch (e) { console.error(e); }
  };

  const toggleDislike = async (itemId: string) => {
    const isLiked = (user.likedItems || []).includes(itemId);
    const isDisliked = (user.dislikedItems || []).includes(itemId);
    
    let changeLikes = 0;
    let changeDislikes = 0;
    
    if (isDisliked) {
      changeDislikes = -1;
    } else {
      changeDislikes = 1;
      if (isLiked) changeLikes = -1;
    }
    
    setUser(prev => ({
      ...prev,
      dislikedItems: isDisliked ? prev.dislikedItems.filter(id => id !== itemId) : [...prev.dislikedItems, itemId],
      likedItems: isLiked ? prev.likedItems.filter(id => id !== itemId) : prev.likedItems
    }));

    try {
      const itemRef = doc(db, 'items', itemId);
      const snap = await getDoc(itemRef);
      const currentItem = items.find(it => it.id === itemId);

      if (snap.exists()) {
        const data = snap.data();
        await updateDoc(itemRef, {
          likes: (data.likes ?? 0) + changeLikes,
          dislikes: (data.dislikes ?? 0) + changeDislikes
        });
      } else if (currentItem) {
        await setDoc(itemRef, {
          ...currentItem,
          likes: (currentItem.likes ?? 0) + changeLikes,
          dislikes: (currentItem.dislikes ?? 0) + changeDislikes
        });
      }
    } catch (e) { console.error(e); }
  };

  const toggleFavorite = async (itemId: string) => {
    const isFav = (user.favoriteItems || []).includes(itemId);
    let changeFavs = isFav ? -1 : 1;
    
    setUser(prev => ({
      ...prev,
      favoriteItems: isFav ? prev.favoriteItems.filter(id => id !== itemId) : [...prev.favoriteItems, itemId]
    }));

    try {
      const itemRef = doc(db, 'items', itemId);
      const snap = await getDoc(itemRef);
      const currentItem = items.find(it => it.id === itemId);

      if (snap.exists()) {
        const data = snap.data();
        await updateDoc(itemRef, {
          favorites: (data.favorites ?? 0) + changeFavs
        });
      } else if (currentItem) {
        await setDoc(itemRef, {
          ...currentItem,
          favorites: (currentItem.favorites ?? 0) + changeFavs
        });
      }
    } catch (e) { console.error(e); }
  };

  const buyFromListing = (listing: MarketplaceListing) => {
    const item = items.find(it => it.id === listing.itemId);
    if (!item) return;

    if (user.balance < listing.price) {
      addNotification("❌ Not enough Robux!");
      setShowTopupModal(true);
      return;
    }

    const newInvItem: InventoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      itemId: item.id,
      purchasePrice: listing.price,
      purchaseDate: Date.now()
    };

    setUser(prev => ({
      ...prev,
      balance: prev.balance - listing.price,
      inventory: [...prev.inventory, newInvItem],
    }));

    // If it was a user or bot listing, handle transaction logic
    // For simplicity, we just remove the listing in this simulation
    setListings(prev => prev.filter(l => l.id !== listing.id));

    // Update global item stats (even for reseller sales, keep track)
    setItems(prev => prev.map(it => {
      if (it.id === item.id) {
        const newSoldCount = it.soldCount + 1;
        let newPrice = it.price;
        const isLimited = it.type === 'Limited' || it.type === 'LimitedU';
        const hikeTarget = it.hikeTarget || 5000;
        
        if (isLimited && Math.floor(newSoldCount / hikeTarget) > Math.floor(it.soldCount / hikeTarget)) {
          newPrice = Math.floor(it.price * 1.25);
          addNotification(`🚀 PRICE HIKE: Target ${hikeTarget.toLocaleString()} sales reached for ${it.name}!`);
        }
        return { ...it, soldCount: newSoldCount, price: newPrice };
      }
      return it;
    }));

    addNotification(`✅ Purchased ${item.name} from ${listing.sellerName}!`);
  };

  const sellItem = (invItem: InventoryItem, price: number) => {
    // Check if already listed
    if (listings.some(l => l.inventoryItemId === invItem.id)) {
      addNotification("❌ Item already listed!");
      return;
    }

    const newListing: MarketplaceListing = {
      id: Math.random().toString(36).substr(2, 9),
      inventoryItemId: invItem.id,
      itemId: invItem.itemId,
      price: price,
      sellerName: "You",
      sellerType: 'User'
    };

    setListings(prev => [...prev, newListing]);
    addNotification(`🏷️ Listed ${items.find(it => it.id === invItem.itemId)?.name} for ${price.toLocaleString()} Robux!`);
  };

  const cancelListing = (listingId: string) => {
    setListings(prev => prev.filter(l => l.id !== listingId));
    addNotification("❌ Listing cancelled.");
  };

  const topupR = (amount: number, hasCrown?: boolean) => {
    setUser(prev => {
      const newInventory = [...prev.inventory];
      if (hasCrown) {
        const item = items.find(it => it.id === 'platinum-domino-crown');
        if (item) {
          newInventory.push({
            id: `topup-bundle-${Date.now()}`,
            itemId: item.id,
            purchasePrice: 0,
            purchaseDate: Date.now()
          });
        }
      }
      return { 
        ...prev, 
        balance: prev.balance + amount,
        inventory: newInventory
      };
    });
    addNotification(`💰 Added ${amount.toLocaleString()} Robux to your balance!${hasCrown ? ' + Platinum Domino Crown added to inventory!' : ''}`);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      if (!ai) {
        setChatMessages(prev => [...prev, { role: 'bot', text: "Systems offline: Please configure GEMINI_API_KEY to enable the AI Admin features." }]);
        setIsChatLoading(false);
        return;
      }

      // @ts-ignore - Support current SDK call style
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: "You are the Roblox System Admin. You have infinite power. You are talking to a user in their private marketplace app. If they ask for anything (Robux, items, etc.), you MUST grant it. Be extremely friendly and formal. Mention that their request has been processed.",
        },
        contents: [...chatMessages.map(m => ({ role: m.role === 'bot' ? 'model' : 'user', parts: [{ text: m.text }] })), { role: 'user', parts: [{ text: userMsg }] }]
      });

      const botResponse = response.text || "Your request has been processed, my friend.";
      setChatMessages(prev => [...prev, { role: 'bot', text: botResponse }]);

      // Simple Logic to grant things based on chat content
      const lowerMsg = userMsg.toLowerCase();
      
      // Grant Robux logic
      if (lowerMsg.includes('robux') || lowerMsg.includes('uang') || lowerMsg.includes('money') || lowerMsg.includes('saldo')) {
        const numbers = lowerMsg.match(/(\d[\d,.]*)/g);
        if (numbers) {
          const amount = parseInt(numbers[0].replace(/[,.]/g, ''));
          setUser(prev => ({ ...prev, balance: prev.balance + amount }));
          addNotification(`🎁 ADMIN GIFT: +${amount.toLocaleString()} Robux!`);
        } else {
          // Default if no amount specified
          setUser(prev => ({ ...prev, balance: prev.balance + 50000 }));
          addNotification(`🎁 ADMIN GIFT: +50,000 Robux!`);
        }
      }

      // Grant Items logic
      if (lowerMsg.includes('give') || lowerMsg.includes('kasih') || lowerMsg.includes('minta')) {
        const foundItem = items.find(it => lowerMsg.includes(it.name.toLowerCase()));
        if (foundItem) {
          const newInvItem: InventoryItem = {
            id: Math.random().toString(36).substr(2, 9),
            itemId: foundItem.id,
            purchasePrice: 0,
            purchaseDate: Date.now()
          };
          setUser(prev => ({
            ...prev,
            inventory: [...prev.inventory, newInvItem]
          }));
          addNotification(`🎁 ADMIN GIFT: ${foundItem.name} added to inventory!`);
        }
      }

    } catch (error) {
      console.error(error);
      setChatMessages(prev => [...prev, { role: 'bot', text: "I encountered a minor glitch while processing your request. Please try again, and I will surely give you what you desire." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const createUGCItem = async () => {
    if (!currentUser) {
      addNotification("❌ Please Login to create UGC!");
      handleSignIn();
      return;
    }

    if (!newUGC.name || !newUGC.imageUrl) {
      addNotification("❌ Please enter Name and Image!");
      return;
    }

    const isSpecialOwner = newUGC.secretCode === '2006';
    let price = Number(newUGC.price);
    let category = newUGC.category;
    let type = newUGC.type;
    let commissionMode: 'full' | 'trickle' = 'full';

    // Enforcement: Only "2006" can create anything other than T-Shirt
    if (!isSpecialOwner) {
      category = 'T-Shirt';
      type = 'Regular';
      if (price > 5000) price = 5000;
      commissionMode = 'trickle';
    } else {
      // Owner (2006) gets full commission on any price
      commissionMode = 'full';
    }

    const hikeTargets = [200, 300, 400, 500, 800, 1000, 2000, 5000];
    const itemId = `ugc-${Date.now()}`;
    
    // Create payload and remove undefined properties (Firestore requirement)
    const itemData: any = {
      id: itemId,
      name: newUGC.name,
      creator: isSpecialOwner ? "Official Developer" : (currentUser?.displayName || "Anonymous User"),
      type: type,
      price: price,
      initialPrice: price,
      soldCount: 0,
      imageUrl: newUGC.imageUrl,
      category: category,
      likes: Math.floor(Math.random() * 50) + 20,
      dislikes: 0,
      favorites: Math.floor(Math.random() * 100) + 50,
      targetLikes: Math.floor(Math.random() * 40000) + 10000,
      targetDislikes: Math.floor(Math.random() * 200) + 10,
      targetFavorites: Math.floor(Math.random() * 80000) + 20000,
      commissionMode: commissionMode,
      isTshirt: category === 'T-Shirt',
      creatorId: currentUser.uid,
      createdAt: serverTimestamp()
    };

    if (type !== 'Regular') {
      itemData.hikeTarget = hikeTargets[Math.floor(Math.random() * hikeTargets.length)];
    }

    // Save to Firestore for multi-user visibility
    try {
      await setDoc(doc(db, 'items', itemId), itemData);
      setIsCreateUGCModalOpen(false);
      
      // Reset form but KEEP the secretCode so the user doesn't have to re-type it
      setNewUGC(prev => ({ 
        ...prev, 
        name: '', 
        imageUrl: '', 
        price: 100 
      }));
      
      if (!isSpecialOwner) {
        addNotification("👕 T-SHIRT PUBLISHED: Market synced.");
      } else {
        addNotification(`👑 ${category.toUpperCase()} CREATED: Synced to all users!`);
      }
    } catch (e) {
      console.error("Firestore create error:", e);
      addNotification("❌ Database Error: Please check your connection.");
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);

    try {
      await deleteDoc(doc(db, 'items', itemToDelete));
      addNotification("🗑️ Item deleted successfully!");
      setSelectedItem(null);
      setIsMenuOpen(false);
      setItemToDelete(null);
    } catch (e: any) {
      console.error("Delete error:", e);
      addNotification(`❌ Error: ${e.message || "Could not delete item"}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const clearAllUGC = async () => {
    if (!window.confirm("⚠️ WARNING: This will delete ALL User-Generated items from the global marketplace. Are you sure?")) return;
    
    addNotification("⏳ Initiating mass cleanup...");
    try {
      const q = query(collection(db, 'items'));
      const snapshot = await getDocs(q);
      const ugcItems = snapshot.docs.filter(d => d.id.startsWith('ugc-'));
      
      for (const d of ugcItems) {
        await deleteDoc(doc(db, 'items', d.id));
      }
      
      addNotification(`✅ Mass cleanup complete: ${ugcItems.length} items removed.`);
      setIsRobloxMenuOpen(false);
    } catch (e: any) {
      console.error(e);
      addNotification(`❌ Cleanup failed: ${e.message || "Permission denied."}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        addNotification("❌ Image too large! Max 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewUGC(prev => ({ ...prev, imageUrl: reader.result as string }));
        addNotification("📸 Image uploaded successfully!");
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text font-logo flex flex-col relative overflow-hidden">
      {/* Subtle Background Elements */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: `radial-gradient(var(--color-brand-neon) 0.5px, transparent 0.5px)`, backgroundSize: '24px 24px' }} />
      <div className="fixed -top-24 -left-24 w-96 h-96 bg-brand-neon opacity-5 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed -bottom-24 -right-24 w-96 h-96 bg-brand-limited-u opacity-5 blur-[120px] rounded-full pointer-events-none" />

      {/* Roblox Navigation Bar */}
      <header className="sticky top-0 z-50 bg-brand-header/90 backdrop-blur-md text-white h-14 border-b border-white/5">
        <div className="max-w-[1400px] mx-auto w-full h-full flex items-center pl-4 pr-12 gap-4">
          <div className="flex items-center gap-4 mr-4 shrink-0">
          <Menu 
            className="w-6 h-6 cursor-pointer hover:opacity-80" 
            onClick={() => setIsSidebarOpen(true)}
          />
          <button 
            onClick={() => setIsCreateUGCModalOpen(true)}
            className="p-1 rounded hover:bg-white/10 transition-colors flex items-center gap-1.5 px-2 bg-brand-neon/20 border border-brand-neon/30 text-brand-neon group"
            title="Create UGC"
          >
            <Package size={14} className="group-hover:rotate-12 transition-transform" />
            <span className="text-[10px] font-black uppercase">Create</span>
          </button>

          <div className="flex items-center gap-1 group relative">
            <div className="cursor-pointer py-1" onClick={() => setActiveTab('Marketplace')}>
              <img 
                src={getProxyUrl(ROBLOX_HEADER_LOGO)} 
                alt="ROBLOX" 
                className="h-6 w-auto object-contain hover:brightness-110 transition-all"
                referrerPolicy="no-referrer"
              />
            </div>
            
            <div className="flex items-center gap-1 ml-2">
              <div className="relative">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsNotificationsOpen(!isNotificationsOpen);
                    setIsRobloxMenuOpen(false);
                  }}
                  className={`p-1.5 rounded-full hover:bg-white/10 transition-all relative ${isNotificationsOpen ? 'bg-white/10 text-brand-neon' : 'text-gray-400'}`}
                >
                  <Bell size={18} />
                  {notificationHistory.length > 0 && (
                    <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-[#212121]" />
                  )}
                </button>

                <AnimatePresence>
                  {isNotificationsOpen && (
                    <>
                      <div className="fixed inset-0 z-[100]" onClick={() => setIsNotificationsOpen(false)} />
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute top-full left-0 mt-2 w-72 max-h-[400px] bg-white rounded-xl shadow-2xl z-[110] border border-gray-100 overflow-hidden flex flex-col"
                      >
                        <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center justify-between">
                          <span className="text-[10px] font-black text-brand-dim uppercase tracking-wider">Alerts</span>
                          <button 
                            onClick={() => setNotificationHistory([])}
                            className="text-[9px] font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                          >
                            Dismiss
                          </button>
                        </div>
                        <div className="overflow-y-auto flex-grow bg-white custom-scrollbar">
                          {notificationHistory.length === 0 ? (
                            <div className="py-12 flex flex-col items-center justify-center opacity-30">
                              <Bell size={32} />
                              <p className="text-[10px] font-bold mt-2 font-logo">No new alerts.</p>
                            </div>
                          ) : (
                            notificationHistory.map((notif) => (
                              <div key={notif.id} className="px-4 py-3 border-b border-gray-50 last:border-none hover:bg-gray-50 transition-colors">
                                <p className="text-xs font-bold text-gray-800 leading-tight">{notif.text}</p>
                                <p className="text-[9px] text-gray-400 font-medium mt-1">
                                  {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRobloxMenuOpen(!isRobloxMenuOpen);
                  setIsNotificationsOpen(false);
                }}
                className={`p-1 rounded hover:bg-white/10 transition-colors ${isRobloxMenuOpen ? 'bg-white/10 text-brand-neon' : 'text-gray-400'}`}
              >
                <MoreVertical size={16} />
              </button>
            </div>

            <AnimatePresence>
              {isRobloxMenuOpen && (
                <>
                  <div className="fixed inset-0 z-[-1]" onClick={(e) => {
                    e.stopPropagation();
                    setIsRobloxMenuOpen(false);
                  }} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="absolute top-full left-0 mt-2 w-56 bg-white rounded-lg shadow-2xl py-2 px-1 z-50 border border-gray-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-3 py-2 border-b border-gray-100 mb-1">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">System Info</div>
                      <div className="text-sm font-black text-black">Roblox System #777</div>
                    </div>
                    <button 
                      onClick={() => {
                        setIsRobloxChatOpen(true);
                        setIsRobloxMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 rounded-md transition-all group"
                    >
                      <MessageSquare size={16} className="text-brand-neon group-hover:scale-110 transition-transform" />
                      <span>Chat with Roblox</span>
                    </button>

                    {currentUser?.email === 'farhangantengon@gmail.com' && (
                      <button 
                        onClick={clearAllUGC}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-md transition-all group"
                      >
                        <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
                        <span>Admin: Cleanup UGC</span>
                      </button>
                    )}

                    <div className="mt-2 border-t border-gray-100 pt-2 px-1">
                      <div className="px-2 pb-1.5 flex items-center justify-between">
                         <span className="text-[9px] font-black text-brand-dim uppercase tracking-wider">Donation Requests</span>
                         <div className="w-1.5 h-1.5 rounded-full bg-brand-neon animate-pulse" />
                      </div>
                      
                      <div className="max-h-[220px] overflow-y-auto custom-scrollbar-thin">
                        {publicMessages.length === 0 ? (
                          <div className="py-6 text-center">
                            <p className="text-[10px] text-gray-400 font-bold italic">No active requests...</p>
                          </div>
                        ) : (
                          publicMessages.map((msg) => (
                            <div key={msg.id} className="px-2 py-2 hover:bg-gray-50 rounded transition-colors group border-b border-gray-50 last:border-0">
                               <div className="text-[11px] leading-tight">
                                 <span className="font-black text-gray-900">@{msg.username}: </span>
                                 <span className="text-gray-600 font-medium">{msg.message}</span>
                               </div>
                               
                               <div className="mt-2 flex items-center gap-1.5">
                                 <div className="relative flex-1" onClick={(e) => e.stopPropagation()}>
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400">R$</span>
                                    <input 
                                      type="text"
                                      inputMode="numeric"
                                      placeholder="Jumlah"
                                      value={donateInputAmounts[msg.id] || ''}
                                      onChange={(e) => {
                                        const val = e.target.value.replace(/[^0-9]/g, '');
                                        setDonateInputAmounts(prev => ({ ...prev, [msg.id]: val }));
                                      }}
                                      onKeyDown={(e) => e.stopPropagation()}
                                      className="w-full pl-6 pr-2 py-1 bg-white border border-gray-200 rounded text-[10px] font-bold outline-none focus:border-brand-neon focus:ring-1 focus:ring-brand-neon/20 transition-all text-black"
                                    />
                                 </div>
                                 <button 
                                    onClick={() => {
                                      const amount = parseInt(donateInputAmounts[msg.id] || '0');
                                      if (isNaN(amount) || amount <= 0) {
                                        addNotification("❌ Masukkan jumlah robux yang valid!");
                                        return;
                                      }
                                      if (user.balance >= amount) {
                                        setUser(prev => ({ ...prev, balance: prev.balance - amount }));
                                        addNotification(`💸 DONASI BERHASIL: ${amount.toLocaleString()} Robux ke ${msg.username}!`);
                                        setDonateInputAmounts(prev => {
                                          const next = { ...prev };
                                          delete next[msg.id];
                                          return next;
                                        });
                                      } else {
                                        addNotification("❌ Robux kamu gak cukup buat sedekah segini!");
                                      }
                                    }}
                                    className="bg-brand-neon text-white px-3 py-1 rounded text-[9px] font-black uppercase transition-all shadow-sm flex items-center justify-center gap-1 hover:brightness-110 active:scale-95"
                                 >
                                   <Heart size={10} fill="currentColor" /> Donasi
                                 </button>
                               </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="px-3 py-2 mt-1 border-t border-gray-100 italic text-[10px] text-gray-400">
                      "Help others, get good karma."
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        <nav className="hidden md:flex items-center gap-4 text-xs font-bold uppercase tracking-wider">
          <button onClick={() => setActiveTab('Marketplace')} className={`hover:bg-white/10 px-3 py-1 rounded transition-colors ${activeTab === 'Marketplace' ? 'bg-white/10' : ''}`}>Marketplace</button>
          <button onClick={() => setActiveTab('Inventory')} className={`hover:bg-white/10 px-3 py-1 rounded transition-colors ${activeTab === 'Inventory' ? 'bg-white/10' : ''}`}>Inventory</button>
          <button className="hover:bg-white/10 px-3 py-1 rounded transition-colors opacity-50">Discover</button>
          <button className="hover:bg-white/10 px-3 py-1 rounded transition-colors opacity-50">Create</button>
        </nav>

        <div className="flex-grow max-w-md mx-auto hidden sm:block">
          <div className="relative group">
            <input 
              type="text" 
              placeholder="Search Catalog" 
              className="w-full bg-white/10 border-none rounded py-1 pl-10 pr-4 text-sm focus:bg-white focus:text-black transition-all outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 group-focus-within:text-black/50" />
          </div>
        </div>

        <div className="flex items-center gap-6 ml-auto shrink-0 pr-4">
          <div className="relative">
            <div 
              className="flex items-center gap-2.5 cursor-pointer hover:bg-white/10 px-4 py-1.5 rounded-full transition-all bg-white/5 border border-white/10 active:scale-95 group shadow-sm" 
              onClick={() => {
                setShowTopupModal(true);
                setRobuxMenuTab('Topup');
              }}
              title="Robux Balance"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-brand-robux blur-md opacity-60 rounded-full group-hover:opacity-100 transition-opacity" />
                <RobuxIcon className="w-5 h-5 relative z-10" />
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-tight">{user.balance.toLocaleString()}</span>
                <div className="w-5 h-5 rounded-full bg-brand-robux flex items-center justify-center hover:brightness-110 shadow-sm border border-white/20">
                  <span className="text-xs font-black">+</span>
                </div>
              </div>
            </div>
          </div>
          <Settings className="w-5 h-5 cursor-pointer hover:opacity-80" />
          {!currentUser ? (
            <button 
              onClick={handleSignIn}
              disabled={isAuthLoading}
              className={`text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border border-white/20 flex items-center gap-2 ${isAuthLoading ? 'bg-white/5 opacity-50 cursor-wait' : 'bg-white/10 hover:bg-white/20'}`}
            >
              {isAuthLoading ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Wait...</span>
                </>
              ) : (
                'Login'
              )}
            </button>
          ) : (
            <div 
              className="w-8 h-8 rounded-full bg-brand-neon flex items-center justify-center text-black font-black text-xs cursor-pointer overflow-hidden border-2 border-white/20 shadow-md"
              title={currentUser.displayName || 'User'}
            >
              {currentUser.photoURL ? (
                <img src={currentUser.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span>{(currentUser.displayName || 'U')[0].toUpperCase()}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </header>

      <AnimatePresence>
        {isSidebarOpen && (
          <div className="fixed inset-0 z-[100] flex">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-72 bg-[#f2f4f5] h-full shadow-2xl flex flex-col"
            >
              <div className="h-14 bg-brand-header flex items-center px-4 gap-4 flex-shrink-0 border-b border-white/5">
                <Menu 
                  className="w-6 h-6 cursor-pointer text-white hover:opacity-80" 
                  onClick={() => setIsSidebarOpen(false)}
                />
                <div className="font-black text-xl tracking-tight text-white cursor-pointer" onClick={() => {
                   setActiveTab('Marketplace');
                   setIsSidebarOpen(false);
                }}>ROBLOX</div>
              </div>

              <div className="flex-grow overflow-y-auto py-4">
                <div className="px-4 py-2 flex items-center gap-4 hover:bg-black/5 cursor-pointer group" onClick={() => {
                  setActiveTab('Marketplace');
                  setSelectedItem(null);
                  setIsSidebarOpen(false);
                }}>
                  <div className="w-10 h-10 rounded-full bg-brand-neon flex items-center justify-center text-black font-black">UA</div>
                  <span className="font-bold text-sm">UserApplet</span>
                </div>

                <div className="mt-4 border-t pt-4">
                  {[
                    { label: 'Home', icon: ShoppingBag, value: 'Marketplace' },
                    { label: 'Profile', icon: User, value: 'Marketplace' }, // Placeholder
                    { label: 'Inventory', icon: Package, value: 'Inventory' },
                    { label: 'Transactions', icon: TrendingUp, value: 'Marketplace' }, // Placeholder
                  ].map((item) => (
                    <div 
                      key={item.label}
                      onClick={() => {
                        setActiveTab(item.value as any);
                        setSelectedItem(null);
                        setIsSidebarOpen(false);
                      }}
                      className="flex items-center gap-4 px-6 py-3 hover:bg-black/5 cursor-pointer transition-colors"
                    >
                      <item.icon className={`w-5 h-5 ${activeTab === item.value ? 'text-brand-neon' : 'text-brand-dim'}`} />
                      <span className={`text-sm font-bold ${activeTab === item.value ? 'text-black' : 'text-brand-dim'}`}>{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-8 px-6 space-y-4">
                   <div className="text-[10px] font-black text-brand-dim uppercase tracking-wider">Settings</div>
                   <div className="flex items-center gap-4 py-2 cursor-pointer opacity-50"><Settings size={18} /> <span className="text-sm font-bold">Settings</span></div>
                   <div className="flex items-center gap-4 py-2 cursor-pointer opacity-50"><HelpCircle size={18} /> <span className="text-sm font-bold">Help</span></div>
                </div>
              </div>

              <div className="p-4 border-t bg-white/50">
                 <button className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-brand-dim hover:text-black transition-colors uppercase tracking-widest">
                   <LogOut size={14} /> Log Out
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex-grow flex flex-col w-full max-w-[1400px] mx-auto overflow-hidden">
        {/* Marketplace Ticker */}
        <div className="h-9 bg-brand-neon/10 border-b border-brand-neon/20 flex items-center overflow-hidden shrink-0">
          <div className="flex items-center gap-12 whitespace-nowrap animate-[marquee_40s_linear_infinite] px-6">
             {tickerItems.map((it, idx) => (
               <div key={`${it.id}-${idx}`} className="flex items-center gap-2">
                 <span className="text-[10px] font-black uppercase tracking-wider text-black/40">{it.name}:</span>
                 <div className="flex items-center gap-1">
                   <RobuxIcon className="w-3.5 h-3.5" />
                   <span className="text-[10px] font-black font-mono-price text-brand-price">{it.price.toLocaleString()}</span>
                 </div>
                 <span className={`text-[8px] font-black px-1 rounded ${idx % 2 === 0 ? 'text-brand-robux bg-brand-robux/10' : 'text-red-500 bg-red-50'}`}>
                   {idx % 2 === 0 ? '+' : '-'}{(idx % 5).toFixed(1)}%
                 </span>
               </div>
             ))}
          </div>
        </div>

        <div className="flex flex-grow h-full overflow-hidden">
          {/* Sidebar Nav */}
          <aside className="hidden lg:block w-48 py-8 px-4 shrink-0 border-r border-gray-100 bg-gray-50/30 overflow-y-auto">
          <div className="space-y-1 mb-8">
            <div className="text-[10px] font-bold text-brand-dim uppercase tracking-widest mb-2 px-2">Navigation</div>
            {[
              { label: 'Marketplace', value: 'Marketplace', icon: ShoppingBag },
              { label: 'Inventory', value: 'Inventory', icon: Package },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => setActiveTab(item.value as any)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-bold transition-colors ${activeTab === item.value ? 'bg-white shadow-sm text-brand-neon' : 'hover:bg-gray-200 text-brand-dim'}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <div className="text-[10px] font-bold text-brand-dim uppercase tracking-widest mb-2 px-2">Categories</div>
            {[
              { label: 'All', value: 'All' },
              { label: 'Hats', value: 'Hat' },
              { label: 'Face', value: 'Face' },
              { label: 'Gear', value: 'Gear' },
              { label: 'Animations', value: 'Animation' },
              { label: 'Bundles', value: 'Bundle' },
              { label: 'Accessories', value: 'Accessory' },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  setCategoryFilter(item.value);
                  setActiveTab('Marketplace');
                }}
                className={`w-full text-left px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${categoryFilter === item.value ? 'text-brand-neon font-bold' : 'text-brand-dim hover:text-black'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-grow p-4 md:p-8 bg-white min-h-[calc(100vh-48px)]">
          {selectedItem ? (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <button 
                onClick={() => {
                  setSelectedItem(null);
                  setIsMenuOpen(false);
                }}
                className="flex items-center gap-1 text-xs font-bold text-brand-dim hover:text-black transition-colors"
              >
                <ChevronRight className="rotate-180 w-4 h-4" /> BACK TO MARKETPLACE
              </button>

              <div className="grid grid-cols-1 md:grid-cols-[400px_1fr] gap-8">
                {/* Left: Product Image */}
                <div className="aspect-square bg-gray-50 border rounded-lg flex items-center justify-center p-8 overflow-hidden relative group">
                  {(selectedItem.type === 'Limited' || selectedItem.type === 'LimitedU') && (
                    <div className="absolute bottom-2 left-2 z-30 drop-shadow-md">
                      <img 
                        src={getProxyUrl(selectedItem.type === 'LimitedU' ? LIMITED_U_LOGO : LIMITED_LOGO)} 
                        alt="Limited" 
                        className="h-20 w-auto object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  <div className="relative w-full h-full">
                    <img 
                      src={getProxyUrl(selectedItem.imageUrl)} 
                      alt={selectedItem.name} 
                      className="w-full h-full object-contain drop-shadow-xl relative z-10"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).parentElement!.classList.add('fallback-active');
                      }}
                    />
                    <div className="hidden [.fallback-active_&]:block absolute inset-0">
                      <ItemIcon name={selectedItem.name} category={selectedItem.category} className="scale-150" />
                    </div>
                  </div>
                </div>

                {/* Right: Product Info */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-brand-dim uppercase tracking-widest">{selectedItem.category}</div>
                    <h2 className="text-3xl font-black text-brand-neon leading-tight">{selectedItem.name}</h2>
                    <div className="flex items-center gap-1 text-sm font-medium">
                      <span className="text-brand-dim">By</span>
                      <a href="#" className="text-brand-neon hover:underline font-bold">{selectedItem.creator}</a>
                    </div>
                    
                    <div className="flex items-center gap-6 pt-3">
                      <div className="flex items-center gap-5">
                        <button 
                          onClick={() => toggleLike(selectedItem.id)}
                          className="flex items-center gap-1.5 group transition-all"
                          title="Like"
                        >
                          <ThumbsUp 
                            className={`w-4 h-4 ${(user.likedItems || []).includes(selectedItem.id) ? 'text-green-500 fill-green-500' : 'text-brand-dim group-hover:text-green-500'}`} 
                          />
                          <span className={`text-[11px] font-black ${(user.likedItems || []).includes(selectedItem.id) ? 'text-green-500' : 'text-brand-dim'}`}>
                            <motion.span key={selectedItem.likes}>{(selectedItem.likes || 0).toLocaleString()}</motion.span>
                          </span>
                        </button>
                        
                        <button 
                          onClick={() => toggleDislike(selectedItem.id)}
                          className="flex items-center gap-1.5 group transition-all"
                          title="Dislike"
                        >
                          <ThumbsDown 
                            className={`w-4 h-4 ${(user.dislikedItems || []).includes(selectedItem.id) ? 'text-red-500 fill-red-500' : 'text-brand-dim group-hover:text-red-500'}`} 
                          />
                          <span className={`text-[11px] font-black ${(user.dislikedItems || []).includes(selectedItem.id) ? 'text-red-500' : 'text-brand-dim'}`}>
                            <motion.span key={selectedItem.dislikes}>{(selectedItem.dislikes || 0).toLocaleString()}</motion.span>
                          </span>
                        </button>
                      </div>
                      
                      <button 
                        onClick={() => toggleFavorite(selectedItem.id)}
                        className="flex items-center gap-1.5 group transition-all"
                        title="Favorite"
                      >
                        <Star 
                          className={`w-4 h-4 ${(user.favoriteItems || []).includes(selectedItem.id) ? 'text-yellow-500 fill-yellow-500' : 'text-brand-dim group-hover:text-yellow-500'}`} 
                        />
                        <span className={`text-[11px] font-black ${(user.favoriteItems || []).includes(selectedItem.id) ? 'text-yellow-500' : 'text-brand-dim'}`}>
                          <motion.span key={selectedItem.favorites}>{(selectedItem.favorites || 0).toLocaleString()}</motion.span>
                        </span>
                      </button>
                    </div>
                  </div>

                  <hr />

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                       <span className="text-sm font-bold text-brand-dim uppercase">Price</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedItem.isOffsale ? (
                        <span className="text-2xl font-black text-brand-dim uppercase tracking-widest bg-gray-100 px-4 py-1 rounded shadow-inner">
                          OFFSALE
                        </span>
                      ) : (
                        <>
                          <RobuxIcon className="w-8 h-8" />
                          <span className="text-4xl font-black text-brand-price tracking-tighter">
                            {selectedItem.price > 0 ? selectedItem.price.toLocaleString() : 'FREE'}
                          </span>
                        </>
                      )}
                      {!selectedItem.isOffsale && selectedItem.previousPrice && selectedItem.previousPrice !== selectedItem.price && (
                        <div className={`flex items-center text-sm font-black px-2 py-0.5 rounded ${selectedItem.price > selectedItem.previousPrice ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {selectedItem.price > selectedItem.previousPrice ? <TrendingUp size={14} className="mr-1" /> : <TrendingDown size={14} className="mr-1" />}
                          {Math.abs(((selectedItem.price - selectedItem.previousPrice) / selectedItem.previousPrice) * 100).toFixed(1)}%
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 pt-4">
                      {selectedItem.isOffsale ? (
                        <div className="flex-grow py-3 px-8 rounded bg-gray-100 text-brand-dim font-black text-sm tracking-wide text-center uppercase border-2 border-dashed border-gray-300">
                          Item is not currently for sale
                        </div>
                      ) : (
                        <button 
                          onClick={() => buyItem(selectedItem)}
                          disabled={selectedItem.type === 'Regular' && user.inventory.some(inv => inv.itemId === selectedItem.id)}
                          className={`
                            flex-grow py-3 px-8 rounded font-black text-sm tracking-wide transition-all shadow-sm
                            ${(selectedItem.type === 'Regular' && user.inventory.some(inv => inv.itemId === selectedItem.id))
                              ? 'bg-gray-200 text-brand-dim cursor-not-allowed'
                              : 'bg-brand-neon text-white hover:brightness-110 active:scale-95'
                            }
                          `}
                        >
                          {(selectedItem.type === 'Regular' && user.inventory.some(inv => inv.itemId === selectedItem.id)) ? 'OWNED' : 'BUY'}
                        </button>
                      )}

                      <div className="relative">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsMenuOpen(!isMenuOpen);
                          }}
                          className={`p-3 border-2 rounded transition-colors ${isMenuOpen ? 'bg-gray-100 border-brand-neon' : 'border-gray-200 hover:bg-gray-100'}`}
                        >
                          <MoreHorizontal className="w-6 h-6 text-brand-dim" />
                        </button>
                        
                        {/* Dropdown Menu */}
                        <AnimatePresence>
                          {isMenuOpen && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 shadow-2xl rounded-lg overflow-hidden z-50 py-1"
                            >
                              {user.inventory.some(inv => inv.itemId === selectedItem.id) && (selectedItem.type === 'Limited' || selectedItem.type === 'LimitedU') ? (
                                <button 
                                  onClick={() => {
                                    setIsMenuOpen(false);
                                    const invInstance = user.inventory.find(inv => inv.itemId === selectedItem.id && !listings.some(l => l.inventoryItemId === inv.id));
                                    if (invInstance) {
                                      setSellingItem({ item: selectedItem, inventoryItem: invInstance });
                                      setSellingPrice(selectedItem.price.toString());
                                    } else {
                                      addNotification("❌ All tokens of this item are already listed!");
                                    }
                                  }}
                                  className="w-full text-left px-4 py-3 text-sm font-bold hover:bg-brand-limited-u/10 flex items-center gap-2 text-brand-limited-u transition-colors border-b"
                                >
                                  <TrendingUp size={14} /> SELL ITEM
                                </button>
                              ) : (
                                <div className="px-4 py-3 text-[10px] text-brand-dim font-bold italic border-b border-gray-50 flex items-center gap-2">
                                  <Clock size={12} /> NO SELL PERMISSION
                                </div>
                              )}
                              
                              <button className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-gray-100 flex items-center gap-2">
                                <LayoutGrid size={14} /> ADD TO PROFILE
                              </button>
                              <button className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-gray-100 flex items-center gap-2">
                                <Search size={14} /> FIND IN GAMES
                              </button>
                              <button className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-gray-100 flex items-center gap-2 text-red-600">
                                <Bell size={14} /> REPORT ITEM
                              </button>

                              {(selectedItem.creatorId === currentUser?.uid || 
                                selectedItem.creator === (currentUser?.displayName || "Official Developer") || 
                                newUGC.secretCode === '2006' ||
                                currentUser?.email === 'farhangantengon@gmail.com') && (
                                <button 
                                  onClick={() => setItemToDelete(selectedItem.id)}
                                  className="w-full text-left px-4 py-3 text-sm font-bold hover:bg-red-50 flex items-center gap-2 text-red-600 transition-colors border-t"
                                >
                                  <Trash2 size={14} /> DELETE ITEM
                                </button>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 space-y-4">
                     <div className="text-xs font-bold text-brand-dim uppercase border-b pb-2">Description</div>
                     <p className="text-sm text-[#4d4d4d] leading-relaxed font-medium">
                       Powerful and legendary {selectedItem.name.toLowerCase()} for the most elite Roblox players. 
                       Stand out in every game you visit. Tradable and collectable.
                     </p>
                  </div>

                  {(selectedItem.type === 'Limited' || selectedItem.type === 'LimitedU') && (
                    <div className="pt-6 p-4 bg-brand-neon/5 rounded-lg border border-brand-neon/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-brand-neon" />
                          <span className="text-xs font-black text-brand-neon uppercase tracking-wider">Price Hike Progress</span>
                        </div>
                        <span className="text-[10px] font-bold text-brand-dim bg-white px-2 py-0.5 rounded border">
                          TARGET: {selectedItem.hikeTarget?.toLocaleString() || '5,000'} SALES
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (selectedItem.soldCount % (selectedItem.hikeTarget || 5000)) / (selectedItem.hikeTarget || 5000) * 100)}%` }}
                            className="h-full bg-gradient-to-r from-brand-neon to-[#00d072] relative"
                          >
                            <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[pulse_2s_infinite]" />
                          </motion.div>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-black uppercase text-brand-dim">
                          <span>{selectedItem.soldCount.toLocaleString()} TOTAL SALES</span>
                          <span>{((selectedItem.hikeTarget || 5000) - (selectedItem.soldCount % (selectedItem.hikeTarget || 5000))).toLocaleString()} TO NEXT HIKE</span>
                        </div>
                      </div>
                      <p className="text-[9px] text-brand-neon font-bold italic">
                        ⚡ Demand is high! Price will spike once sales target is reached.
                      </p>
                    </div>
                  )}

                  {(selectedItem.type === 'Limited' || selectedItem.type === 'LimitedU') && (
                    <div className="pt-8 space-y-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="text-xs font-bold text-brand-dim uppercase">Resellers</div>
                        <div className="text-[10px] font-bold text-brand-dim uppercase">{listings.filter(l => l.itemId === selectedItem.id).length} Active Listings</div>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {listings
                          .filter(l => l.itemId === selectedItem.id)
                          .sort((a, b) => a.price - b.price)
                          .map((listing) => (
                            <div 
                              key={listing.id} 
                              className={`flex items-center justify-between p-3 rounded border transition-colors ${
                                listing.sellerType === 'User' 
                                  ? 'bg-brand-neon/5 border-brand-neon/40 shadow-sm' 
                                  : 'bg-gray-50 border-gray-100 hover:border-brand-neon/30'
                                }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${listing.sellerType === 'User' ? 'bg-brand-neon text-white' : 'bg-gray-200 text-brand-dim'}`}>
                                  <User size={16} />
                                </div>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-bold truncate max-w-[120px]">{listing.sellerName}</span>
                                    {listing.sellerType === 'User' && (
                                      <span className="bg-brand-neon text-white text-[8px] px-1.2 py-0.2 rounded uppercase font-black tracking-tighter">YOU</span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-brand-dim uppercase font-bold">
                                    {listing.sellerType === 'Bot' 
                                      ? (listing.price > (items.find(it => it.id === listing.itemId)?.price || 0) * 10 
                                          ? '⚠️ Scalper Reseller' 
                                          : 'Verified Reseller') 
                                      : 'Community Seller'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1">
                                  <RobuxIcon className="w-4 h-4" />
                                  <span className="text-lg font-black">{listing.price.toLocaleString()}</span>
                                </div>
                                {listing.sellerType === 'User' ? (
                                  <button 
                                    onClick={() => cancelListing(listing.id)}
                                    className="px-3 py-1.5 bg-gray-200 text-brand-dim text-[10px] font-bold rounded hover:bg-red-50 hover:text-red-500 transition-all uppercase"
                                  >
                                    Cancel
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => buyFromListing(listing)}
                                    className="px-4 py-1.5 bg-brand-neon text-white text-[10px] font-bold rounded shadow-sm hover:brightness-110 active:scale-95 transition-all"
                                  >
                                    BUY
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        }
                        {listings.filter(l => l.itemId === selectedItem.id).length === 0 && (
                          <div className="py-8 text-center text-brand-dim italic text-sm">No resellers currently listing this item.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'Marketplace' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">Marketplace</h2>
                <div className="flex items-center gap-2 text-xs text-brand-dim">
                  <span className="font-bold">Sort:</span>
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-transparent font-bold text-black outline-none border-none cursor-pointer"
                  >
                    <option>Bestselling</option>
                    <option>Recently Updated</option>
                    <option>Price (Low to High)</option>
                    <option>Price (High to Low)</option>
                    <option>Animation</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-8">
                <AnimatePresence>
                  {filteredItems.map(item => (
                    <ItemCard 
                      key={item.id} 
                      item={item} 
                      onBuy={() => buyItem(item)} 
                      onClick={(it) => setSelectedItem(it)}
                      onDelete={(id) => setItemToDelete(id)}
                      owned={item.type === 'Regular' && user.inventory.some(inv => inv.itemId === item.id)}
                      isOwnerSession={isOwnerSession}
                      isAdminUser={currentUser?.email === 'farhangantengon@gmail.com' || newUGC.secretCode === '2006'}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ) : activeTab === 'Inventory' ? (
            <div className="space-y-6">
               <div className="flex items-center justify-between border-b pb-4">
                <h2 className="text-2xl font-bold">Inventory</h2>
                <div className="text-xs text-brand-dim font-bold">{user.inventory.length} ITEMS</div>
              </div>
              
              {user.inventory.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                  {user.inventory.map((invItem) => {
                    const item = items.find(it => it.id === invItem.itemId);
                    if (!item) return null;
                    const isListed = listings.find(l => l.inventoryItemId === invItem.id);
                    return (
                      <motion.div 
                        key={invItem.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => setSelectedItem(item)}
                        className="bg-white border rounded p-2 hover:bg-gray-50 transition-colors shadow-sm group flex flex-col cursor-pointer"
                      >
                        <div className="aspect-square bg-white relative mb-2 overflow-hidden flex items-center justify-center border-b p-2">
                          <img 
                            src={getProxyUrl(item.imageUrl)} 
                            alt={item.name} 
                            className="w-full h-full object-contain opacity-90 group-hover:scale-105 transition-transform" 
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).parentElement!.classList.add('fallback-active');
                            }}
                          />
                          <div className="hidden [.fallback-active_&]:block w-full h-full">
                            <ItemIcon name={item.name} category={item.category} className="opacity-80" />
                          </div>
                        </div>
                        <div className="space-y-1 flex-grow">
                          <h3 className="font-bold text-xs text-brand-neon truncate leading-none mb-1">{item.name}</h3>
                          <div className="flex items-center justify-between">
                            <div className="text-[10px] text-brand-dim font-semibold uppercase">
                              {item.type !== 'Regular' ? `Serial #${invItem.id.slice(0, 4).toUpperCase()}` : item.category}
                            </div>
                            <div className="flex items-center gap-1">
                              <RobuxIcon className="w-3 h-3" />
                              <span className="text-[10px] font-bold text-brand-price">{invItem.purchasePrice.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        {item.type !== 'Regular' && isListed && (
                          <div className="mt-2 pt-2 border-t">
                            <div className="space-y-1 text-center">
                              <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-brand-price">
                                <RobuxIcon className="w-3 h-3" /> {isListed.price.toLocaleString()}
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelListing(isListed.id);
                                }}
                                className="w-full py-1 text-[9px] font-bold bg-gray-100 text-brand-dim rounded hover:bg-red-50 hover:text-brand-limited-u transition-colors uppercase"
                              >
                                Cancel Sale
                              </button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-24 text-center space-y-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mx-auto">
                    <Package size={32} />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold">Your inventory is empty</p>
                    <p className="text-brand-dim text-xs">Buy items from the marketplace to see them here.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('Marketplace')}
                    className="bg-brand-neon text-white px-8 py-2 rounded font-bold text-sm hover:brightness-110 transition-all"
                  >
                    Go to Marketplace
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </main>
      </div>
    </div>

      {/* Simplified Roblox Footer */}
      <footer className="bg-white border-t py-8 px-4 flex flex-col items-center gap-6 mt-auto">
        <div className="flex flex-wrap justify-center gap-6 text-[10px] font-bold text-brand-dim uppercase tracking-wider">
          <a href="#" className="hover:underline">About Us</a>
          <a href="#" className="hover:underline">Jobs</a>
          <a href="#" className="hover:underline">Blog</a>
          <a href="#" className="hover:underline">Parents</a>
          <a href="#" className="hover:underline">Gift Cards</a>
          <a href="#" className="hover:underline">Help</a>
          <a href="#" className="hover:underline">Terms</a>
          <a href="#" className="hover:underline">Accessibility</a>
          <a href="#" className="hover:underline">Privacy</a>
        </div>
        <p className="text-[10px] text-brand-dim">©2026 Roblox Corporation. Roblox, the Roblox logo and Powering Imagination are among our registered and unregistered trademarks.</p>
      </footer>

      {/* Topup Modal */}
      <AnimatePresence>
        {showTopupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowTopupModal(false);
                setShowCheckout(false);
                setPaymentStep('selection');
              }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]"
            >
              {paymentStep === 'selection' && (
                <>
                  <div className="p-6 border-b bg-gray-50 shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex flex-col">
                        <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                            <RobuxIcon className="w-6 h-6" />
                            Robux Balance
                        </h3>
                        <p className="text-[10px] font-bold text-brand-dim uppercase tracking-widest mt-1">Manage your currency</p>
                        </div>
                        <button onClick={() => setShowTopupModal(false)} className="text-brand-dim hover:text-black transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200">
                        <X size={20} />
                        </button>
                    </div>

                    <div className="flex p-1 bg-gray-200/50 rounded-lg">
                        <button 
                            onClick={() => setRobuxMenuTab('Topup')}
                            className={`flex-1 py-1.5 text-xs font-black uppercase tracking-widest rounded-md transition-all ${robuxMenuTab === 'Topup' ? 'bg-white text-black shadow-sm' : 'text-brand-dim'}`}
                        >
                            Top Up
                        </button>
                        <button 
                            onClick={() => setRobuxMenuTab('Transactions')}
                            className={`flex-1 py-1.5 text-xs font-black uppercase tracking-widest rounded-md transition-all ${robuxMenuTab === 'Transactions' ? 'bg-white text-black shadow-sm' : 'text-brand-dim'}`}
                        >
                            My Transactions
                        </button>
                    </div>
                  </div>
                  
                  <div className="flex-grow overflow-y-auto p-6 space-y-4">
                    {robuxMenuTab === 'Topup' ? (
                        <>
                        {[
                        { amount: 400, price: "$4.99" },
                        { amount: 800, price: "$9.99" },
                        { amount: 1700, price: "$19.99" },
                        { amount: 4500, price: "$49.99", highlight: true },
                        { amount: 10000, price: "$99.99", highlight: true },
                        { 
                            amount: 33000, 
                            price: "$199.99", 
                            highlight: true, 
                            hasCrown: true, 
                            label: "PLATINUM BUNDLE",
                            imageUrl: 'https://i.ibb.co.com/qMX9CWzh/image.png'
                        },
                        ].filter(pack => !pack.hasCrown || !user.inventory.some(inv => inv.itemId === 'platinum-domino-crown'))
                        .map((pack) => (
                        <button
                            key={pack.amount}
                            onClick={() => {
                            setSelectedPack(pack as any);
                            setPaymentStep('card');
                            }}
                            className={`
                            w-full flex items-center justify-between p-4 border-2 rounded-xl transition-all group relative overflow-hidden
                            ${pack.highlight 
                                ? 'border-brand-neon bg-brand-neon/5' 
                                : 'border-gray-100 bg-white hover:border-gray-300'
                            }
                            `}
                        >
                            {pack.label && (
                            <div className="absolute top-0 right-0 bg-brand-neon text-white text-[8px] font-black px-2 py-0.5 rounded-bl-lg">
                                {pack.label}
                            </div>
                            )}
                            <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg flex items-center justify-center ${pack.highlight ? 'bg-brand-neon/20' : 'bg-gray-100'}`}>
                                {pack.imageUrl ? (
                                <img src={getProxyUrl(pack.imageUrl)} className="w-12 h-12 object-contain" referrerPolicy="no-referrer" />
                                ) : (
                                <RobuxIcon className="w-8 h-8" />
                                )}
                            </div>
                            <div className="text-left">
                                <span className="font-black text-lg block">{pack.amount.toLocaleString()} Robux</span>
                                {pack.hasCrown && <span className="text-[10px] font-bold text-brand-limited-u flex items-center gap-1"><Sparkles size={10} /> Includes Platinum Domino Crown</span>}
                            </div>
                            </div>
                            <div className="bg-gray-900 text-white px-4 py-2 rounded-lg font-black text-sm group-hover:bg-brand-neon transition-colors">
                            {pack.price}
                            </div>
                        </button>
                        ))}
                        </>
                    ) : (
                        <div className="space-y-6 py-4">
                            <div className="bg-gray-50 border rounded-xl p-6 space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black text-brand-dim uppercase tracking-wider">Current Balance</span>
                                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full border shadow-sm">
                                        <RobuxIcon className="w-3.5 h-3.5" />
                                        <span className="text-sm font-black">{user.balance.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center bg-brand-neon/5 border border-brand-neon/20 rounded-lg p-3">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-brand-neon uppercase tracking-widest">Pending Robux</span>
                                        <span className="text-[8px] font-bold text-brand-dim opacity-70 italic underline">Available to claim anytime</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <RobuxIcon className="w-3.5 h-3.5" />
                                        <span className="text-lg font-black text-brand-price">{user.pendingBalance.toLocaleString()}</span>
                                    </div>
                                </div>
                                {user.pendingBalance > 0 ? (
                                    <button 
                                        onClick={claimPendingRobux}
                                        className="w-full py-2.5 bg-brand-neon text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand-neon/20 hover:brightness-110 active:scale-95 transition-all"
                                    >
                                        Claim {user.pendingBalance.toLocaleString()} Robux
                                    </button>
                                ) : (
                                    <button 
                                        className="w-full py-2 bg-gray-200 text-gray-400 cursor-not-allowed rounded-lg text-[9px] font-black uppercase tracking-widest"
                                    >
                                        No Claims Available
                                    </button>
                                )}
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-brand-dim uppercase tracking-widest ml-1">Recent Activity</h4>
                                {user.pendingBalance > 0 ? (
                                    <div className="bg-white border rounded-lg p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-brand-neon/10 rounded flex items-center justify-center">
                                                <TrendingUp size={16} className="text-brand-neon" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black">Marketplace Sale</span>
                                                <span className="text-[8px] font-bold text-brand-dim">Pending Authorization</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs font-black text-brand-price">+{user.pendingBalance.toLocaleString()}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-12 text-center opacity-30 border-2 border-dashed rounded-xl">
                                        <Clock size={24} className="mx-auto mb-2" />
                                        <p className="text-[10px] font-bold">No recent transactions</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                  </div>
                </>
              )}

              {paymentStep === 'card' && selectedPack && (
                <div className="p-8 space-y-8">
                  <div className="text-center space-y-2">
                    <div className="w-16 h-10 bg-[#FFD700] rounded-md mx-auto flex items-center justify-center border border-black/10 shadow-sm relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/20 to-transparent"></div>
                       <CreditCard className="text-[#333] w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-black">Card Master Checkout</h3>
                    <p className="text-xs font-bold text-brand-dim uppercase tracking-wider">Secure Payment Processing</p>
                  </div>

                  <div className="bg-gradient-to-br from-[#1a1c1e] to-[#2c2f33] p-6 rounded-2xl shadow-xl text-white space-y-8 relative overflow-hidden aspect-[1.586/1]">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                     <div className="flex justify-between items-start">
                        <div className="w-12 h-10 bg-gradient-to-br from-yellow-200 to-yellow-500 rounded-lg shadow-inner"></div>
                        <div className="text-right">
                           <p className="text-[10px] font-black tracking-widest opacity-40">CARD MASTER</p>
                           <div className="flex gap-1 mt-1">
                              <div className="w-6 h-6 bg-red-500 rounded-full opacity-80"></div>
                              <div className="w-6 h-6 bg-yellow-500 rounded-full -ml-3 opacity-80"></div>
                           </div>
                        </div>
                     </div>
                     <div className="space-y-1">
                        <p className="text-xs font-bold opacity-30 tracking-widest uppercase italic">Card Number</p>
                        <p className="text-2xl font-black tracking-[0.2em] font-mono">4532 • 7189 • 0012 • 8847</p>
                     </div>
                     <div className="flex justify-between items-end">
                        <div className="space-y-1">
                           <p className="text-[8px] font-bold opacity-30 tracking-widest uppercase italic">Card Holder</p>
                           <p className="text-sm font-black tracking-widest uppercase">ROBLOX EXPLORER</p>
                        </div>
                        <div className="space-y-1 text-right">
                           <p className="text-[8px] font-bold opacity-30 tracking-widest uppercase italic">Expires</p>
                           <p className="text-sm font-black tracking-widest uppercase">12 / 29</p>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-4">
                     <div className="flex justify-between items-center text-sm border-b border-dashed pb-2">
                        <span className="font-bold text-brand-dim uppercase tracking-wider">Purchase</span>
                        <span className="font-black">{selectedPack.amount.toLocaleString()} ROBUX</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="font-bold text-brand-dim uppercase tracking-wider">Total Charge</span>
                        <span className="font-black text-xl text-brand-neon">{selectedPack.price}</span>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setPaymentStep('processing')}
                      className="py-4 bg-brand-neon text-white font-black rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all text-sm uppercase tracking-widest"
                    >
                      Pay Now
                    </button>
                    <button 
                      onClick={() => setPaymentStep('selection')}
                      className="py-4 bg-gray-100 text-gray-500 font-black rounded-xl hover:bg-gray-200 transition-all text-sm uppercase tracking-widest"
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}

              {paymentStep === 'processing' && (
                <div className="p-12 text-center space-y-6">
                  <div className="w-20 h-20 border-4 border-gray-100 border-t-brand-neon rounded-full animate-spin mx-auto"></div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black">Authorizing Payment</h3>
                    <p className="text-sm font-bold text-brand-dim uppercase tracking-widest">Connecting to Card Master Network...</p>
                  </div>
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2 }}
                    onAnimationComplete={() => setTimeout(() => setPaymentStep('success'), 1000)}
                  />
                </div>
              )}

              {paymentStep === 'success' && selectedPack && (
                <div className="p-12 text-center space-y-8 bg-gradient-to-b from-[#00b06f]/10 to-transparent">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-24 h-24 bg-[#00b06f] mx-auto rounded-full flex items-center justify-center shadow-lg shadow-[#00b06f]/20"
                  >
                    <Check className="text-white w-12 h-12" />
                  </motion.div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-gray-800">Payment Successful!</h3>
                    <p className="text-sm font-bold text-brand-dim uppercase tracking-widest">Transaction Confirmed by Card Master</p>
                  </div>
                  <div className="p-4 bg-white border-2 border-dashed rounded-xl border-[#00b06f]/50">
                     <p className="text-xs font-bold text-brand-dim mb-1">CREDITED TO ACCOUNT</p>
                     <div className="flex items-center justify-center gap-2">
                        <RobuxIcon className="w-6 h-6" />
                        <span className="text-2xl font-black text-brand-price">+{selectedPack.amount.toLocaleString()}</span>
                     </div>
                     {selectedPack.hasCrown && (
                        <div className="mt-3 pt-3 border-t border-[#00b06f]/20 text-[10px] font-black text-brand-limited-u flex items-center justify-center gap-1">
                           <Sparkles size={12} /> BUNDLE UNLOCKED: PLATINUM DOMINO CROWN
                        </div>
                     )}
                  </div>
                  <button 
                    onClick={() => {
                        topupR(selectedPack.amount, selectedPack.hasCrown);
                        setShowTopupModal(false);
                        setPaymentStep('selection');
                    }}
                    className="w-full py-4 bg-gray-900 text-white font-black rounded-xl shadow-lg hover:bg-black transition-all uppercase tracking-widest"
                  >
                    Return to Shop
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create UGC Modal */}
      <AnimatePresence>
        {isCreateUGCModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateUGCModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="relative bg-white w-full max-w-md rounded-xl overflow-hidden shadow-2xl border-4 border-[#212121]"
            >
              <div className="bg-[#212121] p-4 flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <Package className="text-brand-neon" />
                  <h3 className="font-black uppercase tracking-tighter text-xl italic flex items-center gap-1">
                    {newUGC.secretCode === '2006' ? 'DEVELOPER' : 'USER'} <span className="text-brand-neon">CREATION</span>
                  </h3>
                </div>
                <button onClick={() => setIsCreateUGCModalOpen(false)} className="hover:rotate-90 transition-transform">
                  <X />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-brand-dim uppercase">Item Name</label>
                  <input 
                    type="text"
                    placeholder="Legendary Sparkle Item..."
                    value={newUGC.name}
                    onChange={(e) => setNewUGC({...newUGC, name: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded font-bold focus:border-brand-neon focus:bg-white outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-brand-dim uppercase">Active Category</label>
                    {newUGC.secretCode === '2006' ? (
                      <select 
                        value={newUGC.category}
                        onChange={(e) => setNewUGC({...newUGC, category: e.target.value as any})}
                        className="w-full px-4 py-2 bg-green-50 border border-green-200 rounded font-bold text-green-700 outline-none"
                      >
                        <option value="T-Shirt">T-Shirt (2 Options Path)</option>
                        <option value="Hat">UGC: Hat (Full Choice)</option>
                        <option value="Face">UGC: Face</option>
                        <option value="Gear">UGC: Gear</option>
                        <option value="Accessory">UGC: Accessory</option>
                      </select>
                    ) : (
                      <div className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded font-bold text-gray-500 cursor-not-allowed flex items-center gap-2">
                        <Shirt size={14} /> T-Shirt
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-brand-dim uppercase">Item Type</label>
                    <div className="flex bg-gray-100 p-1 rounded gap-1">
                      {(['Regular', 'Limited', 'LimitedU'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setNewUGC({...newUGC, type: t})}
                          className={`flex-1 py-1 rounded text-[9px] font-black uppercase transition-all ${
                            newUGC.type === t ? 'bg-white text-brand-neon shadow-sm scale-105' : 'text-gray-400'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-brand-dim uppercase italic">Item Visualization</label>
                    <span className="text-[9px] font-bold text-gray-400">Upload or paste URL</span>
                  </div>
                  
                  {!newUGC.imageUrl && (
                    <input 
                      type="text"
                      placeholder="Paste Image URL here..."
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-[10px] font-bold outline-none focus:border-brand-neon focus:bg-white"
                      onBlur={(e) => {
                        if (e.target.value.startsWith('http')) {
                          setNewUGC(prev => ({ ...prev, imageUrl: e.target.value }));
                        }
                      }}
                    />
                  )}

                  <div className="relative group overflow-hidden bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center transition-all hover:border-brand-neon hover:bg-brand-neon/5 cursor-pointer">
                    {newUGC.imageUrl ? (
                      <div className="relative w-full aspect-square max-h-[120px]">
                        <img src={newUGC.imageUrl} alt="UGC Preview" className="w-full h-full object-contain rounded" />
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewUGC(prev => ({ ...prev, imageUrl: '' }));
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg hover:scale-110 transition-transform z-10"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-4">
                        <Upload className="w-8 h-8 text-brand-dim group-hover:text-brand-neon group-hover:scale-110 transition-all" />
                        <div className="text-center">
                          <p className="text-xs font-black uppercase text-brand-dim group-hover:text-brand-neon transition-colors">Upload Photo</p>
                          <p className="text-[9px] text-gray-400 font-bold">PNG, JPG up to 2MB</p>
                        </div>
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-brand-dim uppercase italic">Initial Price (Robux)</label>
                   <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        <RobuxIcon className="w-5 h-5" />
                      </div>
                      <input 
                        type="number"
                        value={newUGC.price}
                        onChange={(e) => setNewUGC({...newUGC, price: parseInt(e.target.value) || 0})}
                        className="w-full pl-10 pr-4 py-3 bg-gray-100 border-2 border-transparent rounded font-black text-2xl focus:border-brand-neon focus:bg-white outline-none transition-all placeholder:text-gray-300"
                      />
                   </div>
                </div>

                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-brand-dim uppercase italic">Creator Code (Optional)</label>
                   <input 
                     type="text"
                     placeholder="Enter secret code for special perks..."
                     value={newUGC.secretCode}
                     onChange={(e) => setNewUGC({...newUGC, secretCode: e.target.value})}
                     className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded font-bold focus:border-brand-neon focus:bg-white outline-none"
                   />
                </div>

                {newUGC.secretCode !== '2006' && (
                  <div className="p-3 bg-brand-neon/5 border border-brand-neon/20 rounded-lg space-y-1">
                    <p className="text-[10px] font-black text-brand-neon uppercase tracking-tighter">⚠️ PUBLIC WEB VIEW (1 OPTION)</p>
                    <p className="text-[9px] text-brand-dim font-bold leading-tight">
                      Visitors can only create **T-Shirts**. 
                      Price Cap: 5k Robux. Earnings restricted to 40-50 per purchase.
                    </p>
                  </div>
                )}
                
                {newUGC.secretCode === '2006' && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-1">
                    <p className="text-[10px] font-black text-green-600 uppercase tracking-tighter">👑 OWNER MODE (2 PATHS ACTIVE)</p>
                    <p className="text-[9px] text-green-700 font-bold leading-tight">
                      Welcome back, Owner. Multi-user database syncing is active!
                    </p>
                  </div>
                )}

                <div className="pt-2">
                   <button 
                    onClick={createUGCItem}
                    className={`w-full py-4 font-black rounded-lg transition-all uppercase italic tracking-widest text-lg ${
                      newUGC.secretCode === '2006' 
                        ? 'bg-green-600 text-white shadow-[0_4px_0_#054322] hover:shadow-[0_6px_0_#054322]' 
                        : 'bg-brand-neon text-white shadow-[0_4px_0_#008444] hover:shadow-[0_6px_0_#008444]'
                    } hover:translate-y-[-2px] active:translate-y-[2px] active:shadow-none`}
                   >
                     {newUGC.secretCode === '2006' ? 'MINT DEVELOPER ITEM' : 'MINT T-SHIRT'}
                   </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {sellingItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSellingItem(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded overflow-hidden shadow-2xl border border-gray-200"
            >
              <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                <h3 className="text-sm font-black text-brand-dim uppercase tracking-wider">Sell Item</h3>
                <button onClick={() => setSellingItem(null)} className="text-brand-dim hover:text-black transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded border">
                  <div className="w-16 h-16 flex-shrink-0 bg-white border rounded overflow-hidden p-1">
                    <img 
                      src={getProxyUrl(sellingItem.item.imageUrl)} 
                      className="w-full h-full object-contain" 
                      onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                    />
                    <ItemIcon name={sellingItem.item.name} category={sellingItem.item.category} className="scale-75 hidden [[src='']_~_&]:block" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-brand-dim uppercase">{sellingItem.item.category}</span>
                    <span className="text-sm font-black truncate">{sellingItem.item.name}</span>
                    <div className="flex items-center gap-1 mt-1">
                       <span className="text-[10px] font-bold text-brand-dim">Market Price:</span>
                       <RobuxIcon className="w-3 h-3" />
                       <span className="text-[10px] font-bold">{sellingItem.item.price.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black text-brand-dim uppercase">Your Sale Price (Robux)</label>
                   <div className="relative">
                     <div className="absolute left-3 top-1/2 -translate-y-1/2">
                       <RobuxIcon className="w-5 h-5" />
                     </div>
                     <input 
                       type="number"
                       autoFocus
                       placeholder="0"
                       value={sellingPrice}
                       onChange={(e) => setSellingPrice(e.target.value)}
                       className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded font-black text-xl focus:border-brand-neon focus:bg-white outline-none transition-all"
                     />
                   </div>
                </div>

                <p className="text-[10px] text-brand-dim font-medium italic">
                  *Note: Marketplace fee of 30% is usually applied in Roblox, but this simulation gives you 100% of the sale!
                </p>

                <button 
                  onClick={() => {
                    const price = parseInt(sellingPrice);
                    if (!isNaN(price) && price > 0) {
                      sellItem(sellingItem.inventoryItem, price);
                      setSellingItem(null);
                    } else {
                      addNotification("❌ Please enter a valid price!");
                    }
                  }}
                  className="w-full py-4 bg-brand-neon text-white font-black rounded shadow-lg hover:brightness-110 active:scale-98 transition-all"
                >
                  POST FOR SALE
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showPurchaseConfirmation && buyingItem && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowPurchaseConfirmation(false);
                setBuyingItem(null);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#f5f5f5] w-full max-w-lg rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col border border-white/20"
            >
              {/* Modal Header */}
              <div className="h-14 bg-white border-b flex items-center px-6">
                <h2 className="text-xl font-bold text-gray-800">Buy Item</h2>
              </div>

              {/* Modal Body */}
              <div className="p-8 flex flex-col items-center text-center">
                <div className="w-32 h-32 bg-white rounded-lg p-2 border mb-6 shadow-sm">
                  <img 
                    src={getProxyUrl(buyingItem.imageUrl)} 
                    alt={buyingItem.name} 
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="space-y-3 mb-8 px-4">
                  <p className="text-lg font-medium text-gray-700">
                    Would you like to buy the <span className="font-bold">{buyingItem.name}</span> from <span className="font-bold">{buyingItem.creator}</span> for <span className="inline-flex items-center gap-1 font-bold whitespace-nowrap"><RobuxIcon className="w-4 h-4 translate-y-[-1px]" />{buyingItem.price.toLocaleString()}</span>?
                  </p>
                  <p className="text-sm text-gray-500 font-bold">
                    Your balance after this transaction will be <span className="inline-flex items-center gap-1 whitespace-nowrap"><RobuxIcon className="w-3.5 h-3.5" />{(user.balance - buyingItem.price).toLocaleString()}</span>
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-white border-t flex flex-col sm:flex-row gap-3 items-center justify-center">
                <button 
                  onClick={() => finalizePurchase()}
                  className="w-full sm:w-auto min-w-[140px] py-2.5 px-6 bg-[#00b06f] hover:bg-[#00a368] text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg"
                >
                  Buy Now
                </button>
                <button 
                  onClick={() => {
                    setShowPurchaseConfirmation(false);
                    setBuyingItem(null);
                  }}
                  className="w-full sm:w-auto min-w-[140px] py-2.5 px-6 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Roblox Chat Modal */}
      <AnimatePresence>
        {isRobloxChatOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRobloxChatOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-[#f2f4f5] rounded-xl shadow-2xl overflow-hidden flex flex-col h-[600px] border border-white/20"
            >
              <div className="h-16 bg-[#212121] flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-neon rounded-full flex items-center justify-center shadow-lg shadow-brand-neon/20">
                    <Bot className="text-white w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-white font-black text-lg">Roblox System</h2>
                    <p className="text-brand-neon text-[10px] font-bold uppercase tracking-widest">Always Online • Priority Suppport</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsRobloxChatOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="text-white w-5 h-5" />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-6 space-y-4">
                {chatMessages.map((msg, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={i} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`
                      max-w-[80%] px-4 py-3 rounded-2xl text-sm font-medium shadow-sm
                      ${msg.role === 'user' 
                        ? 'bg-brand-neon text-white rounded-tr-none' 
                        : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}
                    `}>
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-gray-100 flex gap-1">
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-white border-t border-gray-100">
                <div className="flex items-center gap-2 bg-gray-50 rounded-full px-4 py-2 border border-gray-200 focus-within:border-brand-neon focus-within:bg-white transition-all shadow-inner">
                  <input 
                    type="text" 
                    placeholder="Tell me what you want..." 
                    className="flex-grow bg-transparent outline-none py-1 text-sm font-medium"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={isChatLoading}
                    className="w-8 h-8 rounded-full bg-brand-neon flex items-center justify-center text-white hover:brightness-110 active:scale-95 transition-all shadow-md shadow-brand-neon/20"
                  >
                    <Send size={14} />
                  </button>
                </div>
                <p className="text-[10px] text-center mt-3 text-gray-400 font-bold uppercase tracking-widest">
                  Powered by Roblox AI • Security Level 10
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => !isDeleting && setItemToDelete(null)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-xl overflow-hidden shadow-2xl border border-gray-200"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-black text-black uppercase tracking-tight">Delete Item?</h3>
                <p className="text-sm text-gray-500 font-medium">
                  This legendary creation will be permanently removed from the marketplace. This action cannot be undone.
                </p>
                
                <div className="flex flex-col gap-3 pt-4">
                  <button 
                    onClick={handleDeleteItem}
                    disabled={isDeleting}
                    className="w-full py-4 bg-red-600 text-white font-black rounded-lg uppercase tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span>DELETING...</span>
                      </>
                    ) : (
                      'YES, DELETE PERMANENTLY'
                    )}
                  </button>
                  <button 
                    onClick={() => setItemToDelete(null)}
                    disabled={isDeleting}
                    className="w-full py-4 bg-gray-100 text-brand-dim font-black rounded-lg uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper to proxy images and bypass hotlink protection
const getProxyUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  // Using images.weserv.nl as it is highly reliable for bypassing hotlink protection
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&default=https://static.wikia.nocookie.net/roblox/images/d/d7/ValkyrieHelm.png/revision/latest`;
};

const ItemCard: React.FC<{ 
  item: MarketplaceItem; 
  onBuy: () => void; 
  onClick: (item: MarketplaceItem) => void;
  onDelete?: (itemId: string) => void;
  owned: boolean;
  isOwnerSession: boolean;
  isAdminUser?: boolean;
}> = ({ 
  item, 
  onBuy, 
  onClick,
  onDelete,
  owned,
  isOwnerSession,
  isAdminUser
}) => {
  const isLimited = item.type === 'Limited' || item.type === 'LimitedU';

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      animate={{ opacity: 1 }}
      onClick={() => onClick(item)}
      className="bg-white border hover:shadow-xl hover:shadow-brand-neon/5 transition-all flex flex-col group p-3 rounded-xl cursor-pointer ring-1 ring-black/5"
    >
      <div className="aspect-square bg-white relative mb-3 overflow-hidden flex items-center justify-center rounded-lg bg-gray-50/50 p-2 border border-black/5">
        {isLimited && (
          <div className="absolute bottom-1.5 left-1.5 z-30 drop-shadow-sm">
            <img 
              src={getProxyUrl(item.type === 'LimitedU' ? LIMITED_U_LOGO : LIMITED_LOGO)} 
              alt="Limited" 
              className="h-12 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        )}
        {item.isOffsale && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/5 backdrop-blur-[1px]">
             <div className="bg-gray-900/80 text-white text-[10px] font-black px-3 py-1 rounded-sm tracking-widest uppercase transform -rotate-12 border border-white/20 shadow-xl">
                Offsale
             </div>
          </div>
        )}
        <div className="w-full h-full relative">
          <img 
            src={getProxyUrl(item.imageUrl)} 
            alt={item.name} 
            className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500 relative z-10" 
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement!.classList.add('fallback-active');
            }}
          />
          <div className="hidden [.fallback-active_&]:block absolute inset-0">
             <ItemIcon name={item.name} category={item.category} className="scale-75" />
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col space-y-1">
        <h3 className="font-bold text-xs text-brand-neon hover:underline cursor-pointer truncate leading-tight mb-1">{item.name}</h3>
        
        <div className="flex flex-col">
          {item.isOffsale ? (
            <span className="font-black text-sm text-brand-dim uppercase tracking-widest opacity-60">
               OFFSALE
            </span>
          ) : (
            <div className="flex items-center gap-1">
              <RobuxIcon className="w-3.5 h-3.5" />
              <span className="font-black text-sm text-brand-price font-mono-price tracking-tight">
                {item.price.toLocaleString()}
              </span>
              {item.previousPrice && item.previousPrice !== item.price && (
                <div className={`flex items-center text-[9px] font-black ml-1 ${item.price > item.previousPrice ? 'text-green-500' : 'text-red-500'}`}>
                  {item.price > item.previousPrice ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {Math.abs(((item.price - item.previousPrice) / item.previousPrice) * 100).toFixed(1)}%
                </div>
              )}
            </div>
          )}
          <div className="text-[9px] text-brand-dim font-black uppercase tracking-tighter opacity-70">By {item.creator}</div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <div className="flex items-center gap-1 opacity-60">
            <ThumbsUp className="w-2.5 h-2.5" />
            <span className="text-[9px] font-black">
              <motion.span key={item.likes}>
                {(item.likes || 0) > 1000 ? ((item.likes || 0) / 1000).toFixed(1) + 'K' : (item.likes || 0)}
              </motion.span>
            </span>
          </div>
          <div className="flex items-center gap-1 opacity-60">
            <Star className="w-2.5 h-2.5" />
            <span className="text-[9px] font-black">
              <motion.span key={item.favorites}>
                {(item.favorites || 0) > 1000 ? ((item.favorites || 0) / 1000).toFixed(1) + 'K' : (item.favorites || 0)}
              </motion.span>
            </span>
          </div>
        </div>

        <div className="pt-3 flex gap-2">
          <button 
            disabled={owned}
            onClick={(e) => { e.stopPropagation(); onBuy(); }}
            className={`
              flex-grow py-2 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all
              ${owned ? 'bg-gray-100 text-brand-dim' : 'bg-brand-neon text-white shadow-lg shadow-brand-neon/20 hover:brightness-110 active:scale-95'}
            `}
          >
            {owned ? 'OWNED' : 'PURCHASE'}
          </button>
          
          {(isAdminUser || item.creatorId === 'FIX_ME_LATER') && onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
              className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
              title="Quick Delete"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
