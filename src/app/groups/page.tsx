'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSavedGroups } from '@/lib/savedGroups'
import { useDraft } from '@/lib/draft'
import { DiscardDraftPrompt } from '@/components/DiscardDraftPrompt'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'

export default function GroupsPage() {
  const router = useRouter()
  const groups = useSavedGroups()
  const [exiting, setExiting] = useState(false)
  const draft = useDraft()
  // A group tap held back until the user agrees to discard their draft
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  function handleBack() {
    setExiting(true)
    setTimeout(() => router.push('/'), 200)
  }

  return (
    // The slide starts 20px right; main clips it so a phone can't widen the page to fit
    <main className="min-h-screen max-w-md mx-auto overflow-x-clip">
      <div className={`p-6 pb-16 ${exiting ? 'animate-page-exit' : 'animate-page-enter'}`}>
      <div className="flex items-center justify-between mb-6">
        <button onClick={handleBack} className="text-text-secondary hover:text-text-primary text-sm">← Back</button>
        <Link href="/groups/edit?id=new" className="border border-border/60 rounded-lg px-3 py-1 text-xs text-text-secondary hover:border-border hover:text-text-secondary transition-colors">
          + New group
        </Link>
      </div>

      <h1 className="font-display text-4xl tracking-wide text-gold mb-6">Groups</h1>

      {groups.length === 0 ? (
        <div className="flex flex-col items-start gap-3 ml-4">
          <p className="text-text-secondary text-sm">No groups yet. Create one to speed up future splits.</p>
          <Link href="/groups/edit?id=new" className="text-sm text-gold/70 hover:text-gold transition-colors">
            + Create your first group
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map(group => (
            <div key={group.id} className="flex items-center gap-2">
              <Link
                href={`/new?group=${group.id}`}
                className="flex-1 min-w-0"
                onClick={e => {
                  if (!draft) return
                  e.preventDefault()
                  setPendingHref(`/new?group=${group.id}`)
                }}
              >
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
              <Link href={`/groups/edit?id=${group.id}`} className="text-text-secondary hover:text-text-primary text-xs transition-colors px-1 shrink-0">
                Edit
              </Link>
            </div>
          ))}
        </div>
      )}
      </div>
      {draft && pendingHref && (
        <div className="fixed bottom-0 left-0 right-0 pt-10 pb-6-safe bg-gradient-to-t from-bg to-transparent pointer-events-none">
          <div className="max-w-md mx-auto px-6 pointer-events-auto">
            <DiscardDraftPrompt href={pendingHref} onCancel={() => setPendingHref(null)} />
          </div>
        </div>
      )}
    </main>
  )
}
