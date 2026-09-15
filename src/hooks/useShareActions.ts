'use client'

import { useState } from 'react'
import type { Session } from '@/lib/types'
import type { PersonShare } from '@/lib/splitting'
import { buildShareUrl, buildPlainText } from '@/lib/share'
import { getMyVenmoHandle } from '@/lib/userSettings'

// Share-link / copy-text actions plus the toast they report through.
export function useShareActions(session: Session, shares: PersonShare[]) {
  const [toast, setToast] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function shareLink() {
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
