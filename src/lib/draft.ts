import { useSyncExternalStore } from 'react'
import { readCached, notifyStoreChanged, subscribeToStore } from './localStorageStore'
import type { Item, Person, Step } from './types'

const KEY = 'checkplease:draft'

// An in-progress split, saved so a refresh or a phone call doesn't lose it.
// The receipt photo is deliberately absent: a File can't be serialized, and by
// the Review step the extracted items are what matter.
export interface SplitDraft {
  sessionId: string
  createdAt: string    // ISO; becomes Session.createdAt when saved
  savedAt: string      // ISO; when the draft was last written
  step: Step
  completedSteps: Step[]
  people: Person[]
  items: Item[]
  subtotal: number
  tax: number
  tip: number
  total: number
  label?: string
  currency?: string
}

const EMPTY: SplitDraft | null = null

const cache = { raw: null as string | null, value: EMPTY }

// Nothing entered yet — not worth offering to resume.
function isEmpty(draft: SplitDraft): boolean {
  return draft.people.length === 0 && draft.items.length === 0
}

export function getDraft(): SplitDraft | null {
  const draft = readCached<SplitDraft | null>(KEY, cache, EMPTY)
  if (!draft || !Array.isArray(draft.people) || !Array.isArray(draft.items)) return null
  return isEmpty(draft) ? null : draft
}

export function saveDraft(draft: SplitDraft): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(draft))
  notifyStoreChanged()
}

export function clearDraft(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEY)
  notifyStoreChanged()
}

export function useDraft(): SplitDraft | null {
  return useSyncExternalStore(subscribeToStore, getDraft, () => EMPTY)
}
