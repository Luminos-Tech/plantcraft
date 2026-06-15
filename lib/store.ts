import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ===== TYPES =====

export type ItemCategory = 'hat' | 'glasses' | 'block' | 'vfx'
export type DecorationSlot = 'top' | 'face' | 'base' | 'aura'

export interface PlacedItem {
  id: string
  itemId: string
  plantId: string
  placementSlot?: DecorationSlot
  anchorX?: number // legacy only; new placement uses placementSlot presets
  anchorY?: number // legacy only; new placement uses placementSlot presets
  scaleRatio?: number
  isShared: boolean
  placedAt: number
}

export interface DecorationPlacement {
  placementSlot: DecorationSlot
  anchorX: number
  anchorY: number
  scaleRatio: number
}

const SLOT_DECORATION_PLACEMENT: Record<DecorationSlot, DecorationPlacement> = {
  top: { placementSlot: 'top', anchorX: 0.5, anchorY: -0.18, scaleRatio: 0.44 },
  face: { placementSlot: 'face', anchorX: 0.5, anchorY: 0.28, scaleRatio: 0.4 },
  base: { placementSlot: 'base', anchorX: 0.78, anchorY: 0.82, scaleRatio: 0.3 },
  aura: { placementSlot: 'aura', anchorX: 0.5, anchorY: 0.5, scaleRatio: 0.92 },
}

const CATEGORY_DECORATION_SLOT: Record<ItemCategory, DecorationSlot> = {
  hat: 'top',
  glasses: 'face',
  block: 'base',
  vfx: 'aura',
}

const ITEM_DECORATION_OVERRIDES: Record<string, Partial<DecorationPlacement>> = {
  'hat-crown': { anchorY: -0.22, scaleRatio: 0.42 },
  'hat-straw': { anchorY: -0.18, scaleRatio: 0.46 },
  'glasses-heart': { anchorY: 0.3, scaleRatio: 0.44 },
  'glasses-cool': { anchorY: 0.28, scaleRatio: 0.4 },
  'block-diamond': { anchorX: 0.82, anchorY: 0.78, scaleRatio: 0.28 },
  'block-dirt': { anchorX: 0.78, anchorY: 0.84, scaleRatio: 0.32 },
  'vfx-rainbow': { anchorY: 0.46, scaleRatio: 0.98 },
  'vfx-sparkle': { anchorY: 0.48, scaleRatio: 0.86 },
}

function isDecorationSlot(value: unknown): value is DecorationSlot {
  return typeof value === 'string' && value in SLOT_DECORATION_PLACEMENT
}

export function getDecorationPlacement(itemId: string, placementSlot?: DecorationSlot | null): DecorationPlacement {
  const category = SHOP_ITEMS.find((item) => item.id === itemId)?.category ?? 'block'
  const fallbackSlot = CATEGORY_DECORATION_SLOT[category]
  const slot = isDecorationSlot(placementSlot) ? placementSlot : fallbackSlot
  const base = SLOT_DECORATION_PLACEMENT[slot]
  const override = ITEM_DECORATION_OVERRIDES[itemId] ?? {}

  return {
    ...base,
    ...override,
    placementSlot: override.placementSlot ?? base.placementSlot,
  }
}

export function dedupePlacedItemsBySlot<T extends { itemId: string; placementSlot?: DecorationSlot | null }>(items: T[]): T[] {
  const bySlot = new Map<DecorationSlot, T>()

  for (const item of items) {
    const slot = getDecorationPlacement(item.itemId, item.placementSlot).placementSlot
    bySlot.set(slot, item)
  }

  return [...bySlot.values()]
}

export interface Plant {
  id: string
  name: string
  description: string
  imageUrl: string
  lastWatered: number      // timestamp ms
  lastWipedAt: number      // timestamp ms
  createdAt: number        // timestamp ms
  equippedItems: string[]  // legacy support
  placedItems: PlacedItem[] // new AR filter items
  pendingDiagnosis?: DiagnosisResult | null
  pendingDiagnosisAt?: number | null
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
  category: ItemCategory
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
  description: string
  hp: number
  placedItems: Pick<PlacedItem, 'id' | 'itemId' | 'placementSlot' | 'anchorX' | 'anchorY' | 'scaleRatio'>[]
  lastUpdated: number
  addedAt: number          // when we saved this friend plant
}

