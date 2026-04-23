'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/storage'
import { computeSplit } from '@/lib/splitting'
import type { Session } from '@/lib/types'
import { SummaryView } from '@/components/steps/SummaryView'

export default function HistoryPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    getSession(id).then(s => {
      if (!s) router.replace('/')
      else setSession(s)
    })
  }, [id, router])

  if (!session) return null

  const shares = computeSplit(session.people, session.items, session.tax, session.tip, session.total)
  return (
    <main className="min-h-screen p-6 max-w-md mx-auto">
      <Link href="/" className="text-text-secondary text-sm mb-6 block hover:text-text-primary">
        ← All splits
      </Link>
      <SummaryView session={session} shares={shares} readOnly />
    </main>
  )
}
