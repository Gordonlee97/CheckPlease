'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { getSavedGroup, saveGroup, deleteGroup, type GroupPerson } from '@/lib/savedGroups'
import { getPersonColor } from '@/lib/personColors'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

interface EditablePerson extends GroupPerson {
  key: string
}

function GroupEditorContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? 'new'
  const isNew = id === 'new'
  const router = useRouter()

  const [groupName, setGroupName] = useState('')
  const [people, setPeople] = useState<EditablePerson[]>([])
  const [newName, setNewName] = useState('')
  const [exiting, setExiting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!isNew) {
      const group = getSavedGroup(id)
      if (group) {
        setGroupName(group.name)
        setPeople(group.people.map(p => ({ ...p, key: uuidv4() })))
      }
    }
  }, [id, isNew])

  function addPerson() {
    const trimmed = newName.trim()
    if (!trimmed) return
    if (people.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) return
    setPeople(prev => [...prev, {
      key: uuidv4(),
      name: trimmed,
      color: getPersonColor(prev.length),
    }])
    setNewName('')
  }

  function removePerson(key: string) {
    setPeople(prev => prev.filter(p => p.key !== key))
  }

  function updateVenmo(key: string, raw: string) {
    const handle = raw.replace(/^@/, '').trim()
    setPeople(prev => prev.map(p => p.key === key ? { ...p, venmoHandle: handle || undefined } : p))
  }

  function exit() {
    setExiting(true)
    setTimeout(() => router.push('/'), 200)
  }

  function handleSave() {
    const trimmedName = groupName.trim()
    if (!trimmedName || people.length < 1) return
    saveGroup({
      id: isNew ? undefined : id,
      name: trimmedName,
      people: people.map(({ key: _key, ...rest }) => rest),
    })
    exit()
  }

  function handleDelete() {
    if (!isNew) deleteGroup(id)
    exit()
  }

  const canSave = groupName.trim().length > 0 && people.length >= 1

  return (
    <>
    <main className="min-h-screen max-w-md mx-auto">
      <div className={`p-6 pb-32 ${exiting ? 'animate-page-exit' : 'animate-page-enter'}`}>
      <div className="flex items-center justify-between mb-6">
        <button onClick={exit} className="text-text-secondary hover:text-text-primary text-sm">← Back</button>
        {!isNew && !confirmDelete && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-red-400/60 hover:text-red-400 text-sm transition-colors"
          >
            Delete group
          </button>
        )}
        {!isNew && confirmDelete && (
          <div className="flex items-center gap-2">
            <span className="text-text-secondary text-xs">Are you sure?</span>
            <button onClick={handleDelete} className="text-red-400 text-sm font-medium">Delete</button>
            <button onClick={() => setConfirmDelete(false)} className="text-text-secondary/40 text-sm">Cancel</button>
          </div>
        )}
      </div>

      <h2 className="font-display text-4xl tracking-wide text-gold mb-6">
        {isNew ? 'New Group' : 'Edit Group'}
      </h2>

      <div className="mb-6">
        <p className="text-text-secondary text-xs uppercase tracking-widest mb-2">Group name</p>
        <Input
          placeholder="e.g. Roommates, Work crew…"
          value={groupName}
          onChange={e => setGroupName(e.target.value)}
          autoFocus={isNew}
        />
      </div>

      <div className="mb-3">
        <p className="text-text-secondary text-xs uppercase tracking-widest mb-2">People</p>
        <div className="flex gap-2">
          <Input
            placeholder="Name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPerson()}
          />
          <Button onClick={addPerson} className="shrink-0">Add</Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 mb-8">
        {people.map(person => (
          <Card key={person.key} className="py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: person.color }} />
                <span className="text-text-primary">{person.name}</span>
              </div>
              <button
                onClick={() => removePerson(person.key)}
                className="text-text-secondary hover:text-text-primary text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex items-center gap-2 pl-5">
              <span className="text-text-secondary/50 text-sm">@</span>
              <input
                type="text"
                placeholder="venmo handle (optional)"
                value={person.venmoHandle ?? ''}
                onChange={e => updateVenmo(person.key, e.target.value)}
                className="flex-1 bg-transparent text-sm text-text-secondary placeholder:text-text-secondary/30 outline-none border-b border-border/40 pb-0.5 focus:border-gold/50 transition-colors"
              />
            </div>
          </Card>
        ))}
      </div>

      </div>
    </main>

    <div className="fixed bottom-0 left-0 right-0 pt-8 pb-6-safe bg-gradient-to-t from-bg to-transparent pointer-events-none">
      <div className="max-w-md mx-auto px-6 pointer-events-auto">
        <Button fullWidth onClick={handleSave} disabled={!canSave}>
          Save group
        </Button>
      </div>
    </div>
    </>
  )
}

export default function GroupEditorPage() {
  return (
    <Suspense fallback={null}>
      <GroupEditorContent />
    </Suspense>
  )
}
