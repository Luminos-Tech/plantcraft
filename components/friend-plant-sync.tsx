'use client'

import { useEffect, useMemo } from 'react'
import { subscribeToPlant } from '@/lib/firebase/plant-sync'
import { useGameStore } from '@/lib/store'

export function FriendPlantSync() {
  const { friendPlants, updateFriendPlant } = useGameStore()

  const subscriptionKey = useMemo(() => {
    return friendPlants
      .map((friend) => `${friend.id}:${friend.ownerUid}:${friend.plantId}`)
      .sort()
      .join('|')
  }, [friendPlants])

  const friendRefs = useMemo(() => {
    return friendPlants.map((friend) => ({
      id: friend.id,
      ownerUid: friend.ownerUid,
      plantId: friend.plantId,
    }))
  // The subscription set should only change when ids/owners/plants change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionKey])

  useEffect(() => {
    if (!subscriptionKey) return

    let cancelled = false
    const unsubscribers: Array<() => void> = []

    friendRefs.forEach((friend) => {
      subscribeToPlant(friend.ownerUid, friend.plantId, (data) => {
        if (cancelled || !data) return

        updateFriendPlant(friend.id, {
          name: data.name,
          description: data.description,
          imageUrl: data.imageUrl,
          plantGroup: data.plantGroup,
          waterCycle: data.waterCycle,
          lastWatered: data.lastWatered,
          hp: data.hp,
          placedItems: data.placedItems ?? [],
          lastUpdated: data.lastUpdated,
        })
      }).then((unsubscribe) => {
        if (cancelled) {
          unsubscribe?.()
          return
        }
        if (unsubscribe) unsubscribers.push(unsubscribe)
      })
    })

    return () => {
      cancelled = true
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [friendRefs, subscriptionKey, updateFriendPlant])

  return null
}
