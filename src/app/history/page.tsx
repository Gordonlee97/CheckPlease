'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSession, deleteSession } from '@/lib/storage'
import { computeSplit } from '@/lib/splitting'
import type { Session } from '@/lib/types'
import { SummaryView } from '@/components/steps/SummaryView'

function HistoryContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!id) { router.replace('/'); return }
    getSession(id).then(s => {
      if (!s) router.replace('/')
      else setSession(s)
    })
  }, [id, router])

  if (!session) return null

  async function handleDelete() {
    await deleteSession(id)
    router.replace('/')
  }

  const shares = computeSplit(session.people, session.items, session.tax, session.tip, session.total)
  return (
    <main className="min-h-screen p-6 pb-32 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="text-text-secondary text-sm hover:text-text-primary">← Home</Link>
        <Link href="/splits" className="text-text-secondary text-sm hover:text-text-primary">All splits →</Link>
      </div>
      <SummaryView session={session} shares={shares} readOnly />

      <div className="mt-8 mb-24 text-center">
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-text-secondary text-xs hover:text-red-400 transition-colors"
          >
            Delete split
          </button>
        ) : (
          <div className="flex items-center justify-center gap-4 animate-fade-in">
            <span className="text-text-secondary text-xs">Delete this split?</span>
            <button onClick={handleDelete} className="text-red-400 text-sm font-medium">Delete</button>
            <button onClick={() => setConfirmDelete(false)} className="text-text-secondary text-sm">Cancel</button>
          </div>
        )}
      </div>
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
