/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Scan } from '../src/components/steps/Scan'
import { Review } from '../src/components/steps/Review'

// uuid v14 is ESM-only, which Jest's CommonJS runtime can't load
jest.mock('uuid', () => {
  let n = 0
  return { v4: () => `id-${++n}` }
})

jest.mock('../src/lib/imageUtils', () => ({
  resizeImage: jest.fn().mockResolvedValue('data:image/jpeg;base64,AAAA'),
  dataUrlToBase64: jest.fn().mockReturnValue('AAAA'),
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  URL.createObjectURL = jest.fn(() => 'blob:preview')
  URL.revokeObjectURL = jest.fn()
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const findButton = (label: string) =>
  [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === label)

describe('Scan: manual entry', () => {
  it('offers manual entry before any photo is chosen', () => {
    const onManualEntry = jest.fn()
    act(() => root.render(<Scan onDone={jest.fn()} onManualEntry={onManualEntry} />))
    act(() => findButton('Enter items manually')!.click())
    expect(onManualEntry).toHaveBeenCalledTimes(1)
  })

  it('offers manual entry after a photo is chosen', () => {
    const file = new File(['x'], 'receipt.jpg', { type: 'image/jpeg' })
    act(() => root.render(<Scan initialFile={file} onDone={jest.fn()} onManualEntry={jest.fn()} />))
    expect(findButton('Enter items manually')).toBeDefined()
  })

  it('offers manual entry when the scan fails, and hides it while scanning', async () => {
    let rejectFetch!: (err: Error) => void
    global.fetch = jest.fn(() => new Promise((_, reject) => { rejectFetch = reject })) as jest.Mock
    const file = new File(['x'], 'receipt.jpg', { type: 'image/jpeg' })
    const onManualEntry = jest.fn()
    const ref = { current: null as { submit: () => void } | null }
    act(() => root.render(<Scan ref={ref} initialFile={file} onDone={jest.fn()} onManualEntry={onManualEntry} />))

    await act(async () => { ref.current!.submit() })
    expect(findButton('Enter items manually')).toBeUndefined()

    await act(async () => { rejectFetch(new Error('Scan failed')) })
    expect(container.textContent).toContain('Could not read receipt')
    act(() => findButton('Enter items manually')!.click())
    expect(onManualEntry).toHaveBeenCalledTimes(1)
  })
})

describe('Review: starting rows', () => {
  const itemNameInputs = () => container.querySelectorAll('input[placeholder="Item name"]')

  it('starts with one blank row when there are no items', () => {
    act(() => root.render(<Review items={[]} tax={0} tip={0} onDone={jest.fn()} />))
    expect(itemNameInputs()).toHaveLength(1)
    expect((itemNameInputs()[0] as HTMLInputElement).value).toBe('')
  })

  it('shows existing items without adding a blank row', () => {
    const items = [
      { id: '1', name: 'Tacos', price: 12, assignedTo: [] },
      { id: '2', name: 'Soda', price: 3, assignedTo: [] },
    ]
    act(() => root.render(<Review items={items} tax={0} tip={0} onDone={jest.fn()} />))
    expect(itemNameInputs()).toHaveLength(2)
  })
})
