/**
 * Firebase Plant Sync — Safe when firebase is not installed.
 * All functions return null/false gracefully if firebase package is missing.
 */

import type { Plant } from '@/lib/store'

export interface SharedPlacedItem {
  id: string
  itemId: string
  anchorX: number
  anchorY: number
  scaleRatio: number
}

export interface PublicPlantData {
  name: string
  description: string
  hp: number
  species?: string
  placedItems: SharedPlacedItem[]
  lastUpdated: number
}

type FirebasePlacedItems = SharedPlacedItem[] | Record<string, SharedPlacedItem | null>

export interface OwnedPlantData {
  id: string
  name: string
  description: string
  imageUrl: string
  hp: number
  lastWatered: number
  lastWipedAt: number
  createdAt: number
  isPublic: boolean
  pendingDiagnosis: Plant['pendingDiagnosis']
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
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.itemId !== 'string' ||
      typeof candidate.anchorX !== 'number' ||
      typeof candidate.anchorY !== 'number' ||
      typeof candidate.scaleRatio !== 'number'
    ) {
      return []
    }

    return [{
      id: candidate.id,
      itemId: candidate.itemId,
      anchorX: candidate.anchorX,
      anchorY: candidate.anchorY,
      scaleRatio: candidate.scaleRatio,
    }]
  })

  return [...new Map(normalized.map((item) => [item.id, item])).values()]
}

function normalizePublicPlantData(value: unknown): PublicPlantData | null {
  if (!value || typeof value !== 'object') return null

  const data = value as Partial<Omit<PublicPlantData, 'placedItems'>> & {
    placedItems?: unknown
  }

  return {
    name: typeof data.name === 'string' ? data.name : 'Friend Plant',
    description: typeof data.description === 'string' ? data.description : '',
    hp: typeof data.hp === 'number' ? Math.max(0, Math.min(100, data.hp)) : 0,
    species: typeof data.species === 'string' ? data.species : undefined,
    placedItems: normalizePlacedItems(data.placedItems),
    lastUpdated: typeof data.lastUpdated === 'number' ? data.lastUpdated : Date.now(),
  }
}

function serializePlacedItems(plant: Plant, sharedOnly: boolean): FirebasePlacedItems {
  return Object.fromEntries((plant.placedItems || [])
    .filter(item => !sharedOnly || plant.isPublic || item.isShared)
    .map(item => ({
      id: item.id,
      itemId: item.itemId,
      anchorX: item.anchorX,
      anchorY: item.anchorY,
      scaleRatio: item.scaleRatio,
    }))
    .map((item) => [item.id, item]))
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

    const data = {
      name: plant.name,
      description: plant.description ?? '',
      hp,
      placedItems: serializePlacedItems(plant, true),
      lastUpdated: Date.now(),
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
      hp,
      lastWatered: plant.lastWatered,
      lastWipedAt: plant.lastWipedAt,
      createdAt: plant.createdAt,
      isPublic: plant.isPublic,
      pendingDiagnosis: plant.pendingDiagnosis ?? null,
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
  item: import('@/lib/store').PlacedItem
): Promise<void> {
  if (!item.isShared) return
  
  try {
    const db = await getDB()
    if (!db) return

    const sharedItem: SharedPlacedItem = {
      id: item.id,
      itemId: item.itemId,
      anchorX: item.anchorX,
      anchorY: item.anchorY,
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
