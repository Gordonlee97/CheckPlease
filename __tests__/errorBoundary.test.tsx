/**
 * @jest-environment jsdom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import ErrorPage from '../src/app/error'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  jest.restoreAllMocks()
})

function render(retry = jest.fn()) {
  const error = Object.assign(new Error('computeSplit exploded'), { digest: 'abc123' })
  act(() => root.render(<ErrorPage error={error} unstable_retry={retry} />))
  return { retry, error }
}

const button = (label: string) =>
  [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === label)

describe('route error boundary', () => {
  it('explains the failure instead of showing a blank screen', () => {
    render()
    expect(container.textContent).toMatch(/something went wrong/i)
    // the split data lives in the browser; say so rather than implying it is lost
    expect(container.textContent).toMatch(/splits are still saved/i)
  })

  it('offers a retry that asks Next to re-render the segment', () => {
    const { retry } = render()
    act(() => button('Try again')!.click())
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('always offers a way back home, even if retrying keeps failing', () => {
    render()
    const home = container.querySelector('a[href="/"]')
    expect(home).not.toBeNull()
  })

  it('logs the error for diagnosis but does not show the raw message', () => {
    const { error } = render()
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[error boundary]'), error)
    expect(container.textContent).not.toContain('computeSplit exploded')
  })

  it('surfaces the digest so a report can be matched to server logs', () => {
    render()
    expect(container.textContent).toContain('abc123')
  })
})
