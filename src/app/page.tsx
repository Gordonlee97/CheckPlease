'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { listSessions } from '@/lib/storage'
import type { Session } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([])

  useEffect(() => {
    listSessions().then(setSessions)
  }, [])

  return (
    <>
      {/* pb-32 keeps the last card above the FAB */}
      <main className="min-h-screen p-6 max-w-md mx-auto pb-32">
        <h1 className="font-display text-3xl text-gold mb-1">CheckPlease</h1>
        <p className="text-text-secondary text-sm mb-8">Split the bill, not the friendship.</p>

        {sessions.length > 0 && (
          <>
            <h2 className="text-text-secondary text-xs uppercase tracking-widest mb-3">Recent Splits</h2>
            <div className="flex flex-col gap-3">
              {sessions.map(session => (
                <Link key={session.id} href={`/history/${session.id}`}>
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
          </>
        )}

        {sessions.length === 0 && (
          <p className="text-center text-text-secondary text-sm mt-16">No splits yet — start one!</p>
        )}
      </main>

      {/* Floating action button — fixed to viewport, centered within max-w-md column.
          Gradient fades content beneath so the button always reads cleanly. */}
      <div className="fixed bottom-0 left-0 right-0 pt-10 pb-6 bg-gradient-to-t from-bg to-transparent pointer-events-none">
        <div className="max-w-md mx-auto px-6 pointer-events-auto">
          <Link href="/new">
            <Button fullWidth>+ New Split</Button>
          </Link>
        </div>
      </div>
    </>
  )
}
