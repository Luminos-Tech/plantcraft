import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ===== TYPES =====

export interface PlacedItem {
  id: string
  itemId: string
  plantId: string
  anchorX: number
  anchorY: number
  scaleRatio: number
  isShared: boolean
  placedAt: number
}

// Default anchor positions for each item category
export const ITEM_DEFAULT_ANCHOR: Record<string, { anchorX: number; anchorY: number; scaleRatio: number }> = {
  hat:     { anchorX: 0.5, anchorY: -0.25, scaleRatio: 0.45 },
  glasses: { anchorX: 0.5, anchorY: 0.25,  scaleRatio: 0.40 },
  block:   { anchorX: 0.8, anchorY: 0.6,   scaleRatio: 0.30 },
  vfx:     { anchorX: 0.5, anchorY: 0.5,   scaleRatio: 0.90 },
}

export interface Plant {
  id: string
  name: string
  imageUrl: string
  lastWatered: number      // timestamp ms
  lastWipedAt: number      // timestamp ms
  createdAt: number        // timestamp ms
  equippedItems: string[]  // legacy support
  placedItems: PlacedItem[] // new AR filter items
  pendingDiagnosis?: DiagnosisResult | null
  isPublic: boolean
}

export interface DiagnosisResult {
  disease: string
  severity: 'mild' | 'moderate' | 'severe'
  treatments: string[]
  confidence: number
  isHealthy: boolean
}

export interface ShopItem {
  id: string
  name: string
  description: string
  price: number
  category: 'hat' | 'glasses' | 'block' | 'vfx'
  rarity: 'common' | 'rare' | 'legendary'
  imageUrl: string
  createdAt: Date
}

export interface OwnedItem {
  itemId: string
  purchasedAt: number
}

export interface CareLog {
  id: string
  plantId: string
  action: 'water' | 'wipe' | 'fertilize' | 'scan' | 'decorate' | 'cure'
  timestamp: number
  notes?: string
}

export interface FriendPlant {
  id: string               // unique key in our local list
  ownerUid: string         // firebase uid of friend
  plantId: string          // original plant id on friend's account
  name: string
  hp: number
  placedItems: Pick<PlacedItem, "id" | "itemId" | "anchorX" | "anchorY" | "scaleRatio">[]
  lastUpdated: number
  addedAt: number          // when we saved this friend plant
}

export interface RewardLog {
  id: string
  type: 'water' | 'wipe' | 'cure_disease' | 'scan_healthy' | 'scan_sick' | 'purchase' | 'add_plant'
  coinsDelta: number
  xpDelta: number
  timestamp: number
  plantId?: string
}

// ===== REWARD TABLE =====

const REWARD_TABLE = {
  water:        { xp: 10,  coins: 2  },
  wipe:         { xp: 10,  coins: 2  },
  cure_disease: { xp: 50,  coins: 100 },
  scan_healthy: { xp: 5,   coins: 10  },
  scan_sick:    { xp: 10,  coins: 0   },
  add_plant:    { xp: 15,  coins: 0   },
  purchase:     { xp: 15,  coins: 0   },
} as const

// ===== STORE INTERFACE =====

interface GameState {
  // User Stats
  coins: number
  level: number
  xp: number
  
  // Plants
  plants: Plant[]
  
  // Inventory
  ownedItems: OwnedItem[]
  
  // Care History
  careLogs: CareLog[]
  
  // Reward History
  rewardHistory: RewardLog[]
  
  // Actions
  addPlant: (name: string, imageUrl: string) => void
  removePlant: (plantId: string) => void
  waterPlant: (plantId: string) => void
  wipePlant: (plantId: string) => void
  curePlant: (plantId: string) => void
  setPendingDiagnosis: (plantId: string, diagnosis: DiagnosisResult) => void
  setPlantPublic: (plantId: string, isPublic: boolean) => void
  updateAllHP: () => void
  
  purchaseItem: (itemId: string, price: number) => boolean
  equipItem: (plantId: string, itemId: string) => void
  unequipItem: (plantId: string, itemId: string) => void
  savePlacedItem: (plantId: string, item: PlacedItem) => void
  removePlacedItem: (plantId: string, itemInstanceId: string) => void
  
  // XP & Leveling
  addXp: (amount: number) => void
  addCoins: (amount: number) => void
  
  // Care Logs
  addCareLog: (plantId: string, action: CareLog['action'], notes?: string) => void
  
