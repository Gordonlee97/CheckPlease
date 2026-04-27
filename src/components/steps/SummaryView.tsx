'use client'

import { useState, useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import type { Session } from '@/lib/types'
import type { PersonShare } from '@/lib/splitting'
import { buildShareUrl, buildPlainText } from '@/lib/share'
import { getMyVenmoHandle } from '@/lib/userSettings'
import { Button } from '@/components/ui/Button'

interface Props {
  session: Session
  shares: PersonShare[]
  readOnly?: boolean
  onDone?: () => void
  ref?: Ref<{ submit: () => void }>
  onReadyChange?: (ready: boolean) => void
}

function useCountUp(target: number, delay = 0, duration = 850) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (target === 0) { setVal(0); return }
    let raf: number
    const startTime = performance.now() + delay
    function tick(now: number) {
      if (now < startTime) { raf = requestAnimationFrame(tick); return }
      const t = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3) // cubic ease-out
      setVal(target * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
      else setVal(target)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, delay, duration])
  return val
}

interface ShareCardProps {
  share: PersonShare
  index: number
  session: Session
}

function ShareCard({ share, index, session }: ShareCardProps) {
  const animatedTotal = useCountUp(share.total, index * 110)
  const person = session.people.find(p => p.id === share.personId)
  const color = person?.color ?? '#c9a84c'
  const venmoHandle = person?.venmoHandle
  const note = encodeURIComponent(session.label ?? 'Dinner')

  const venmoUrl = venmoHandle
    ? `venmo://paycharge?txn=charge&recipients=${venmoHandle}&amount=${share.total.toFixed(2)}&note=${note}`
    : `venmo://paycharge?txn=charge&amount=${share.total.toFixed(2)}&note=${note}`

  return (
    <div
      className="rounded-2xl border border-border bg-surface p-4"
      style={{ borderLeftWidth: '3px', borderLeftColor: color }}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="font-semibold text-lg" style={{ color }}>
          {share.name}
        </span>
        <span className="text-gold font-bold text-xl tabular-nums">
          ${animatedTotal.toFixed(2)}
        </span>
      </div>
      <div className="space-y-1">
        <p className="text-text-secondary text-xs">
          {share.assignedItems.map(i => i.shared ? `${i.name} (shared)` : i.name).join(' · ')}
        </p>
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <p className="text-[11px] text-text-secondary/50">
            Items ${share.itemSubtotal.toFixed(2)}
            {session.tax > 0 && ` · Tax $${share.taxShare.toFixed(2)}`}
            {session.tip > 0 && ` · Tip $${share.tipShare.toFixed(2)}`}
          </p>
          <a
            href={venmoUrl}
            className="text-[11px] text-[#008CFF]/70 hover:text-[#008CFF] transition-colors shrink-0 ml-3"
          >
            Request on Venmo
          </a>
        </div>
      </div>
    </div>
  )
}

export function SummaryView({ session, shares, readOnly = false, onDone, ref, onReadyChange }: Props) {
  const [toast, setToast] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)

  const submitRef = useRef<() => void>(() => {})
  submitRef.current = () => onDone?.()
  useImperativeHandle(ref, () => ({ submit: () => submitRef.current() }), [])

  useEffect(() => {
    onReadyChange?.(true)
  }, [onReadyChange])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function handleShareLink() {
    if (sharing) return
    setSharing(true)
    try {
      const url = buildShareUrl(session)
      if (navigator.share) {
        try { await navigator.share({ title: 'CheckPlease split', url }); return } catch {}
      }
      try { await navigator.clipboard.writeText(url); showToast('Link copied to clipboard!') }
      catch { showToast('Could not copy link') }
    } finally {
      setSharing(false)
    }
  }

  async function handleCopyText() {
    if (sharing) return
    setSharing(true)
    try {
      const text = buildPlainText(session, shares, getMyVenmoHandle())
      try { await navigator.clipboard.writeText(text); showToast('Copied to clipboard!') }
      catch { showToast('Could not copy text') }
    } finally {
      setSharing(false)
    }
  }

  return (
    <div>
      <h2 className="font-display text-4xl tracking-wide text-gold mb-1">
        {session.label ?? 'Unknown Restaurant'}
      </h2>
      <p className="text-text-secondary text-sm mb-6">
        {new Date(session.createdAt).toLocaleDateString()} · {session.people.length} people · ${session.total.toFixed(2)} total
      </p>

      <div className="flex flex-col gap-3 mb-8">
        {shares.map((share, idx) => (
          <ShareCard key={share.personId} share={share} index={idx} session={session} />
        ))}
      </div>

      {readOnly && (
        <>
          <div className="fixed bottom-0 left-0 right-0 pt-8 pb-6 bg-gradient-to-t from-bg to-transparent pointer-events-none">
            <div className="max-w-md mx-auto px-6 pointer-events-auto flex gap-3">
              <Button fullWidth onClick={handleShareLink} disabled={sharing}>Share link</Button>
              <Button fullWidth variant="ghost" onClick={handleCopyText} disabled={sharing}>Copy text</Button>
            </div>
          </div>
          {toast && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface text-text-primary px-4 py-2 rounded-xl shadow-lg text-sm z-50">
              {toast}
            </div>
          )}
        </>
      )}
    </div>
  )
}
