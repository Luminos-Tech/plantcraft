import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ===== TYPES =====

export type ItemCategory = 'hat' | 'glasses' | 'block' | 'vfx'
export type DecorationSlot = 'top' | 'face' | 'base' | 'aura'
export type PlantGroup = 'default' | 'succulent' | 'tropical' | 'herb' | 'flowering'

export interface PlantGroupConfig {
  id: PlantGroup
  label: string
  description: string
  waterCycleMs: number
}

export interface UserProfile {
  avatarUrl: string
  dailyNeighbors: FriendPlant[]
  lastMapRefresh: string | null
  updatedAt: number
}

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
  aura: { placementSlot: 'aura', anchorX: 0.5, anchorY: 0.58, scaleRatio: 0.92 },
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
  'vfx-rainbow': { anchorY: 0.58, scaleRatio: 0.98 },
  'vfx-sparkle': { anchorY: 0.6, scaleRatio: 0.86 },
  'vfx-victory-aurora': { anchorY: 0.56, scaleRatio: 1.04 },
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
  plantGroup: PlantGroup
  waterCycle: number
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
  exclusive?: boolean
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
  imageUrl?: string
  plantGroup?: PlantGroup
  waterCycle?: number
  lastWatered?: number
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

export interface TournamentVote {
  monthKey: string
  category: 'style' | 'care'
  candidateId: string
  votedAt: number
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

export const DEFAULT_WATER_CYCLE_MS = 3 * 24 * 60 * 60 * 1000

export const PLANT_GROUPS: PlantGroupConfig[] = [
  {
    id: 'default',
    label: 'Phổ thông',
    description: 'Chu kỳ cân bằng cho cây mới.',
    waterCycleMs: DEFAULT_WATER_CYCLE_MS,
  },
  {
    id: 'succulent',
    label: 'Mọng nước',
    description: 'Ít tưới hơn, chịu khô tốt.',
    waterCycleMs: 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'tropical',
    label: 'Nhiệt đới',
    description: 'Ưa ẩm, cần chăm đều tay.',
    waterCycleMs: 2 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'herb',
    label: 'Rau thơm',
    description: 'Tưới thường xuyên để tươi lâu.',
    waterCycleMs: 24 * 60 * 60 * 1000,
  },
  {
    id: 'flowering',
    label: 'Ra hoa',
    description: 'Cần nhịp tưới ổn định để giữ nụ.',
    waterCycleMs: 3 * 24 * 60 * 60 * 1000,
  },
]

export function getPlantGroupConfig(plantGroup?: PlantGroup | null) {
  return PLANT_GROUPS.find((group) => group.id === plantGroup) ?? PLANT_GROUPS[0]
}

export function getPlantWaterCycleMs(plant: Pick<Plant, 'plantGroup' | 'waterCycle'>) {
  return Number.isFinite(plant.waterCycle) && plant.waterCycle > 0
    ? plant.waterCycle
    : getPlantGroupConfig(plant.plantGroup).waterCycleMs
}

export function getWaterCycleRemainingMs(
  plant: Pick<Plant, 'lastWatered' | 'createdAt' | 'plantGroup' | 'waterCycle'>,
  now = Date.now()
) {
  const cycleMs = Math.max(1, getPlantWaterCycleMs(plant))
  const lastWatered = getStableTimestamp(plant.lastWatered, plant.createdAt || now)
  return lastWatered + cycleMs - now
}

export function getWaterCycleProgress(plant: Pick<Plant, 'lastWatered' | 'createdAt' | 'plantGroup' | 'waterCycle'>, now = Date.now()) {
  const cycleMs = Math.max(1, getPlantWaterCycleMs(plant))
  const remaining = getWaterCycleRemainingMs(plant, now)
  return Math.max(0, Math.min(100, Math.round((remaining / cycleMs) * 100)))
}

export function formatWaterCycleRemaining(ms: number) {
  if (ms <= 0) return 'Water now'

  const totalMinutes = Math.ceil(ms / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function getDayKey(timestamp = Date.now()) {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getMonthKey(timestamp = Date.now()) {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

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
  tournamentVotes: TournamentVote[]
  tournamentRewardClaims: string[]

  // User Profile
  userProfile: UserProfile
  
  // Actions
  addPlant: (name: string, imageUrl: string, description?: string, plantGroup?: PlantGroup) => void
  updatePlant: (plantId: string, data: Partial<Pick<Plant, 'name' | 'description' | 'imageUrl' | 'plantGroup' | 'waterCycle'>>) => void
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
  castTournamentVote: (monthKey: string, category: TournamentVote['category'], candidateId: string) => boolean
  claimTournamentReward: (monthKey: string) => boolean
  
  // Care Logs
  addCareLog: (plantId: string, action: CareLog['action'], notes?: string) => void
  
  // Friend Plants
  friendPlants: FriendPlant[]
  addFriendPlant: (ownerUid: string, plantId: string, data: { name: string; description?: string; imageUrl?: string; plantGroup?: PlantGroup; waterCycle?: number; lastWatered?: number; hp: number; placedItems: FriendPlant['placedItems']; lastUpdated: number }) => void
  removeFriendPlant: (id: string) => void
  updateFriendPlant: (id: string, data: Partial<Pick<FriendPlant, 'name' | 'description' | 'imageUrl' | 'plantGroup' | 'waterCycle' | 'lastWatered' | 'hp' | 'placedItems' | 'lastUpdated'>>) => void

  // User Sync
  refreshDailyNeighbors: () => Promise<void>
  updateUserAvatar: (avatarUrl: string) => void
  updateAvatarFromBlob: (blob: Blob) => Promise<boolean>
  syncAvatarFromBlob: (blob: Blob) => Promise<boolean>
  
  // Utility
  getPlantHp: (plantId: string) => number
}

const XP_PER_LEVEL = 100
export const CARE_ACTION_COOLDOWN_MS = 5 * 60 * 1000
const DAILY_NEIGHBOR_LIMIT = 6
const ENGLISH_FIRST_NAMES = [
  'Oliver',
  'Amelia',
  'Noah',
  'Mia',
  'Leo',
  'Ava',
  'Theo',
  'Luna',
  'Ethan',
  'Ivy',
  'Mason',
  'Sophie',
]
const ENGLISH_LAST_NAMES = [
  'Green',
  'Fields',
  'Brook',
  'Stone',
  'Woods',
  'River',
  'Bloom',
  'Reed',
  'Hayes',
  'Parker',
  'Bennett',
  'Morgan',
]

function getStableTimestamp(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && value ? value : fallback
}

function seededIndex(seed: string, length: number, salt = 0) {
  let hash = 2166136261 + salt
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash) % length
}

export function getFriendOwnerName(ownerUid?: string | null) {
  const seed = ownerUid || 'plantcraft-neighbor'
  const first = ENGLISH_FIRST_NAMES[seededIndex(seed, ENGLISH_FIRST_NAMES.length)]
  const last = ENGLISH_LAST_NAMES[seededIndex(seed, ENGLISH_LAST_NAMES.length, 97)]
  return `${first} ${last}`
}

function getDefaultUserProfile(): UserProfile {
  return {
    avatarUrl: '',
    dailyNeighbors: [],
    lastMapRefresh: null,
    updatedAt: 0,
  }
}

function getPlantWaterSettings(plantGroup?: PlantGroup | null) {
  const group = getPlantGroupConfig(plantGroup)
  return {
    plantGroup: group.id,
    waterCycle: group.waterCycleMs,
  }
}

function blobToAvatarDataUrl(blob: Blob): Promise<string> {
  if (typeof window === 'undefined') return Promise.resolve('')

  return new Promise((resolve) => {
    let settled = false
    const finish = (value: string) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    const reader = new FileReader()
    reader.onerror = () => finish('')
    reader.onload = () => {
      const fallbackDataUrl = typeof reader.result === 'string' ? reader.result : ''
      if (!fallbackDataUrl) {
        finish('')
        return
      }

      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const size = 160
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            finish(fallbackDataUrl)
            return
          }

          const cropSize = Math.min(img.width, img.height)
          const cropX = (img.width - cropSize) / 2
          const cropY = (img.height - cropSize) / 2
          ctx.drawImage(img, cropX, cropY, cropSize, cropSize, 0, 0, size, size)
          finish(canvas.toDataURL('image/jpeg', 0.78))
        } catch {
          finish(fallbackDataUrl)
        }
      }
      img.onerror = () => finish(fallbackDataUrl)
      img.src = fallbackDataUrl
    }
    reader.readAsDataURL(blob)
  })
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

export function getOrCreateOwnerUid() {
  if (typeof window === 'undefined') return null

  let uid = localStorage.getItem('plantcraft_uid')
  if (!uid) {
    uid = 'user_' + crypto.randomUUID().slice(0, 8)
    localStorage.setItem('plantcraft_uid', uid)
  }
  return uid
}

function syncUserProfileRecord(profile: UserProfile) {
  const ownerUid = getOrCreateOwnerUid()
  if (!ownerUid) return

  import('@/lib/firebase/user-sync').then(({ publishUserProfileToFirebase }) => {
    publishUserProfileToFirebase(ownerUid, profile).catch(console.warn)
  })
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
      tournamentVotes: [],
      tournamentRewardClaims: [],
      friendPlants: [],
      userProfile: getDefaultUserProfile(),
      
      // ── Plant Actions ──

      addPlant: (name, imageUrl, description = '', plantGroup = 'default') => {
        const now = Date.now()
        const waterSettings = getPlantWaterSettings(plantGroup)
        const newPlant: Plant = {
          id: crypto.randomUUID(),
          name: name.slice(0, 20),
          description: description.slice(0, 160),
          imageUrl,
          ...waterSettings,
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
            const waterSettings = data.plantGroup !== undefined
              ? getPlantWaterSettings(data.plantGroup)
              : {
                  plantGroup: plant.plantGroup ?? 'default',
                  waterCycle: data.waterCycle !== undefined ? data.waterCycle : getPlantWaterCycleMs(plant),
                }

            return {
              ...plant,
              name: data.name !== undefined ? data.name.slice(0, 20) : plant.name,
              description: data.description !== undefined ? data.description.slice(0, 160) : plant.description,
              imageUrl: data.imageUrl !== undefined ? data.imageUrl : plant.imageUrl,
              ...waterSettings,
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
        const waterDue = getWaterCycleRemainingMs(plant, now) <= 0
        const hp = get().getPlantHp(plantId)
        if (!waterDue && (now - lastWatered < CARE_ACTION_COOLDOWN_MS || hp >= 100)) return false

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
        if (updatedPlant?.isPublic) syncPublicPlantRecord(updatedPlant, updatedHp)
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
        if (updatedPlant?.isPublic) syncPublicPlantRecord(updatedPlant, updatedHp)
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
        if (updatedPlant?.isPublic) syncPublicPlantRecord(updatedPlant, updatedHp)
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

      castTournamentVote: (monthKey, category, candidateId) => {
        if (!monthKey || !candidateId) return false

        set((state) => {
          const nextVote: TournamentVote = {
            monthKey,
            category,
            candidateId,
            votedAt: Date.now(),
          }
          return {
            tournamentVotes: [
              ...(state.tournamentVotes ?? []).filter((vote) => (
                vote.monthKey !== monthKey || vote.category !== category
              )),
              nextVote,
            ],
          }
        })
        return true
      },

      claimTournamentReward: (monthKey) => {
        if (!monthKey) return false
        const claimKey = `${monthKey}:vfx-victory-aurora`
        const alreadyClaimed = (get().tournamentRewardClaims ?? []).includes(claimKey)
        if (alreadyClaimed) return false

        set((state) => ({
          ownedItems: state.ownedItems.some((item) => item.itemId === 'vfx-victory-aurora')
            ? state.ownedItems
            : [
                ...state.ownedItems,
                {
                  itemId: 'vfx-victory-aurora',
                  purchasedAt: Date.now(),
                },
              ],
          tournamentRewardClaims: [
            ...(state.tournamentRewardClaims ?? []),
            claimKey,
          ],
        }))
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
        const remaining = getWaterCycleRemainingMs(plant, now)
        if (remaining > 0) return 100

        // Once the custom water cycle expires, the plant wilts and loses HP.
        const overdueHours = Math.abs(remaining) / 3600000
        const hp = Math.max(0, Math.min(100, 100 - Math.floor(overdueHours * 6)))
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

      // ── User Sync ──

      refreshDailyNeighbors: async () => {
        const todayKey = getDayKey()
        const currentProfile = get().userProfile ?? getDefaultUserProfile()
        const cachedNeighbors = currentProfile.dailyNeighbors ?? []
        const cacheHasMissingImages = cachedNeighbors.some((neighbor) => !neighbor.imageUrl)
        if (currentProfile.lastMapRefresh === todayKey && !cacheHasMissingImages) {
          return
        }

        const ownerUid = getOrCreateOwnerUid()
        const fallbackNeighbors = get().friendPlants.slice(0, DAILY_NEIGHBOR_LIMIT)
        let nextNeighbors = fallbackNeighbors

        if (ownerUid) {
          try {
            const { fetchRandomPublicPlants } = await import('@/lib/firebase/plant-sync')
            const publicNeighbors = await fetchRandomPublicPlants(DAILY_NEIGHBOR_LIMIT, ownerUid)
            if (publicNeighbors.length > 0) {
              nextNeighbors = publicNeighbors.map((neighbor) => ({
                id: `${neighbor.ownerUid}_${neighbor.plantId}`,
                ownerUid: neighbor.ownerUid,
                plantId: neighbor.plantId,
                name: neighbor.name,
                description: neighbor.description ?? '',
                imageUrl: neighbor.imageUrl,
                plantGroup: neighbor.plantGroup,
                waterCycle: neighbor.waterCycle,
                lastWatered: neighbor.lastWatered,
                hp: neighbor.hp,
                placedItems: neighbor.placedItems ?? [],
                lastUpdated: neighbor.lastUpdated,
                addedAt: Date.now(),
              }))
            }
          } catch (error) {
            console.warn('Daily neighbor refresh failed', error)
          }
        }

        const profile: UserProfile = {
          ...getDefaultUserProfile(),
          ...currentProfile,
          dailyNeighbors: nextNeighbors,
          lastMapRefresh: todayKey,
          updatedAt: Date.now(),
        }

        set({ userProfile: profile })
        syncUserProfileRecord(profile)
      },

      updateUserAvatar: (avatarUrl) => {
        const currentProfile = get().userProfile ?? getDefaultUserProfile()
        const profile: UserProfile = {
          ...getDefaultUserProfile(),
          ...currentProfile,
          avatarUrl,
          updatedAt: Date.now(),
        }

        set({ userProfile: profile })

        const ownerUid = getOrCreateOwnerUid()
        if (!ownerUid) return

        import('@/lib/firebase/user-sync').then(({ updateUserAvatarInFirebase }) => {
          updateUserAvatarInFirebase(ownerUid, avatarUrl).catch(console.warn)
        })
      },

      updateAvatarFromBlob: async (blob) => {
        try {
          const localPreviewUrl = await blobToAvatarDataUrl(blob)
          if (!localPreviewUrl) return false

          get().updateUserAvatar(localPreviewUrl)
          return true
        } catch (error) {
          console.warn('Avatar preview failed', error)
          return false
        }
      },

      syncAvatarFromBlob: async (blob) => {
        const ownerUid = getOrCreateOwnerUid()
        if (!ownerUid) return false

        try {
          const { uploadUserAvatarToFirebase } = await import('@/lib/firebase/user-sync')
          const avatarUrl = await uploadUserAvatarToFirebase(ownerUid, blob)
          if (!avatarUrl) {
            return false
          }

          get().updateUserAvatar(avatarUrl)
          return true
        } catch (error) {
          console.warn('Avatar sync failed', error)
          return false
        }
      },
    }),
    {
      name: 'plantcraft-storage',
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as Partial<GameState> | undefined
        if (!state) {
          return {
            coins: 100,
            level: 1,
            xp: 0,
            plants: [],
            ownedItems: [],
            careLogs: [],
            rewardHistory: [],
            missionClaims: [],
            tournamentVotes: [],
            tournamentRewardClaims: [],
            friendPlants: [],
            userProfile: getDefaultUserProfile(),
          }
        }

        const plants = (state.plants ?? []).map((plant) => {
          const plantGroup = plant.plantGroup ?? 'default'
          const waterCycle = Number.isFinite(plant.waterCycle) && plant.waterCycle > 0
            ? plant.waterCycle
            : getPlantGroupConfig(plantGroup).waterCycleMs

          return {
            ...plant,
            plantGroup,
            waterCycle,
          }
        })

        return {
          coins: state.coins ?? 100,
          level: state.level ?? 1,
          xp: state.xp ?? 0,
          plants,
          ownedItems: state.ownedItems ?? [],
          careLogs: state.careLogs ?? [],
          rewardHistory: state.rewardHistory ?? [],
          missionClaims: state.missionClaims ?? [],
          tournamentVotes: state.tournamentVotes ?? [],
          tournamentRewardClaims: state.tournamentRewardClaims ?? [],
          friendPlants: state.friendPlants ?? [],
          userProfile: {
            ...getDefaultUserProfile(),
            ...(state.userProfile ?? {}),
            dailyNeighbors: state.userProfile?.dailyNeighbors ?? [],
          },
        }
      },
      partialize: (state) => ({
        coins: state.coins,
        level: state.level,
        xp: state.xp,
        plants: state.plants,
        ownedItems: state.ownedItems,
        careLogs: state.careLogs,
        rewardHistory: state.rewardHistory,
        missionClaims: state.missionClaims,
        tournamentVotes: state.tournamentVotes,
        tournamentRewardClaims: state.tournamentRewardClaims,
        friendPlants: state.friendPlants,
        userProfile: state.userProfile,
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
  {
    id: 'vfx-victory-aurora',
    name: 'Victory Aurora',
    description: 'Exclusive monthly tournament AR reward with golden orbit and aurora ribbons.',
    price: 0,
    category: 'vfx',
    rarity: 'legendary',
    imageUrl: '/items/vfx-victory-aurora.png',
    createdAt: new Date('2026-06-15'),
    exclusive: true,
  },
]
