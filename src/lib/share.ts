import LZString from 'lz-string'
import type { Session } from './types'
import type { PersonShare } from './splitting'

export function encodeSession(session: Session): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(session))
}

export function decodeSession(encoded: string): Session | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded)
    if (!json) return null
    return JSON.parse(json) as Session
  } catch {
    return null
  }
}

export function buildShareUrl(session: Session): string {
  const encoded = encodeSession(session)
  return `${window.location.origin}/share#${encoded}`
}

export function buildPlainText(session: Session, shares: PersonShare[]): string {
  const date = new Date(session.createdAt).toLocaleDateString()
  const header = `CheckPlease — ${session.label ?? 'Dinner'} ${date}`

  const lines = shares.map(share => {
    const itemNames = share.assignedItems
      .map(i => (i.shared ? `${i.name} (shared)` : i.name))
      .join(' · ')
    return [
      `${share.name}: ${itemNames}`,
      `  Items $${share.itemSubtotal.toFixed(2)} · Tax $${share.taxShare.toFixed(2)} · Tip $${share.tipShare.toFixed(2)}`,
      `  YOU OWE: $${share.total.toFixed(2)}`,
    ].join('\n')
  })

  return [header, '', ...lines].join('\n')
}
