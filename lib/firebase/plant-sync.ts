/**
 * Firebase Plant Sync — Safe when firebase is not installed.
 * All functions return null/false gracefully if firebase package is missing.
 */

import { getDecorationPlacement, type DecorationSlot, type PlacedItem, type Plant } from '@/lib/store'

const DECORATION_SLOTS = new Set<DecorationSlot>(['top', 'face', 'base', 'aura'])

export interface SharedPlacedItem {
  id: string
  itemId: string
  placementSlot?: DecorationSlot
  anchorX?: number
  anchorY?: number
  scaleRatio?: number
}

export interface PublicPlantData {
  ownerUid?: string
  plantId?: string
  name: string
  description: string
  imageUrl?: string
  plantGroup?: Plant['plantGroup']
  waterCycle?: number
  lastWatered?: number
  hp: number
  species?: string
  placedItems: SharedPlacedItem[]
  lastUpdated: number
}

export interface PublicNeighborPlant extends PublicPlantData {
  ownerUid: string
  plantId: string
}

type FirebasePlacedItems = SharedPlacedItem[] | Record<string, SharedPlacedItem | null>

export interface OwnedPlantData {
  id: string
  name: string
  description: string
  imageUrl: string
  plantGroup: Plant['plantGroup']
  waterCycle: number
  water_cycle: number
  hp: number
  lastWatered: number
  last_watered_time: number
  lastWipedAt: number
  createdAt: number
  isPublic: boolean
  pendingDiagnosis: Plant['pendingDiagnosis']
  pendingDiagnosisAt: Plant['pendingDiagnosisAt']
  placedItems: FirebasePlacedItems
  updatedAt: number
}

export interface QRPayload {
  app: 'plantcraft'
  plantId: string
  ownerUid: string
  version: 1
}

async function getDB() {
  try {
    const { getFirebaseDB } = await import('./firebase-config')
    return await getFirebaseDB()
  } catch {
    return null
  }
}

function normalizePlacementSlot(value: unknown): DecorationSlot | undefined {
  return typeof value === 'string' && DECORATION_SLOTS.has(value as DecorationSlot)
    ? value as DecorationSlot
    : undefined
}

function getSharedPlacementSlot(itemId: string, placementSlot: unknown): DecorationSlot {
  return getDecorationPlacement(itemId, normalizePlacementSlot(placementSlot)).placementSlot
}

function dedupeSharedItemsBySlot(items: SharedPlacedItem[]): SharedPlacedItem[] {
  const bySlot = new Map<DecorationSlot, SharedPlacedItem>()

  for (const item of items) {
    const placementSlot = getSharedPlacementSlot(item.itemId, item.placementSlot)
    bySlot.set(placementSlot, {
      ...item,
      placementSlot,
    })
  }

  return [...bySlot.values()]
}

function normalizePlacedItems(value: unknown): SharedPlacedItem[] {
  if (!value) return []

  const rawItems = Array.isArray(value)
    ? value
    : typeof value === 'object'
      ? Object.values(value as Record<string, unknown>)
      : []

  const normalized = rawItems.flatMap((item) => {
    if (!item || typeof item !== 'object') return []

    const candidate = item as Partial<SharedPlacedItem>
    if (typeof candidate.id !== 'string' || typeof candidate.itemId !== 'string') {
      return []
    }

    const placementSlot = getSharedPlacementSlot(candidate.itemId, candidate.placementSlot)

    return [{
      id: candidate.id,
      itemId: candidate.itemId,
      placementSlot,
      anchorX: typeof candidate.anchorX === 'number' ? candidate.anchorX : undefined,
      anchorY: typeof candidate.anchorY === 'number' ? candidate.anchorY : undefined,
      scaleRatio: typeof candidate.scaleRatio === 'number' ? candidate.scaleRatio : undefined,
    }]
  })

  const uniqueById = [...new Map(normalized.map((item) => [item.id, item])).values()]
  return dedupeSharedItemsBySlot(uniqueById)
}

function normalizePublicPlantData(value: unknown): PublicPlantData | null {
  if (!value || typeof value !== 'object') return null

  const data = value as Partial<Omit<PublicPlantData, 'placedItems'>> & {
    placedItems?: unknown
    plant_group?: unknown
    water_cycle?: unknown
    last_watered_time?: unknown
  }

  return {
    ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : undefined,
    plantId: typeof data.plantId === 'string' ? data.plantId : undefined,
    name: typeof data.name === 'string' ? data.name : 'Friend Plant',
    description: typeof data.description === 'string' ? data.description : '',
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : undefined,
    plantGroup: typeof data.plantGroup === 'string'
      ? data.plantGroup as Plant['plantGroup']
      : typeof data.plant_group === 'string'
        ? data.plant_group as Plant['plantGroup']
        : undefined,
    waterCycle: typeof data.waterCycle === 'number'
      ? data.waterCycle
      : typeof data.water_cycle === 'number'
        ? data.water_cycle
        : undefined,
    lastWatered: typeof data.lastWatered === 'number'
      ? data.lastWatered
      : typeof data.last_watered_time === 'number'
        ? data.last_watered_time
        : undefined,
    hp: typeof data.hp === 'number' ? Math.max(0, Math.min(100, data.hp)) : 0,
    species: typeof data.species === 'string' ? data.species : undefined,
    placedItems: normalizePlacedItems(data.placedItems),
    lastUpdated: typeof data.lastUpdated === 'number' ? data.lastUpdated : Date.now(),
  }
}

