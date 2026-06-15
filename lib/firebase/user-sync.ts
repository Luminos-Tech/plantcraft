/**
 * Firebase User Sync - safe when Firebase is not configured.
 */

import type { FriendPlant, UserProfile } from '@/lib/store'

interface FirebaseUserData {
  avatar_url: string
  avatarUrl: string
  daily_neighbors: FriendPlant[]
  dailyNeighbors: FriendPlant[]
  last_map_refresh: string | null
  lastMapRefresh: string | null
  updated_at: number
  updatedAt: number
}

async function getDB() {
  try {
    const { getFirebaseDB } = await import('./firebase-config')
    return await getFirebaseDB()
  } catch {
    return null
  }
}

async function getStorage() {
  try {
    const { getFirebaseStorage } = await import('./firebase-config')
    return await getFirebaseStorage()
  } catch {
    return null
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('timeout')), timeoutMs)
    promise
      .then(resolve, reject)
      .finally(() => window.clearTimeout(timeout))
  })
}

function serializeUserProfile(profile: UserProfile): FirebaseUserData {
  const now = Date.now()
  const updatedAt = profile.updatedAt || now

  return {
    avatar_url: profile.avatarUrl ?? '',
    avatarUrl: profile.avatarUrl ?? '',
    daily_neighbors: profile.dailyNeighbors ?? [],
    dailyNeighbors: profile.dailyNeighbors ?? [],
    last_map_refresh: profile.lastMapRefresh ?? null,
    lastMapRefresh: profile.lastMapRefresh ?? null,
    updated_at: updatedAt,
    updatedAt,
  }
}

export async function publishUserProfileToFirebase(
  ownerUid: string,
  profile: UserProfile
): Promise<boolean> {
  try {
    const db = await getDB()
    if (!db) return false

    const { ref, set } = await import('firebase/database' as string) as typeof import('firebase/database')
    await set(ref(db, `plantcraft-users/${ownerUid}`), serializeUserProfile(profile))
    return true
  } catch {
    return false
  }
}

export async function updateUserAvatarInFirebase(
  ownerUid: string,
  avatarUrl: string
): Promise<boolean> {
  try {
    const db = await getDB()
    if (!db) return false

    const { ref, update } = await import('firebase/database' as string) as typeof import('firebase/database')
    const now = Date.now()
    await update(ref(db, `plantcraft-users/${ownerUid}`), {
      avatar_url: avatarUrl,
      avatarUrl,
      updated_at: now,
      updatedAt: now,
    })
    return true
  } catch {
    return false
  }
}

export async function uploadUserAvatarToFirebase(
  ownerUid: string,
  blob: Blob
): Promise<string | null> {
  try {
    const storage = await getStorage()
    if (!storage) return null

    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage' as string) as typeof import('firebase/storage')
    const avatarRef = ref(storage, `plantcraft-users/${ownerUid}/avatar-${Date.now()}.jpg`)
    await withTimeout(uploadBytes(avatarRef, blob, {
      contentType: blob.type || 'image/jpeg',
    }), 6500)
    return await withTimeout(getDownloadURL(avatarRef), 3500)
  } catch {
    return null
  }
}