  // Friend Plants
  friendPlants: FriendPlant[]
  addFriendPlant: (ownerUid: string, plantId: string, data: { name: string; hp: number; placedItems: FriendPlant['placedItems']; lastUpdated: number }) => void
  removeFriendPlant: (id: string) => void
  updateFriendPlant: (id: string, data: Partial<Pick<FriendPlant, 'name' | 'hp' | 'placedItems' | 'lastUpdated'>>) => void
  
  // Utility
  getPlantHp: (plantId: string) => number
}

const XP_PER_LEVEL = 100

// ===== HELPER: dispatch reward event for toast =====
function dispatchRewardEvent(xp: number, coins: number, action: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('plantcraft:reward', {
      detail: { xp, coins, action }
    }))
  }
}

// ===== STORE =====

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      // Initial State
      coins: 100,
      level: 1,
      xp: 0,
      plants: [],
      ownedItems: [],
      careLogs: [],
      rewardHistory: [],
      friendPlants: [],
      
      // ── Plant Actions ──

      addPlant: (name, imageUrl) => {
        const now = Date.now()
        const newPlant: Plant = {
          id: crypto.randomUUID(),
          name: name.slice(0, 20),
          imageUrl,
          lastWatered: now,
          lastWipedAt: now,
          createdAt: now,
          equippedItems: [],
          placedItems: [],
          pendingDiagnosis: null,
          isPublic: false,
        }
        const rewards = REWARD_TABLE.add_plant
        set((state) => ({
          plants: [...state.plants, newPlant],
          xp: state.xp + rewards.xp,
          level: Math.floor((state.xp + rewards.xp) / XP_PER_LEVEL) + 1,
          rewardHistory: [
            ...state.rewardHistory.slice(-99),
            {
              id: crypto.randomUUID(),
              type: 'add_plant',
              coinsDelta: rewards.coins,
              xpDelta: rewards.xp,
              timestamp: now,
              plantId: newPlant.id,
            }
          ]
        }))
        get().addCareLog(newPlant.id, 'water', 'Plant added')
        dispatchRewardEvent(rewards.xp, rewards.coins, 'Add new plant')
      },
      
      removePlant: (plantId) => {
        set((state) => ({
          plants: state.plants.filter((p) => p.id !== plantId),
        }))
      },
      
      waterPlant: (plantId) => {
        const now = Date.now()
        const rewards = REWARD_TABLE.water
        set((state) => ({
          plants: state.plants.map((p) =>
            p.id === plantId ? { ...p, lastWatered: now } : p
          ),
          coins: state.coins + rewards.coins,
          xp: state.xp + rewards.xp,
          level: Math.floor((state.xp + rewards.xp) / XP_PER_LEVEL) + 1,
          rewardHistory: [
            ...state.rewardHistory.slice(-99),
            {
              id: crypto.randomUUID(),
              type: 'water',
              coinsDelta: rewards.coins,
              xpDelta: rewards.xp,
              timestamp: now,
              plantId,
            }
          ]
        }))
        get().addCareLog(plantId, 'water')
        dispatchRewardEvent(rewards.xp, rewards.coins, 'Watering')
      },

      wipePlant: (plantId) => {
        const now = Date.now()
        const rewards = REWARD_TABLE.wipe
        set((state) => ({
          plants: state.plants.map((p) =>
            p.id === plantId ? { ...p, lastWipedAt: now } : p
          ),
          coins: state.coins + rewards.coins,
          xp: state.xp + rewards.xp,
          level: Math.floor((state.xp + rewards.xp) / XP_PER_LEVEL) + 1,
          rewardHistory: [
            ...state.rewardHistory.slice(-99),
            {
              id: crypto.randomUUID(),
              type: 'wipe',
              coinsDelta: rewards.coins,
              xpDelta: rewards.xp,
              timestamp: now,
              plantId,
            }
          ]
        }))
        get().addCareLog(plantId, 'wipe', 'Wiped leaves')
        dispatchRewardEvent(rewards.xp, rewards.coins, 'Wiping leaves')
      },

      curePlant: (plantId) => {
        const now = Date.now()
        const rewards = REWARD_TABLE.cure_disease
        set((state) => ({
          plants: state.plants.map((p) =>
            p.id === plantId ? { ...p, pendingDiagnosis: null, lastWatered: now } : p
          ),
          coins: state.coins + rewards.coins,
          xp: state.xp + rewards.xp,
          level: Math.floor((state.xp + rewards.xp) / XP_PER_LEVEL) + 1,
          rewardHistory: [
            ...state.rewardHistory.slice(-99),
            {
              id: crypto.randomUUID(),
              type: 'cure_disease',
              coinsDelta: rewards.coins,
              xpDelta: rewards.xp,
              timestamp: now,
              plantId,
            }
          ]
        }))
        get().addCareLog(plantId, 'cure', 'Disease cured!')
        dispatchRewardEvent(rewards.xp, rewards.coins, 'Cured disease')
      },

      setPendingDiagnosis: (plantId, diagnosis) => {
        set((state) => ({
          plants: state.plants.map((p) =>
            p.id === plantId ? { ...p, pendingDiagnosis: diagnosis } : p
          ),
        }))
      },

      setPlantPublic: (plantId, isPublic) => {
        set((state) => ({
          plants: state.plants.map((p) =>
            p.id === plantId
              ? {
                  ...p,
                  isPublic,
                  placedItems: (p.placedItems || []).map((item) => ({
                    ...item,
                    isShared: isPublic,
                  })),
                }
              : p
          ),
        }))
      },

      updateAllHP: () => {
        // Called on app open — HP decays passively
        // No state mutation needed; HP is computed dynamically by getPlantHp
      },
      
      // ── Shop Actions ──

      purchaseItem: (itemId, price) => {
        const { coins, ownedItems } = get()
        if (coins < price) return false
        if (ownedItems.some((o) => o.itemId === itemId)) return false
        
        const rewards = REWARD_TABLE.purchase
        set((state) => ({
          coins: state.coins - price,
          xp: state.xp + rewards.xp,
          level: Math.floor((state.xp + rewards.xp) / XP_PER_LEVEL) + 1,
          ownedItems: [
            ...state.ownedItems,
            { itemId, purchasedAt: Date.now() },
          ],
        }))
        dispatchRewardEvent(rewards.xp, 0, 'Purchase item')
        return true
      },
      
      equipItem: (plantId, itemId) => {
        set((state) => ({
          plants: state.plants.map((p) =>
            p.id === plantId
              ? { ...p, equippedItems: [...p.equippedItems, itemId] }
              : p
          ),
        }))
        get().addCareLog(plantId, 'decorate', `Equipped item ${itemId}`)
      },
      
      unequipItem: (plantId, itemId) => {
        set((state) => ({
          plants: state.plants.map((p) =>
            p.id === plantId
              ? { ...p, equippedItems: p.equippedItems.filter((i) => i !== itemId) }
              : p
          ),
        }))
      },

      savePlacedItem: (plantId, item) => {
        const plant = get().plants.find((p) => p.id === plantId)
        const itemToSave = {
          ...item,
          isShared: item.isShared || plant?.isPublic || false,
        }

        set((state) => ({
          plants: state.plants.map((p) =>
            p.id === plantId
              ? { ...p, placedItems: [...(p.placedItems || []), itemToSave] }
              : p
          ),
        }))
        
        if (itemToSave.isShared && typeof window !== 'undefined') {
          const ownerUid = localStorage.getItem('plantcraft_uid')
          if (ownerUid) {
            import('@/lib/firebase/plant-sync').then(({ syncPlacedItemToFirebase }) => {
              syncPlacedItemToFirebase(plantId, ownerUid, itemToSave).catch(console.warn)
            })
          }
        }
      },

      removePlacedItem: (plantId, itemInstanceId) => {
        const plant = get().plants.find((p) => p.id === plantId)
        set((state) => ({
          plants: state.plants.map((p) =>
            p.id === plantId
              ? { ...p, placedItems: (p.placedItems || []).filter((i) => i.id !== itemInstanceId) }
              : p
          ),
        }))

        if (plant?.isPublic && typeof window !== 'undefined') {
          const ownerUid = localStorage.getItem('plantcraft_uid')
          if (ownerUid) {
            import('@/lib/firebase/plant-sync').then(({ removeSharedItemFromFirebase }) => {
              removeSharedItemFromFirebase(plantId, ownerUid, itemInstanceId).catch(console.warn)
            })
          }
        }
      },
      
      // ── XP & Leveling ──

      addXp: (amount) => {
        set((state) => {
          const newXp = state.xp + amount
          const levelsGained = Math.floor(newXp / XP_PER_LEVEL)
          return {
            xp: newXp % XP_PER_LEVEL,
            level: state.level + levelsGained,
            coins: state.coins + (levelsGained * 50),
          }
        })
      },
      
      addCoins: (amount) => {
        set((state) => ({ coins: state.coins + amount }))
      },
      
      // ── Care Logs ──

      addCareLog: (plantId, action, notes) => {
        const log: CareLog = {
          id: crypto.randomUUID(),
          plantId,
          action,
          timestamp: Date.now(),
          notes,
        }
        set((state) => ({
          careLogs: [log, ...state.careLogs].slice(0, 100),
        }))
      },
      
      // ── Utility ──

      getPlantHp: (plantId) => {
        const plant = get().plants.find((p) => p.id === plantId)
        if (!plant) return 0
        
        const now = Date.now()
        const lastWatered = plant.lastWatered
        // HP decays 4 points per hour (~25 hours to death)
        const hoursSinceWatered = (now - lastWatered) / 3600000
        const hp = Math.max(0, Math.min(100, 100 - Math.floor(hoursSinceWatered * 4)))
        return hp
      },

      // ── Friend Plants ──

      addFriendPlant: (ownerUid, plantId, data) => {
        // Don't add duplicates (same ownerUid + plantId)
        const existing = get().friendPlants.find(
          (f) => f.ownerUid === ownerUid && f.plantId === plantId
        )
        if (existing) {
          // Update data instead
          get().updateFriendPlant(existing.id, data)
          return
        }
        const newFriend: FriendPlant = {
          id: crypto.randomUUID(),
          ownerUid,
          plantId,
          ...data,
          addedAt: Date.now(),
        }
        set((state) => ({
          friendPlants: [...state.friendPlants, newFriend],
        }))
      },

      removeFriendPlant: (id) => {
        set((state) => ({
          friendPlants: state.friendPlants.filter((f) => f.id !== id),
        }))
      },

      updateFriendPlant: (id, data) => {
        set((state) => ({
          friendPlants: state.friendPlants.map((f) =>
            f.id === id ? { ...f, ...data, lastUpdated: Date.now() } : f
          ),
        }))
      },
    }),
    {
      name: 'plantcraft-storage',
      partialize: (state) => ({
        coins: state.coins,
        level: state.level,
        xp: state.xp,
        plants: state.plants,
        ownedItems: state.ownedItems,
        careLogs: state.careLogs,
        rewardHistory: state.rewardHistory,
        friendPlants: state.friendPlants,
      }),
    }
  )
)