export interface RewardLog {
  id: string
  type: 'water' | 'wipe' | 'cure_disease' | 'scan_healthy' | 'scan_sick' | 'purchase' | 'add_plant' | 'mission'
  coinsDelta: number
  xpDelta: number
  timestamp: number
  plantId?: string
}

export interface MissionClaim {
  id: string
  missionId: string
  periodKey: string
  coinsDelta: number
  claimedAt: number
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
  missionClaims: MissionClaim[]
  
  // Actions
  addPlant: (name: string, imageUrl: string, description?: string) => void
  updatePlant: (plantId: string, data: Partial<Pick<Plant, 'name' | 'description' | 'imageUrl'>>) => void
  removePlant: (plantId: string) => void
  waterPlant: (plantId: string) => boolean
  wipePlant: (plantId: string) => boolean
  curePlant: (plantId: string) => boolean
  completeRescueMission: (plantId: string) => boolean
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
  claimMissionReward: (missionId: string, periodKey: string, coins: number) => boolean
  
  // Care Logs
  addCareLog: (plantId: string, action: CareLog['action'], notes?: string) => void
  
  // Friend Plants
  friendPlants: FriendPlant[]
  addFriendPlant: (ownerUid: string, plantId: string, data: { name: string; description?: string; hp: number; placedItems: FriendPlant['placedItems']; lastUpdated: number }) => void
  removeFriendPlant: (id: string) => void
  updateFriendPlant: (id: string, data: Partial<Pick<FriendPlant, 'name' | 'description' | 'hp' | 'placedItems' | 'lastUpdated'>>) => void
  
  // Utility
  getPlantHp: (plantId: string) => number
}

const XP_PER_LEVEL = 100
export const CARE_ACTION_COOLDOWN_MS = 5 * 60 * 1000

function getStableTimestamp(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && value ? value : fallback
}

function applyXpProgress(level: number, xp: number, xpDelta: number) {
  const currentLevel = Math.max(1, Number.isFinite(level) ? level : 1)
  const currentXp = Math.max(0, Number.isFinite(xp) ? xp : 0)

  if (currentXp >= XP_PER_LEVEL) {
    const normalizedLevel = Math.max(currentLevel, Math.floor(currentXp / XP_PER_LEVEL) + 1)
    const normalizedXp = currentXp % XP_PER_LEVEL
    const nextXp = normalizedXp + xpDelta

    return {
      level: normalizedLevel + Math.floor(nextXp / XP_PER_LEVEL),
      xp: nextXp % XP_PER_LEVEL,
    }
  }

  const nextXp = currentXp + xpDelta
  return {
    level: currentLevel + Math.floor(nextXp / XP_PER_LEVEL),
    xp: nextXp % XP_PER_LEVEL,
  }
}

function syncPublicPlantHp(plantId: string, hp: number) {
  if (typeof window === 'undefined') return

  const ownerUid = localStorage.getItem('plantcraft_uid')
  if (!ownerUid) return

  import('@/lib/firebase/plant-sync').then(({ syncHPToFirebase }) => {
    syncHPToFirebase(plantId, ownerUid, hp).catch(console.warn)
  })
}

function getOrCreateOwnerUid() {
  if (typeof window === 'undefined') return null

  let uid = localStorage.getItem('plantcraft_uid')
  if (!uid) {
    uid = 'user_' + crypto.randomUUID().slice(0, 8)
    localStorage.setItem('plantcraft_uid', uid)
  }
  return uid
}

function syncOwnedPlantRecord(plant: Plant, hp: number) {
  const ownerUid = getOrCreateOwnerUid()
  if (!ownerUid) return

  import('@/lib/firebase/plant-sync').then(({ publishOwnedPlantToFirebase }) => {
    publishOwnedPlantToFirebase(plant, ownerUid, hp).catch(console.warn)
  })
}

