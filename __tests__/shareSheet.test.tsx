/**
 * @jest-environment jsdom
 */
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useShareActions } from '../src/hooks/useShareActions'
import type { Session } from '../src/lib/types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const session: Session = {
  id: 's', createdAt: '2026-09-15T19:00:00.000Z', label: 'Taco House',
  people: [{ id: 'a', name: 'Alex' }],
  items: [{ id: '1', name: 'Tacos', price: 10, assignedTo: ['a'] }],
  subtotal: 10, tax: 0, tip: 0, total: 10,
}

type Actions = ReturnType<typeof useShareActions>
const latest: { current: Actions | null } = { current: null }
const writeText = jest.fn()
let root: Root
let container: HTMLDivElement

// Published from an effect rather than during render, so the hook's return
// value can be driven directly without a side effect in render.
function Harness() {
  const result = useShareActions(session, [])
  useEffect(() => { latest.current = result })
  return null
}

const actions = {
  get toast() { return latest.current!.toast },
  shareLink: () => latest.current!.shareLink(),
}

function setShare(impl: (() => Promise<void>) | undefined) {
  Object.defineProperty(navigator, 'share', { value: impl, configurable: true })
}

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  container = document.createElement('div')
  root = createRoot(container)
  act(() => root.render(<Harness />))
})

afterEach(() => {
  act(() => root.unmount())
  setShare(undefined)
})

describe('shareLink with a native share sheet', () => {
  it('does nothing when the user dismisses the sheet', async () => {
    setShare(() => Promise.reject(new DOMException('Share canceled', 'AbortError')))

    await act(() => actions.shareLink())

    expect(writeText).not.toHaveBeenCalled()
    expect(actions.toast).toBeNull()
  })

  it('falls back to the clipboard when sharing fails for another reason', async () => {
    setShare(() => Promise.reject(new DOMException('Not allowed', 'NotAllowedError')))

    await act(() => actions.shareLink())

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/share#'))
    expect(actions.toast).toBe('Link copied to clipboard!')
  })

  it('shows no toast after a successful share', async () => {
    setShare(() => Promise.resolve())

    await act(() => actions.shareLink())

    expect(writeText).not.toHaveBeenCalled()
    expect(actions.toast).toBeNull()
  })
})

describe('shareLink without a native share sheet', () => {
  it('copies to the clipboard', async () => {
    setShare(undefined)

    await act(() => actions.shareLink())

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/share#'))
    expect(actions.toast).toBe('Link copied to clipboard!')
  })
})
