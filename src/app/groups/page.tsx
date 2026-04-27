'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSavedGroups, type SavedGroup } from '@/lib/savedGroups'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'

export default function GroupsPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<SavedGroup[]>([])
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    setGroups(getSavedGroups())
  }, [])

  function handleBack() {
    setExiting(true)
    setTimeout(() => router.push('/'), 200)
  }

  return (
    <main className={`min-h-screen p-6 max-w-md mx-auto pb-16 ${exiting ? 'animate-page-exit' : 'animate-page-enter'}`}>
      <div className="flex items-center justify-between mb-6">
        <button onClick={handleBack} className="text-text-secondary hover:text-text-primary text-sm">← Back</button>
        <Link href="/groups/new" className="border border-border bg-surface rounded-lg px-3 py-1 text-xs text-text-secondary hover:border-gold/50 hover:text-text-primary transition-colors">
          + New group
        </Link>
      </div>

      <h2 className="font-display text-4xl tracking-wide text-gold mb-6">Groups</h2>

      {groups.length === 0 ? (
        <div className="flex flex-col items-start gap-3 ml-4">
          <p className="text-text-secondary/50 text-sm">No groups yet. Create one to speed up future splits.</p>
          <Link href="/groups/new" className="text-sm text-gold/70 hover:text-gold transition-colors">
            + Create your first group
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map(group => (
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
      )}
    </main>
  )
}
