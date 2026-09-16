// Subscription plumbing so components can read localStorage through
// useSyncExternalStore instead of copying it into state inside an effect.
//
// Each store module keeps a parsed snapshot and registers an invalidator here.
// useSyncExternalStore requires getSnapshot() to return a referentially stable
// value while nothing has changed, hence the caching in those modules.

type Invalidate = () => void

const invalidators = new Set<Invalidate>()
const listeners = new Set<() => void>()

export function registerInvalidator(invalidate: Invalidate): void {
  invalidators.add(invalidate)
}

// Call after any write, once the writing module has cleared its own cache.
export function notifyStoreChanged(): void {
  listeners.forEach(listener => listener())
}

export function subscribeToStore(listener: () => void): () => void {
  listeners.add(listener)
  // 'storage' only fires for writes from other tabs; those bypass our caches.
  const onStorage = () => {
    invalidators.forEach(invalidate => invalidate())
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}
