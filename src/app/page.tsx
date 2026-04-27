'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { listSessions } from '@/lib/storage'
import { getSavedGroups, type SavedGroup } from '@/lib/savedGroups'
import { getMyVenmoHandle, setMyVenmoHandle } from '@/lib/userSettings'
import type { Session } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const GROUPS_ON_HOME = 3
const SPLITS_ON_HOME = 3

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [groups, setGroups] = useState<SavedGroup[]>([])
  const [venmoHandle, setVenmoHandle] = useState('')
  const [editingVenmo, setEditingVenmo] = useState(false)
  const [venmoInput, setVenmoInput] = useState('')

  useEffect(() => {
    listSessions().then(setSessions)
    setGroups(getSavedGroups())
    const handle = getMyVenmoHandle()
    if (handle) setVenmoHandle(handle)
  }, [])

  function saveVenmo() {
    const cleaned = venmoInput.replace(/^@/, '').trim()
    setMyVenmoHandle(cleaned)
    setVenmoHandle(cleaned)
    setEditingVenmo(false)
  }

  function startEditVenmo() {
    setVenmoInput(venmoHandle ? `@${venmoHandle}` : '')
    setEditingVenmo(true)
  }

  const recentGroups = groups.slice(0, GROUPS_ON_HOME)
  const recentSessions = sessions.slice(0, SPLITS_ON_HOME)

  return (
    <>
      <main className="min-h-screen p-6 max-w-md mx-auto pb-32">
        <div className="flex items-start justify-between mb-1">
          <h1 className="font-display text-3xl text-gold">CheckPlease</h1>
          <div className="text-right pt-1">
            {editingVenmo ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="@yourhandle"
                  value={venmoInput}
                  onChange={e => setVenmoInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveVenmo()
                    if (e.key === 'Escape') setEditingVenmo(false)
                  }}
                  className="bg-transparent text-sm text-text-primary placeholder:text-text-secondary/40 outline-none border-b border-gold/50 pb-0.5 w-32 text-right"
                />
                <button onClick={saveVenmo} className="text-gold text-xs">Save</button>
              </div>
            ) : (
              <button onClick={startEditVenmo} className="text-text-secondary/50 text-xs hover:text-text-secondary transition-colors">
                {venmoHandle ? `@${venmoHandle}` : 'Add your Venmo'}
              </button>
            )}
          </div>
        </div>
        <div className="mb-8" />
        {/* Groups */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-text-secondary text-xs uppercase tracking-widest">Groups</h2>
            <Link href="/groups/new" className="border border-border/60 rounded-lg px-3 py-1 text-xs text-text-secondary/65 hover:border-border hover:text-text-secondary transition-colors">
              + New
            </Link>
          </div>

          {recentGroups.length > 0 ? (
            <>
              <div className="flex flex-col gap-2">
                {recentGroups.map(group => (
                  <div key={group.id} className="flex items-center gap-2">
                    <Link href={`/new?group=${group.id}`} className="flex-1 min-w-0">
                      <Card className="flex items-center justify-between py-3 hover:border-gold transition-colors cursor-pointer">
                        <div className="min-w-0">
                          <p className="text-text-primary font-medium">{group.name}</p>
                          <p className="text-text-secondary text-xs mt-0.5 truncate">
                            {group.people.map(p => p.name).join(', ')}
                          </p>
                        </div>
                        <div className="flex -space-x-1 shrink-0 ml-3">
                          {group.people.slice(0, 4).map((p, i) => (
                            <div key={i} className="w-5 h-5 rounded-full border border-bg" style={{ backgroundColor: p.color }} />
                          ))}
                        </div>
                      </Card>
                    </Link>
                    <Link href={`/groups/${group.id}`} className="text-text-secondary/40 hover:text-text-secondary text-xs transition-colors px-1 shrink-0">
                      Edit
                    </Link>
                  </div>
                ))}
              </div>
              {groups.length > GROUPS_ON_HOME && (
                <div className="flex justify-center mt-3">
                  <Link href="/groups" className="border border-border/60 rounded-lg px-4 py-1.5 text-xs text-text-secondary/65 hover:border-border hover:text-text-secondary transition-colors">
                    More groups →
                  </Link>
                </div>
              )}
            </>
          ) : (
            <p className="text-text-secondary/50 text-sm ml-4">Save your frequent dining crew for faster splits.</p>
          )}
        </div>

        {/* Recent splits */}
        {sessions.length > 0 && (
          <div>
            <h2 className="text-text-secondary text-xs uppercase tracking-widest mb-3">Recent Splits</h2>
            <div className="flex flex-col gap-3">
              {recentSessions.map(session => (
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
            {sessions.length > SPLITS_ON_HOME && (
              <div className="flex justify-center mt-3">
                <Link href="/splits" className="border border-border/60 rounded-lg px-4 py-1.5 text-xs text-text-secondary/65 hover:border-border hover:text-text-secondary transition-colors">
                  More splits →
                </Link>
              </div>
            )}
          </div>
        )}

        {sessions.length === 0 && groups.length === 0 && (
          <p className="text-center text-text-secondary text-sm mt-8">No splits yet — start one!</p>
        )}
      </main>

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
