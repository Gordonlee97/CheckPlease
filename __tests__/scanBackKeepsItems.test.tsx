/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
// Canvas resizing isn't available in jsdom and isn't what's under test
jest.mock('../src/lib/imageUtils', () => ({
  resizeImage: async () => 'data:image/jpeg;base64,AAAA',
  dataUrlToBase64: (url: string) => url.split(',')[1],
}))

import NewSplitPage from '../src/app/new/page'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement
const fetchMock = jest.fn()

beforeAll(() => {
  URL.createObjectURL = () => 'blob:preview'
  URL.revokeObjectURL = () => {}
  // jsdom has no layout, so element scrolling isn't implemented
  Element.prototype.scrollTo = () => {}
})

beforeEach(() => {
  localStorage.clear()
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ items: [{ name: 'Tacos', price: 12 }, { name: 'Beer', price: 6 }], subtotal: 18, tax: 0, tip: 0, total: 18 }),
  })
  globalThis.fetch = fetchMock
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const button = (text: string) =>
  [...container.querySelectorAll('button')].find(b => b.textContent?.includes(text)) as HTMLButtonElement | undefined

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function addPerson(name: string) {
  typeInto(container.querySelector('input[placeholder="Name"]') as HTMLInputElement, name)
  act(() => button('Add')!.click())
}

async function scanReceipt() {
  const input = container.querySelector('input[type="file"][capture]') as HTMLInputElement
  Object.defineProperty(input, 'files', { value: [new File(['x'], 'receipt.jpg', { type: 'image/jpeg' })], configurable: true })
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
  await scanLineEnd()
}

// A scan result is held until the scan line finishes its sweep
async function scanLineEnd() {
  const line = container.querySelector('.animate-scan-line-once')
  if (line) await act(async () => { line.dispatchEvent(new Event('animationend', { bubbles: true })) })
}

const itemNames = () =>
  [...container.querySelectorAll('input')].map(i => i.value)

describe('coming back to the Scan step after scanning', () => {
  it('keeps edited items when moving forward again, without rescanning', async () => {
    act(() => root.render(<NewSplitPage />))
    addPerson('Alex')
    addPerson('Sam')
    act(() => button("That's Everyone")!.click())
    await scanReceipt()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // On Review: fix a misread name
    const tacos = [...container.querySelectorAll('input')].find(i => i.value === 'Tacos')!
    typeInto(tacos, 'Fish tacos')

    act(() => button('← Back')!.click())
    // Back on Scan, the main button moves on with what's already there
    const forward = [...container.querySelectorAll('button')].at(-1)!
    const label = forward.textContent
    await act(async () => forward.click())
    await scanLineEnd()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(itemNames()).toContain('Fish tacos')
    expect(itemNames()).toContain('Beer')
    expect(label).not.toContain('Scan Receipt')
  })
})