function normalizeOwnedPlantData(value: unknown): Pick<PublicPlantData, 'imageUrl'> | null {
  if (!value || typeof value !== 'object') return null

  const data = value as Partial<OwnedPlantData>
  return {
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : undefined,
  }
}

function serializePlacedItems(plant: Plant, sharedOnly: boolean): FirebasePlacedItems {
  const sharedItems = dedupeSharedItemsBySlot(
    (plant.placedItems || [])
      .filter(item => !sharedOnly || plant.isPublic || item.isShared)
      .map(item => ({
        id: item.id,
        itemId: item.itemId,
        placementSlot: getSharedPlacementSlot(item.itemId, item.placementSlot),
        scaleRatio: item.scaleRatio,
      }))
  )

  return Object.fromEntries(sharedItems.map((item) => [item.id, item]))
}

export async function publishToFirebase(
  plant: Plant,
  ownerUid: string,
  hp: number
): Promise<boolean> {
  try {
    const db = await getDB()
    if (!db) return false

    const { ref, set } = await import('firebase/database' as string) as typeof import('firebase/database')
    const now = Date.now()

    const data = {
      ownerUid,
      plantId: plant.id,
      name: plant.name,
      description: plant.description ?? '',
      imageUrl: plant.imageUrl,
      plantGroup: plant.plantGroup,
      plant_group: plant.plantGroup,
      waterCycle: plant.waterCycle,
      water_cycle: plant.waterCycle,
      lastWatered: plant.lastWatered,
      last_watered_time: plant.lastWatered,
      hp,
      placedItems: serializePlacedItems(plant, true),
      lastUpdated: now,
    }

    await set(ref(db, `plantcraft-public/${ownerUid}/${plant.id}`), data)
    return true
  } catch {
    return false
  }
}

export async function publishOwnedPlantToFirebase(
  plant: Plant,
  ownerUid: string,
  hp: number
): Promise<boolean> {
  try {
    const db = await getDB()
    if (!db) return false

    const { ref, set } = await import('firebase/database' as string) as typeof import('firebase/database')
    const now = Date.now()
    const data: OwnedPlantData = {
      id: plant.id,
      name: plant.name,
      description: plant.description ?? '',
      imageUrl: plant.imageUrl,
      plantGroup: plant.plantGroup,
      waterCycle: plant.waterCycle,
      water_cycle: plant.waterCycle,
      hp,
      lastWatered: plant.lastWatered,
      last_watered_time: plant.lastWatered,
      lastWipedAt: plant.lastWipedAt,
      createdAt: plant.createdAt,
      isPublic: plant.isPublic,
      pendingDiagnosis: plant.pendingDiagnosis ?? null,
      pendingDiagnosisAt: plant.pendingDiagnosisAt ?? null,
      placedItems: serializePlacedItems(plant, false),
      updatedAt: now,
    }

    await set(ref(db, `plantcraft-plants/${ownerUid}/${plant.id}`), data)
    return true
  } catch {
    return false
  }
}

export async function removeOwnedPlantFromFirebase(
  plantId: string,
  ownerUid: string
): Promise<boolean> {
  try {
    const db = await getDB()
    if (!db) return false

    const { ref, remove } = await import('firebase/database' as string) as typeof import('firebase/database')
    await remove(ref(db, `plantcraft-plants/${ownerUid}/${plantId}`))
    return true
  } catch {
    return false
  }
}

export async function unpublishFromFirebase(
  plantId: string,
  ownerUid: string
): Promise<boolean> {
  try {
    const db = await getDB()
    if (!db) return false

    const { ref, remove } = await import('firebase/database' as string) as typeof import('firebase/database')
    await remove(ref(db, `plantcraft-public/${ownerUid}/${plantId}`))
    return true
  } catch {
    return false
  }
}

