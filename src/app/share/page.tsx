'use client'

import { useEffect, useState } from 'react'
import { decodeSession } from '@/lib/share'
import { computeSplit } from '@/lib/splitting'
import type { Session } from '@/lib/types'
import { SummaryView } from '@/components/steps/SummaryView'

export default function SharePage() {
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    // window.location.hash doesn't exist during prerender, so decoding it in
    // render would desync hydration. Read on mount, and again whenever the
    // hash changes: opening another share link in a tab already on /share
    // changes only the hash, which doesn't remount this page.
    function readHash() {
      const decoded = decodeSession(window.location.hash.slice(1))
      setSession(decoded)
      setError(!decoded)
    }
    readHash()
    window.addEventListener('hashchange', readHash)
    return () => window.removeEventListener('hashchange', readHash)
  }, [])

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p className="text-text-secondary text-center">Invalid or expired link.</p>
      </main>
    )
  }

  if (!session) return null

  const shares = computeSplit(session.people, session.items, session.tax, session.tip, session.total, session.currency)

  return (
    <main className="min-h-screen p-6 pb-32 max-w-md mx-auto">
      <SummaryView session={session} shares={shares} readOnly />
    </main>
  )
}
