'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/storage'
import { computeSplit } from '@/lib/splitting'
import type { Session } from '@/lib/types'
import { SummaryView } from '@/components/steps/SummaryView'

function HistoryContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    if (!id) { router.replace('/'); return }
    getSession(id).then(s => {
      if (!s) router.replace('/')
      else setSession(s)
    })
  }, [id, router])

  if (!session) return null

  const shares = computeSplit(session.people, session.items, session.tax, session.tip, session.total)
  return (
    <main className="min-h-screen p-6 pb-32 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="text-text-secondary text-sm hover:text-text-primary">← Home</Link>
        <Link href="/splits" className="text-text-secondary text-sm hover:text-text-primary">All splits →</Link>
      </div>
      <SummaryView session={session} shares={shares} readOnly />
    </main>
  )
}

export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryContent />
    </Suspense>
  )
}
