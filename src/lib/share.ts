import LZString from 'lz-string'
import { z } from 'zod'
import type { Session } from './types'
import type { PersonShare } from './splitting'
import { formatMoney } from './money'

// A share link is untrusted input: anyone can hand-write the URL hash. Without
// this, a payload that merely looks like JSON reaches computeSplit and throws
// mid-render. z.number() already rejects NaN and Infinity, which JSON.parse
// will happily produce from something like 1e400.
const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
  venmoHandle: z.string().optional(),
})

const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  assignedTo: z.array(z.string()),
  confidence: z.number().optional(),
})

const SessionSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  label: z.string().optional(),
  currency: z.string().optional(),
  people: z.array(PersonSchema),
  items: z.array(ItemSchema),
  subtotal: z.number(),
  tax: z.number(),
  tip: z.number(),
  total: z.number(),
})

export function encodeSession(session: Session): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(session))
}

export function decodeSession(encoded: string): Session | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded)
    if (!json) return null
    // Unknown keys are dropped rather than carried into the app
    const result = SessionSchema.safeParse(JSON.parse(json))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function buildShareUrl(session: Session): string {
  const encoded = encodeSession(session)
  const base = process.env.NEXT_PUBLIC_SHARE_BASE_URL || window.location.origin
  return `${base}/share#${encoded}`
}

export function buildPlainText(session: Session, shares: PersonShare[], myVenmoHandle?: string): string {
  const date = new Date(session.createdAt).toLocaleDateString()
  const header = `CheckPlease — ${session.label ?? 'Dinner'} · ${date} · ${session.people.length} people · ${formatMoney(session.total, session.currency)} total`

  const personBlocks = shares.map(share => {
    const itemNames = share.assignedItems
      .map(i => i.shared ? `${i.name} (shared)` : i.name)
      .join(' · ')

    const breakdown = [
      `Items ${formatMoney(share.itemSubtotal, session.currency)}`,
      `Tax ${formatMoney(share.taxShare, session.currency)}`,
      share.tipShare > 0 && `Tip ${formatMoney(share.tipShare, session.currency)}`,
    ].filter(Boolean).join(' · ')

    return [
      share.name,
      itemNames,
      breakdown,
      `You owe: ${formatMoney(share.total, session.currency)}`,
    ].join('\n')
  })

  const footer = myVenmoHandle ? `\nVenmo @${myVenmoHandle} to settle up` : ''

  return [header, ...personBlocks].join('\n\n') + footer
}
