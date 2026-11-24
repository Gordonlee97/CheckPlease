/**
 * @jest-environment jsdom
 */
import { getSavedGroups, saveGroup } from '../src/lib/savedGroups'
import { getSavedNames, recordNames } from '../src/lib/savedNames'
import { getMyVenmoHandle, setMyVenmoHandle } from '../src/lib/userSettings'
import { saveDraft, clearDraft, type SplitDraft } from '../src/lib/draft'

const draft: SplitDraft = {
  sessionId: 's1', createdAt: '2026-11-20T18:00:00.000Z', savedAt: '2026-11-20T18:05:00.000Z',
  step: 'people', completedSteps: [],
  people: [{ id: 'p1', name: 'Alex' }], items: [],
  subtotal: 0, tax: 0, tip: 0, total: 0,
}

beforeEach(() => {
  localStorage.clear()
  jest.restoreAllMocks()
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

// Valid JSON of the wrong shape (an old version, another app on the origin, a
// hand edit) reached callers that call .map/.find on it and crashed the page.
describe('stored data of the wrong shape', () => {
  it('reads as empty instead of crashing', () => {
    localStorage.setItem('checkplease:saved-groups', '{}')
    localStorage.setItem('checkplease:saved-names', '"Alex"')
    localStorage.setItem('checkplease:user-settings', 'null')

    expect(getSavedGroups()).toEqual([])
    expect(getSavedNames()).toEqual([])
    expect(getMyVenmoHandle()).toBeUndefined()
  })

  it('can be written over normally', () => {
    localStorage.setItem('checkplease:saved-groups', '{}')
    saveGroup({ name: 'Roommates', people: [{ name: 'Jo', color: '#888' }] })
    expect(getSavedGroups().map(g => g.name)).toEqual(['Roommates'])
  })
})

// Storage can be blocked outright (site data disabled) or full; either throws.
describe('storage that throws', () => {
  it('reads as empty when reading is blocked', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError') })
    expect(getSavedGroups()).toEqual([])
    expect(getSavedNames()).toEqual([])
    expect(getMyVenmoHandle()).toBeUndefined()
  })

  it('does not throw when a write fails', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError') })
    expect(() => saveGroup({ name: 'Roommates', people: [] })).not.toThrow()
    expect(() => recordNames(['Alex'])).not.toThrow()
    expect(() => setMyVenmoHandle('me')).not.toThrow()
    expect(() => saveDraft(draft)).not.toThrow()
    expect(() => clearDraft()).not.toThrow()
  })
})
