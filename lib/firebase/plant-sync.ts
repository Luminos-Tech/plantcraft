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
  hp: number
  species?: string
  placedItems: SharedPlacedItem[]
  lastUpdated: number
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

export async function publishToFirebase(
  plant: Plant,
  ownerUid: string,
  hp: number
): Promise<boolean> {
  try {
    const db = await getDB()
    if (!db) return false

    const { ref, set } = await import('firebase/database' as string) as typeof import('firebase/database')

    // Map local PlacedItems to Firebase format
    const sharedItems: SharedPlacedItem[] = (plant.placedItems || [])
      .filter(item => plant.isPublic || item.isShared)
      .map(item => ({
        id: item.id,
        itemId: item.itemId,
        anchorX: item.anchorX,
        anchorY: item.anchorY,
        scaleRatio: item.scaleRatio,
      }))

    const data: PublicPlantData = {
      name: plant.name,
      hp,
      placedItems: sharedItems,
      lastUpdated: Date.now(),
    }

    await set(ref(db, `plantcraft-public/${ownerUid}/${plant.id}`), data)
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
  onData: (data: PublicPlantData | null) => void
): Promise<(() => void) | null> {
  try {
    const db = await getDB()
    if (!db) return null

    const { ref, onValue, off } = await import('firebase/database' as string) as typeof import('firebase/database')
    const plantRef = ref(db, `plantcraft-public/${ownerUid}/${plantId}`)

    const callback = onValue(plantRef, (snapshot) => {
      onData(snapshot.exists() ? (snapshot.val() as PublicPlantData) : null)
    })

    return () => off(plantRef, 'value', callback)
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
    return snapshot.exists() ? (snapshot.val() as PublicPlantData) : null
  } catch {
    return null
  }
}
