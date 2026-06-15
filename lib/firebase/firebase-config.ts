/**
 * Firebase Configuration — Lazy & Safe
 * App builds fine even if firebase package is NOT installed.
 * Firebase only activates when NEXT_PUBLIC_FIREBASE_API_KEY is set AND firebase package exists.
 */

async function getFirebaseApp() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey) return null

  try {
    const { initializeApp, getApps } = await import('firebase/app' as string) as typeof import('firebase/app')

    const config = {
      apiKey,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    }

    return getApps().length ? getApps()[0] : initializeApp(config)
  } catch {
    // firebase package not installed yet
    return null
  }
}

export async function getFirebaseDB() {
  try {
    const app = await getFirebaseApp()
    if (!app) return null

    const { getDatabase } = await import('firebase/database' as string) as typeof import('firebase/database')
    return getDatabase(app)
  } catch {
    return null
  }
}

export async function getFirebaseStorage() {
  try {
    const app = await getFirebaseApp()
    if (!app) return null

    const { getStorage } = await import('firebase/storage' as string) as typeof import('firebase/storage')
    return getStorage(app)
  } catch {
    return null
  }
}