function syncPublicPlantRecord(plant: Plant, hp: number) {
  const ownerUid = getOrCreateOwnerUid()
  if (!ownerUid) return

  import('@/lib/firebase/plant-sync').then(({ publishToFirebase }) => {
    publishToFirebase(plant, ownerUid, hp).catch(console.warn)
  })
}

function unpublishPublicPlantRecord(plantId: string) {
  const ownerUid = getOrCreateOwnerUid()
  if (!ownerUid) return

  import('@/lib/firebase/plant-sync').then(({ unpublishFromFirebase }) => {
    unpublishFromFirebase(plantId, ownerUid).catch(console.warn)
  })
}

function removePlantRecords(plant: Plant) {
  const ownerUid = getOrCreateOwnerUid()
  if (!ownerUid) return

  import('@/lib/firebase/plant-sync').then(({ removeOwnedPlantFromFirebase, unpublishFromFirebase }) => {
    removeOwnedPlantFromFirebase(plant.id, ownerUid).catch(console.warn)
    if (plant.isPublic) unpublishFromFirebase(plant.id, ownerUid).catch(console.warn)
  })
}

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
      missionClaims: [],
      friendPlants: [],
      
      // ── Plant Actions ──

      addPlant: (name, imageUrl, description = '') => {
        const now = Date.now()
        const newPlant: Plant = {
          id: crypto.randomUUID(),
          name: name.slice(0, 20),
          description: description.slice(0, 160),
          imageUrl,
          lastWatered: now,
          lastWipedAt: now,
          createdAt: now,
          equippedItems: [],
          placedItems: [],
          pendingDiagnosis: null,
          pendingDiagnosisAt: null,
          isPublic: false,
        }
        const rewards = REWARD_TABLE.add_plant
        set((state) => {
          const progress = applyXpProgress(state.level, state.xp, rewards.xp)
          return {
            plants: [...state.plants, newPlant],
            coins: state.coins + rewards.coins,
            ...progress,
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
          }
        })
        get().addCareLog(newPlant.id, 'water', 'Plant added')
        syncOwnedPlantRecord(newPlant, 100)
        dispatchRewardEvent(rewards.xp, rewards.coins, 'Add new plant')
      },

      updatePlant: (plantId, data) => {
        set((state) => ({
          plants: state.plants.map((plant) => {
            if (plant.id !== plantId) return plant

            return {
              ...plant,
              name: data.name !== undefined ? data.name.slice(0, 20) : plant.name,
              description: data.description !== undefined ? data.description.slice(0, 160) : plant.description,
              imageUrl: data.imageUrl !== undefined ? data.imageUrl : plant.imageUrl,
            }
          }),
        }))

        const updatedPlant = get().plants.find((plant) => plant.id === plantId)
        if (updatedPlant) syncOwnedPlantRecord(updatedPlant, get().getPlantHp(plantId))
        if (updatedPlant?.isPublic) syncPublicPlantRecord(updatedPlant, get().getPlantHp(plantId))
      },
      
      removePlant: (plantId) => {
        const plant = get().plants.find((p) => p.id === plantId)
        set((state) => ({
          plants: state.plants.filter((p) => p.id !== plantId),
        }))
        if (plant) removePlantRecords(plant)
      },
      
      waterPlant: (plantId) => {
        const now = Date.now()
        const plant = get().plants.find((p) => p.id === plantId)
        if (!plant) return false

        const lastWatered = getStableTimestamp(plant.lastWatered, plant.createdAt || now)
        const hp = get().getPlantHp(plantId)
        if (now - lastWatered < CARE_ACTION_COOLDOWN_MS || hp >= 100) return false

        const rewards = REWARD_TABLE.water
        set((state) => {
          const progress = applyXpProgress(state.level, state.xp, rewards.xp)
          return {
            plants: state.plants.map((p) =>
              p.id === plantId ? { ...p, lastWatered: now } : p
            ),
            coins: state.coins + rewards.coins,
            ...progress,
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
          }
        })
        get().addCareLog(plantId, 'water')
        const updatedPlant = get().plants.find((p) => p.id === plantId)
        const updatedHp = get().getPlantHp(plantId)
        if (updatedPlant) syncOwnedPlantRecord(updatedPlant, updatedHp)
        if (plant.isPublic) syncPublicPlantHp(plantId, updatedHp)
        dispatchRewardEvent(rewards.xp, rewards.coins, 'Watering')
        return true
      },

      wipePlant: (plantId) => {
        const now = Date.now()
        const plant = get().plants.find((p) => p.id === plantId)
        if (!plant) return false

        const lastWipedAt = getStableTimestamp(plant.lastWipedAt, plant.createdAt || 0)
        if (now - lastWipedAt < CARE_ACTION_COOLDOWN_MS) return false

        const rewards = REWARD_TABLE.wipe
        set((state) => {
          const progress = applyXpProgress(state.level, state.xp, rewards.xp)
          return {
            plants: state.plants.map((p) =>
              p.id === plantId ? { ...p, lastWipedAt: now } : p
            ),
            coins: state.coins + rewards.coins,
            ...progress,
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
          }
        })
        get().addCareLog(plantId, 'wipe', 'Wiped leaves')
        const updatedPlant = get().plants.find((p) => p.id === plantId)
        if (updatedPlant) syncOwnedPlantRecord(updatedPlant, get().getPlantHp(plantId))
        dispatchRewardEvent(rewards.xp, rewards.coins, 'Wiping leaves')
        return true
      },

      curePlant: (plantId) => {
        const now = Date.now()
        const plant = get().plants.find((p) => p.id === plantId)
        if (!plant?.pendingDiagnosis) return false

        const rewards = REWARD_TABLE.cure_disease
        set((state) => {
          const progress = applyXpProgress(state.level, state.xp, rewards.xp)
          return {
            plants: state.plants.map((p) =>
              p.id === plantId ? { ...p, pendingDiagnosis: null, pendingDiagnosisAt: null, lastWatered: now } : p
            ),
            coins: state.coins + rewards.coins,
            ...progress,
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
          }
        })
        get().addCareLog(plantId, 'cure', 'Disease cured!')
        const updatedPlant = get().plants.find((p) => p.id === plantId)
        const updatedHp = get().getPlantHp(plantId)
        if (updatedPlant) syncOwnedPlantRecord(updatedPlant, updatedHp)
        if (plant.isPublic) syncPublicPlantHp(plantId, updatedHp)
        dispatchRewardEvent(rewards.xp, rewards.coins, 'Cured disease')
        return true
      },

      completeRescueMission: (plantId) => {
        const plant = get().plants.find((p) => p.id === plantId)
        if (!plant?.pendingDiagnosis) return false

        set((state) => ({
          plants: state.plants.map((p) =>
            p.id === plantId ? { ...p, pendingDiagnosis: null, pendingDiagnosisAt: null } : p
          ),
        }))
        get().addCareLog(plantId, 'cure', 'Rescue mission completed')
        const updatedPlant = get().plants.find((p) => p.id === plantId)
        const updatedHp = get().getPlantHp(plantId)
        if (updatedPlant) syncOwnedPlantRecord(updatedPlant, updatedHp)
        if (plant.isPublic) syncPublicPlantHp(plantId, updatedHp)
        return true
      },

      setPendingDiagnosis: (plantId, diagnosis) => {
        const now = Date.now()
        set((state) => ({
          plants: state.plants.map((p) =>
            p.id === plantId ? { ...p, pendingDiagnosis: diagnosis, pendingDiagnosisAt: now } : p
          ),
        }))
        const updatedPlant = get().plants.find((p) => p.id === plantId)
        const updatedHp = get().getPlantHp(plantId)
        if (updatedPlant) syncOwnedPlantRecord(updatedPlant, updatedHp)
        if (updatedPlant?.isPublic) syncPublicPlantRecord(updatedPlant, updatedHp)
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
        const updatedPlant = get().plants.find((p) => p.id === plantId)
        const updatedHp = get().getPlantHp(plantId)
        if (updatedPlant) syncOwnedPlantRecord(updatedPlant, updatedHp)
        if (updatedPlant && isPublic) {
          syncPublicPlantRecord(updatedPlant, updatedHp)
        } else {
          unpublishPublicPlantRecord(plantId)
        }
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
        set((state) => {
          const now = Date.now()
          const progress = applyXpProgress(state.level, state.xp, rewards.xp)
          return {
            coins: state.coins - price + rewards.coins,
            ...progress,
            ownedItems: [
              ...state.ownedItems,
              { itemId, purchasedAt: now },
            ],
            rewardHistory: [
              ...state.rewardHistory.slice(-99),
              {
                id: crypto.randomUUID(),
                type: 'purchase',
                coinsDelta: -price,
                xpDelta: rewards.xp,
                timestamp: now,
              }
            ],
          }
        })
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
        const placement = getDecorationPlacement(item.itemId, item.placementSlot)
        const itemToSave = {
          ...item,
          placementSlot: placement.placementSlot,
          scaleRatio: placement.scaleRatio,
          isShared: item.isShared || plant?.isPublic || false,
        }

        set((state) => ({
          plants: state.plants.map((p) =>
            p.id === plantId
              ? {
                  ...p,
                  placedItems: [
                    ...(p.placedItems || []).filter((placedItem) => {
                      const placedSlot = getDecorationPlacement(placedItem.itemId, placedItem.placementSlot).placementSlot
                      return placedSlot !== placement.placementSlot
                    }),
                    itemToSave,
                  ],
                }
              : p
          ),
        }))
        const updatedPlant = get().plants.find((p) => p.id === plantId)
        if (updatedPlant) syncOwnedPlantRecord(updatedPlant, get().getPlantHp(plantId))

        if (updatedPlant?.isPublic) {
          syncPublicPlantRecord(updatedPlant, get().getPlantHp(plantId))
        } else if (itemToSave.isShared && typeof window !== 'undefined') {
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
        const updatedPlant = get().plants.find((p) => p.id === plantId)
        if (updatedPlant) syncOwnedPlantRecord(updatedPlant, get().getPlantHp(plantId))

        if (updatedPlant?.isPublic) {
          syncPublicPlantRecord(updatedPlant, get().getPlantHp(plantId))
        } else if (plant?.isPublic) {
          unpublishPublicPlantRecord(plantId)
        }
      },
      
      // ── XP & Leveling ──

      addXp: (amount) => {
        set((state) => {
          const progress = applyXpProgress(state.level, state.xp, amount)
          const normalizedCurrentLevel = state.xp >= XP_PER_LEVEL
            ? Math.max(state.level, Math.floor(state.xp / XP_PER_LEVEL) + 1)
            : state.level
          const levelsGained = Math.max(0, progress.level - normalizedCurrentLevel)
          return {
            xp: progress.xp,
            level: progress.level,
            coins: state.coins + (levelsGained * 50),
          }
        })
      },
      
      addCoins: (amount) => {
        set((state) => ({ coins: state.coins + amount }))
      },

      claimMissionReward: (missionId, periodKey, coins) => {
        const now = Date.now()
        const rewardCoins = Math.max(0, Math.floor(coins))
        if (!missionId || !periodKey || rewardCoins <= 0) return false

        const alreadyClaimed = (get().missionClaims ?? []).some(
          (claim) => claim.missionId === missionId && claim.periodKey === periodKey
        )
        if (alreadyClaimed) return false

        set((state) => ({
          coins: state.coins + rewardCoins,
          missionClaims: [
            ...(state.missionClaims ?? []).slice(-119),
            {
              id: crypto.randomUUID(),
              missionId,
              periodKey,
              coinsDelta: rewardCoins,
              claimedAt: now,
            },
          ],
          rewardHistory: [
            ...state.rewardHistory.slice(-99),
            {
              id: crypto.randomUUID(),
              type: 'mission',
              coinsDelta: rewardCoins,
              xpDelta: 0,
              timestamp: now,
            },
          ],
        }))
        dispatchRewardEvent(0, rewardCoins, 'Mission reward')
        return true
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
        const lastWatered = getStableTimestamp(plant.lastWatered, plant.createdAt || now)
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
          description: data.description ?? '',
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
            f.id === id ? { ...f, ...data, lastUpdated: data.lastUpdated ?? Date.now() } : f
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
        missionClaims: state.missionClaims,
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
