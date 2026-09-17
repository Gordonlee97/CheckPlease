/**
 * @jest-environment jsdom
 */
import { saveDraft, getDraft, clearDraft, type SplitDraft } from '../src/lib/draft'

const base: SplitDraft = {
  sessionId: 's1',
  createdAt: '2026-09-16T18:00:00.000Z',
  savedAt: '2026-09-16T18:05:00.000Z',
  step: 'review',
  completedSteps: ['people', 'scan'],
  people: [{ id: 'p1', name: 'Alex' }, { id: 'p2', name: 'Sam' }],
  items: [{ id: 'i1', name: 'Tacos', price: 12, assignedTo: [] }],
  subtotal: 12, tax: 1, tip: 2, total: 15,
  label: 'Taco House',
}

beforeEach(() => localStorage.clear())

describe('split draft', () => {
  it('round-trips a draft', () => {
    saveDraft(base)
    expect(getDraft()).toEqual(base)
  })

  it('clears a draft', () => {
    saveDraft(base)
    clearDraft()
    expect(getDraft()).toBeNull()
  })

  it('has no draft when nothing was saved', () => {
    expect(getDraft()).toBeNull()
  })

  // Opening the wizard and backing out shouldn't leave a resume card behind
  it('ignores a draft with no people and no items', () => {
    saveDraft({ ...base, people: [], items: [], step: 'people', completedSteps: [] })
    expect(getDraft()).toBeNull()
  })

  it('keeps a draft that has people but no items yet', () => {
    saveDraft({ ...base, items: [], step: 'scan' })
    expect(getDraft()?.people).toHaveLength(2)
  })

  it('survives corrupt storage', () => {
    localStorage.setItem('checkplease:draft', '{not json')
    expect(getDraft()).toBeNull()
  })
})
