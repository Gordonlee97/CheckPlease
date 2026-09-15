'use client'

import { useEffect, useRef, useState } from 'react'
import type { Session } from '@/lib/types'
import type { PersonShare } from '@/lib/splitting'
import { buildShareUrl, buildPlainText } from '@/lib/share'
import { getMyVenmoHandle } from '@/lib/userSettings'

// Share-link / copy-text actions plus the toast they report through.
export function useShareActions(session: Session, shares: PersonShare[]) {
  const [toast, setToast] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  function showToast(msg: string) {
    // Restart the timer so an earlier toast's timeout can't hide this one early
    clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }

  async function shareLink() {
    if (sharing) return
    setSharing(true)
    try {
      const url = buildShareUrl(session)
      if (navigator.share) {
        try {
          await navigator.share({ title: 'CheckPlease split', url })
          return
        } catch (err) {
          // User dismissed the share sheet: respect that instead of copying anyway
          if (err instanceof DOMException && err.name === 'AbortError') return
        }
      }
      try { await navigator.clipboard.writeText(url); showToast('Link copied to clipboard!') }
      catch { showToast('Could not copy link') }
    } finally {
      setSharing(false)
    }
  }

  async function copyText() {
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

  return { toast, sharing, shareLink, copyText }
}
