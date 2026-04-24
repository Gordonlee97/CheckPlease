const KEY = 'checkplease:saved-names'

export interface SavedName {
  name: string
  usedAt: string // ISO
}

export function getSavedNames(): SavedName[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch { return [] }
}

export function recordNames(names: string[]): void {
  if (typeof window === 'undefined') return
  let saved = getSavedNames()
  for (const name of names) {
    saved = saved.filter(n => n.name.toLowerCase() !== name.toLowerCase())
    saved.unshift({ name, usedAt: new Date().toISOString() })
  }
  localStorage.setItem(KEY, JSON.stringify(saved.slice(0, 50)))
}

export function forgetName(name: string): void {
  if (typeof window === 'undefined') return
  const saved = getSavedNames().filter(n => n.name.toLowerCase() !== name.toLowerCase())
  localStorage.setItem(KEY, JSON.stringify(saved))
}
