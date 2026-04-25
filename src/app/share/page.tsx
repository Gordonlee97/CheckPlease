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
    const hash = window.location.hash.slice(1)
    if (!hash) { setError(true); return }
    const decoded = decodeSession(hash)
    if (!decoded) { setError(true); return }
    setSession(decoded)
  }, [])

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p className="text-text-secondary text-center">Invalid or expired link.</p>
      </main>
    )
  }

  if (!session) return null

  const shares = computeSplit(session.people, session.items, session.tax, session.tip, session.total)

  return (
    <main className="min-h-screen p-6 pb-32 max-w-md mx-auto">
      <SummaryView session={session} shares={shares} readOnly />
    </main>
  )
}
