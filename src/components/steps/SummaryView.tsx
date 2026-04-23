'use client'

import { useState } from 'react'
import type { Session } from '@/lib/types'
import type { PersonShare } from '@/lib/splitting'
import { buildShareUrl, buildPlainText } from '@/lib/share'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface Props {
  session: Session
  shares: PersonShare[]
  readOnly?: boolean
  onDone?: () => void
}

export function SummaryView({ session, shares, readOnly = false, onDone }: Props) {
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function handleShareLink() {
    const url = buildShareUrl(session)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'CheckPlease split', url })
        return
      } catch {
        // AbortError or other — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      showToast('Link copied to clipboard!')
    } catch {
      showToast('Could not copy link')
    }
  }

  async function handleCopyText() {
    const text = buildPlainText(session, shares)
    try {
      await navigator.clipboard.writeText(text)
      showToast('Copied to clipboard!')
    } catch {
      showToast('Could not copy text')
    }
  }

  return (
    <div>
      <h2 className="font-display text-2xl text-gold mb-1">
        {session.label ?? 'Unknown Restaurant'}
      </h2>
      <p className="text-text-secondary text-sm mb-6">
        {new Date(session.createdAt).toLocaleDateString()} · {session.people.length} people · ${session.total.toFixed(2)} total
      </p>

      <div className="flex flex-col gap-3 mb-8">
        {shares.map(share => (
          <Card key={share.personId}>
            <div className="flex justify-between items-start mb-2">
              <span className="text-text-primary font-semibold text-lg">{share.name}</span>
              <span className="text-gold font-bold text-xl">${share.total.toFixed(2)}</span>
            </div>
            <div className="text-text-secondary text-xs space-y-0.5">
              <p>{share.assignedItems.map(i => i.shared ? `${i.name} (shared)` : i.name).join(' · ')}</p>
              <p>
                Items ${share.itemSubtotal.toFixed(2)}
                {session.tax > 0 && ` · Tax $${share.taxShare.toFixed(2)}`}
                {session.tip > 0 && ` · Tip $${share.tipShare.toFixed(2)}`}
              </p>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex gap-3 mb-4">
        <Button fullWidth onClick={handleShareLink}>Share link</Button>
        <Button fullWidth variant="ghost" onClick={handleCopyText}>Copy text</Button>
      </div>

      {!readOnly && onDone && (
        <Button fullWidth variant="ghost" onClick={onDone}>
          Done — back to home
        </Button>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface text-text-primary px-4 py-2 rounded-xl shadow-lg text-sm">
          {toast}
        </div>
      )}
    </div>
  )
}
