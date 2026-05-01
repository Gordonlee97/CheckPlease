import LZString from 'lz-string'
import type { Session } from './types'
import type { PersonShare } from './splitting'

export function buildVenmoRequestAllUrl(
  session: Session,
  shares: PersonShare[],
  myHandle?: string,
): string | null {
  const note = encodeURIComponent(session.label ?? 'Dinner')
  const requestable = shares
    .map(share => {
      const person = session.people.find(p => p.id === share.personId)
      const handle = person?.venmoHandle
      if (!handle || share.total <= 0) return null
      if (myHandle && handle.toLowerCase() === myHandle.toLowerCase()) return null
      return { handle, amount: share.total }
    })
    .filter((x): x is { handle: string; amount: number } => x !== null)

  if (requestable.length < 2) return null

  const recipients = requestable.map(r => r.handle).join(',')
  const amounts = requestable.map(r => r.amount.toFixed(2)).join(',')
  return `venmo://paycharge?txn=charge&recipients=${recipients}&amount=${amounts}&note=${note}`
}

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
  const base = process.env.NEXT_PUBLIC_SHARE_BASE_URL || window.location.origin
  return `${base}/share#${encoded}`
}

export function buildPlainText(session: Session, shares: PersonShare[], myVenmoHandle?: string): string {
  const date = new Date(session.createdAt).toLocaleDateString()
  const header = `CheckPlease — ${session.label ?? 'Dinner'} · ${date} · ${session.people.length} people · $${session.total.toFixed(2)} total`

  const personBlocks = shares.map(share => {
    const itemNames = share.assignedItems
      .map(i => i.shared ? `${i.name} (shared)` : i.name)
      .join(' · ')

    const breakdown = [
      `Items $${share.itemSubtotal.toFixed(2)}`,
      `Tax $${share.taxShare.toFixed(2)}`,
      share.tipShare > 0 && `Tip $${share.tipShare.toFixed(2)}`,
    ].filter(Boolean).join(' · ')

    return [
      share.name,
      itemNames,
      breakdown,
      `You owe: $${share.total.toFixed(2)}`,
    ].join('\n')
  })

  const footer = myVenmoHandle ? `\nVenmo @${myVenmoHandle} to settle up` : ''

  return [header, ...personBlocks].join('\n\n') + footer
}