export async function syncPlacedItemToFirebase(
  plantId: string,
  ownerUid: string,
  item: PlacedItem
): Promise<void> {
  if (!item.isShared) return
  
  try {
    const db = await getDB()
    if (!db) return

    const sharedItem: SharedPlacedItem = {
      id: item.id,
      itemId: item.itemId,
      placementSlot: getSharedPlacementSlot(item.itemId, item.placementSlot),
      scaleRatio: item.scaleRatio,
    }

    const { ref, set } = await import('firebase/database' as string) as typeof import('firebase/database')
    await set(ref(db, `plantcraft-public/${ownerUid}/${plantId}/placedItems/${item.id}`), sharedItem)
    await set(ref(db, `plantcraft-public/${ownerUid}/${plantId}/lastUpdated`), Date.now())
  } catch {}
}

export async function removeSharedItemFromFirebase(
  plantId: string,
  ownerUid: string,
  itemInstanceId: string
): Promise<void> {
  try {
    const db = await getDB()
    if (!db) return

    const { ref, remove, set } = await import('firebase/database' as string) as typeof import('firebase/database')
    await remove(ref(db, `plantcraft-public/${ownerUid}/${plantId}/placedItems/${itemInstanceId}`))
    await set(ref(db, `plantcraft-public/${ownerUid}/${plantId}/lastUpdated`), Date.now())
  } catch {}
}

export async function syncHPToFirebase(
  plantId: string,
  ownerUid: string,
  newHP: number
): Promise<void> {
  try {
    const db = await getDB()
    if (!db) return

    const { ref, set } = await import('firebase/database' as string) as typeof import('firebase/database')
    await set(ref(db, `plantcraft-public/${ownerUid}/${plantId}/hp`), newHP)
    await set(ref(db, `plantcraft-public/${ownerUid}/${plantId}/lastUpdated`), Date.now())
  } catch {
    // ignore
  }
}

export async function subscribeToPlant(
  ownerUid: string,
  plantId: string,
  onData: (data: PublicPlantData | null) => void,
  onError?: (error: Error) => void
): Promise<(() => void) | null> {
  try {
    const db = await getDB()
    if (!db) return null

    const { ref, onValue } = await import('firebase/database' as string) as typeof import('firebase/database')
    const plantRef = ref(db, `plantcraft-public/${ownerUid}/${plantId}`)

    return onValue(plantRef, (snapshot) => {
      onData(snapshot.exists() ? normalizePublicPlantData(snapshot.val()) : null)
    }, (error) => {
      onError?.(error)
    })
  } catch {
    return null
  }
}

export async function fetchPlantOnce(
  ownerUid: string,
  plantId: string
): Promise<PublicPlantData | null> {
  try {
    const db = await getDB()
    if (!db) return null

    const { ref, get } = await import('firebase/database' as string) as typeof import('firebase/database')
    const snapshot = await get(ref(db, `plantcraft-public/${ownerUid}/${plantId}`))
    return snapshot.exists() ? normalizePublicPlantData(snapshot.val()) : null
  } catch {
    return null
  }
}

function shuffleNeighbors<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5)
}

export async function fetchRandomPublicPlants(
  limit = 6,
  excludeOwnerUid?: string
): Promise<PublicNeighborPlant[]> {
  try {
    const db = await getDB()
    if (!db) return []

    const { ref, get } = await import('firebase/database' as string) as typeof import('firebase/database')
    const [publicSnapshot, ownedSnapshot] = await Promise.all([
      get(ref(db, 'plantcraft-public')),
      get(ref(db, 'plantcraft-plants')),
    ])
    if (!publicSnapshot.exists()) return []

    const root = publicSnapshot.val()
    if (!root || typeof root !== 'object') return []
    const ownedRoot = ownedSnapshot.exists() && ownedSnapshot.val() && typeof ownedSnapshot.val() === 'object'
      ? ownedSnapshot.val() as Record<string, unknown>
      : {}

    const neighbors: PublicNeighborPlant[] = []
    Object.entries(root as Record<string, unknown>).forEach(([ownerUid, ownerPlants]) => {
      if (ownerUid === excludeOwnerUid) return
      if (!ownerPlants || typeof ownerPlants !== 'object') return

      Object.entries(ownerPlants as Record<string, unknown>).forEach(([plantId, value]) => {
        const normalized = normalizePublicPlantData(value)
        if (!normalized) return
        const ownedPlant = ownerUid in ownedRoot && ownedRoot[ownerUid] && typeof ownedRoot[ownerUid] === 'object'
          ? normalizeOwnedPlantData((ownedRoot[ownerUid] as Record<string, unknown>)[plantId])
          : null

        neighbors.push({
          ...normalized,
          imageUrl: normalized.imageUrl || ownedPlant?.imageUrl,
          ownerUid,
          plantId,
        })
      })
    })

    return shuffleNeighbors(neighbors)
      .slice(0, Math.max(0, limit))
  } catch {
    return []
  }
}
