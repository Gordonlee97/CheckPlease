/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

// Canvas resizing isn't available in jsdom and isn't what's under test
jest.mock('../src/lib/imageUtils', () => ({
  resizeImage: async () => 'data:image/jpeg;base64,AAAA',
  dataUrlToBase64: (url: string) => url.split(',')[1],
}))

import { Scan } from '../src/components/steps/Scan'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement
const fetchMock = jest.fn()

beforeAll(() => {
  URL.createObjectURL = () => 'blob:preview'
  URL.revokeObjectURL = () => {}
})

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [], subtotal: 0, tax: 0, tip: 0, total: 0 }) })
  globalThis.fetch = fetchMock
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const receipt = () => new File(['x'], 'receipt.jpg', { type: 'image/jpeg' })

async function pickPhoto(file: File) {
  const input = container.querySelector('input[type="file"][capture]') as HTMLInputElement
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
}

describe('Scan: picking a photo', () => {
  it('starts scanning straight away, without a second tap on Scan Receipt', async () => {
    act(() => root.render(<Scan onDone={jest.fn()} />))
    await pickPhoto(receipt())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // Straight into scanning: no preview waiting on a Scan Receipt tap
    expect(container.querySelector('[role="status"]')?.textContent).toMatch(/Reading receipt|Almost done/)
  })

  it('does not rescan on its own when coming back to a photo already taken', async () => {
    await act(async () => root.render(<Scan initialFile={receipt()} onDone={jest.fn()} />))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('scans a retaken photo after a failed scan', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Too blurry' }) })
    act(() => root.render(<Scan onDone={jest.fn()} />))
    await pickPhoto(receipt())
    expect(container.textContent).toContain('Too blurry')

    await pickPhoto(receipt())
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  // Without the preview step, a wrong photo is only noticed once it's scanning
  it('lets a wrong photo be retaken mid-scan, and uses only the new one', async () => {
    let finishFirst!: (r: unknown) => void
    fetchMock
      .mockReturnValueOnce(new Promise(r => { finishFirst = r }))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ name: 'Right', price: 5 }], subtotal: 5, tax: 0, tip: 0, total: 5 }) })
    const onDone = jest.fn()
    act(() => root.render(<Scan onDone={onDone} />))

    await pickPhoto(receipt())
    expect(container.textContent).toContain('Retake')
    await pickPhoto(receipt())
    await act(async () => finishFirst({ ok: true, json: async () => ({ items: [{ name: 'Wrong', price: 9 }], subtotal: 9, tax: 0, tip: 0, total: 9 }) }))

    // The result is handed over once the scan line finishes its sweep
    const scanLine = container.querySelector('.animate-scan-line-once')!
    await act(async () => { scanLine.dispatchEvent(new Event('animationend', { bubbles: true })) })

    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onDone.mock.calls[0][0].items[0].name).toBe('Right')
  })
})
