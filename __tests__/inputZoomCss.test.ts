import { readFileSync } from 'fs'
import { join } from 'path'

// iOS Safari zooms the page when a text field under 16px is focused, and
// doesn't zoom back out. globals.css forces form controls to 16px, but the
// rule only wins if it sits outside every @layer: Tailwind v4's utilities
// layer (text-sm on Input, for one) beats anything in @layer base.
// jsdom can't resolve cascade layers, so this checks the stylesheet itself.

const css = readFileSync(join(__dirname, '../src/app/globals.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

interface Rule { selector: string; body: string; layered: boolean }

// Flat list of style rules, each marked with whether an @layer encloses it
function rules(source: string): Rule[] {
  const out: Rule[] = []
  const stack: { prelude: string }[] = []
  let prelude = ''
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (ch === '{') {
      const p = prelude.trim()
      const isGroup = p.startsWith('@')
      if (isGroup) {
        stack.push({ prelude: p })
      } else {
        const end = source.indexOf('}', i)
        out.push({ selector: p, body: source.slice(i + 1, end), layered: stack.some(s => s.prelude.startsWith('@layer')) })
        i = end
      }
      prelude = ''
    } else if (ch === '}') {
      stack.pop()
      prelude = ''
    } else if (ch === ';' && stack.length === 0) {
      prelude = '' // top-level at-statements like @import
    } else {
      prelude += ch
    }
  }
  return out
}

describe('globals.css: no iOS zoom on focusing a text field', () => {
  const zoomGuard = rules(css).filter(r =>
    ['input', 'select', 'textarea'].every(tag => r.selector.split(',').map(s => s.trim()).includes(tag)) &&
    /font-size:\s*max\(16px/.test(r.body)
  )

  it('forces inputs, selects and textareas to at least 16px', () => {
    expect(zoomGuard).toHaveLength(1)
  })

  it('does so outside any @layer, so Tailwind text-size utilities cannot override it', () => {
    expect(zoomGuard[0]?.layered).toBe(false)
  })
})
