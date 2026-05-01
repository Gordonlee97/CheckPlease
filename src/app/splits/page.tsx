'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { listSessions } from '@/lib/storage'
import type { Session } from '@/lib/types'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'

const PAGE_SIZE = 20

export default function SplitsPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    listSessions().then(setSessions)
  }, [])

  function handleBack() {
    setExiting(true)
    setTimeout(() => router.push('/'), 200)
  }

  const shown = sessions.slice(0, visible)
  const hasMore = visible < sessions.length

  return (
    <main className={`min-h-screen p-6 max-w-md mx-auto pb-16 ${exiting ? 'animate-page-exit' : 'animate-page-enter'}`}>
      <div className="mb-6">
        <button onClick={handleBack} className="text-text-secondary hover:text-text-primary text-sm">← Back</button>
      </div>

      <h2 className="font-display text-4xl tracking-wide text-gold mb-6">All Splits</h2>

      {sessions.length === 0 ? (
        <p className="text-text-secondary/50 text-sm">No splits yet.</p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {shown.map(session => (
              <Link key={session.id} href={`/history?id=${session.id}`}>
                <Card className="flex items-center justify-between hover:border-gold transition-colors cursor-pointer">
                  <div>
                    <p className="text-text-primary font-medium">{session.label ?? 'Unknown Restaurant'}</p>
                    <p className="text-text-secondary text-xs mt-0.5">
                      {new Date(session.createdAt).toLocaleDateString()} · {session.people.length} people
                    </p>
                  </div>
                  <span className="text-gold text-sm">${session.total.toFixed(2)}</span>
                </Card>
              </Link>
            ))}
          </div>

          {hasMore && (
            <button
              onClick={() => setVisible(v => v + PAGE_SIZE)}
              className="w-full mt-6 text-center text-text-secondary/50 text-sm py-3 border border-border/40 rounded-xl hover:text-text-secondary hover:border-border transition-colors"
            >
              Show more
            </button>
          )}
        </>
      )}
    </main>
  )
}