// ===== SHOP ITEMS DATA =====

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'hat-straw',
    name: 'Green Straw Hat',
    description: 'Minecraft straw hat — most popular spring item!',
    price: 25,
    category: 'hat',
    rarity: 'common',
    imageUrl: '/items/hat-straw.png',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'hat-crown',
    name: 'Golden Crown',
    description: 'Turn your plant into royalty with this sparkling crown.',
    price: 100,
    category: 'hat',
    rarity: 'legendary',
    imageUrl: '/items/hat-crown.png',
    createdAt: new Date('2024-03-15'),
  },
  {
    id: 'glasses-cool',
    name: 'Cool Pixel Glasses',
    description: 'Pixelated glasses for the coolest plant in the neighborhood.',
    price: 30,
    category: 'glasses',
    rarity: 'common',
    imageUrl: '/items/glasses-cool.png',
    createdAt: new Date('2024-01-15'),
  },
  {
    id: 'glasses-heart',
    name: 'Sunflower Glasses',
    description: 'Show some love with these adorable heart-shaped glasses.',
    price: 45,
    category: 'glasses',
    rarity: 'common',
    imageUrl: '/items/glasses-heart.png',
    createdAt: new Date('2024-02-14'),
  },
  {
    id: 'block-dirt',
    name: 'Dirt Block',
    description: 'Classic Minecraft dirt block. Place it anywhere!',
    price: 15,
    category: 'block',
    rarity: 'common',
    imageUrl: '/items/block-dirt.png',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'block-diamond',
    name: 'Diamond Block',
    description: 'The rarest block — show off your wealth!',
    price: 250,
    category: 'block',
    rarity: 'legendary',
    imageUrl: '/items/block-diamond.png',
    createdAt: new Date('2024-04-01'),
  },
  {
    id: 'vfx-sparkle',
    name: 'Sparkle Effect',
    description: 'Add magical glowing sparkles around your plant.',
    price: 50,
    category: 'vfx',
    rarity: 'common',
    imageUrl: '/items/vfx-sparkle.png',
    createdAt: new Date('2024-02-01'),
  },
  {
    id: 'vfx-rainbow',
    name: 'Rainbow Aura',
    description: 'A beautiful rainbow aura surrounding your plant.',
    price: 150,
    category: 'vfx',
    rarity: 'rare',
    imageUrl: '/items/vfx-rainbow.png',
    createdAt: new Date('2024-03-01'),
  },
]
