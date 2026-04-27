import { v4 as uuidv4 } from 'uuid'

const KEY = 'checkplease:saved-groups'

export interface GroupPerson {
  name: string
  color: string
  venmoHandle?: string
}

export interface SavedGroup {
  id: string
  name: string
  people: GroupPerson[]
  updatedAt: string
}

export function getSavedGroups(): SavedGroup[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch { return [] }
}

export function getSavedGroup(id: string): SavedGroup | null {
  return getSavedGroups().find(g => g.id === id) ?? null
}

export function saveGroup(group: Omit<SavedGroup, 'id' | 'updatedAt'> & { id?: string }): SavedGroup {
  if (typeof window === 'undefined') return { ...group, id: group.id ?? uuidv4(), updatedAt: new Date().toISOString(), people: group.people }
  const groups = getSavedGroups()
  const id = group.id ?? uuidv4()
  const updated: SavedGroup = { ...group, id, updatedAt: new Date().toISOString() }
  const existing = groups.findIndex(g => g.id === id)
  if (existing >= 0) groups[existing] = updated
  else groups.unshift(updated)
  localStorage.setItem(KEY, JSON.stringify(groups))
  return updated
}

export function deleteGroup(id: string): void {
  if (typeof window === 'undefined') return
  const groups = getSavedGroups().filter(g => g.id !== id)
  localStorage.setItem(KEY, JSON.stringify(groups))
}
