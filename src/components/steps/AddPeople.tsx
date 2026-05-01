'use client'

import { useState, useEffect, useImperativeHandle, useRef, type Ref, KeyboardEvent, MouseEvent } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Person } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { getSavedNames, forgetName, type SavedName } from '@/lib/savedNames'
import { getPersonColor } from '@/lib/personColors'
import { saveGroup, getSavedGroups, type SavedGroup } from '@/lib/savedGroups'

interface Props {
  initialPeople?: Person[]
  onDone: (people: Person[]) => void
  ref?: Ref<{ submit: () => void }>
  onReadyChange?: (ready: boolean) => void
}

export function AddPeople({ initialPeople, onDone, ref, onReadyChange }: Props) {
  const [people, setPeople] = useState<Person[]>(initialPeople ?? [])
  const [name, setName] = useState('')
  const [savedNames, setSavedNames] = useState<SavedName[]>([])
  const [savingGroup, setSavingGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  // Names snapshot taken at save time — show "Group saved!" while people still match it
  const [savedSnapshot, setSavedSnapshot] = useState<string[] | null>(null)
  const [savedGroups, setSavedGroups] = useState<SavedGroup[]>([])
  const [showGroupPicker, setShowGroupPicker] = useState(false)

  useEffect(() => {
    setSavedNames(getSavedNames())
    setSavedGroups(getSavedGroups())
  }, [])

  const submitRef = useRef<() => void>(() => {})
  submitRef.current = () => onDone(people)
  useImperativeHandle(ref, () => ({ submit: () => submitRef.current() }), [])

  useEffect(() => {
    onReadyChange?.(people.length >= 2)
  }, [people.length, onReadyChange])

  const currentNames = people.map(p => p.name)
  const groupSavedVisible = savedSnapshot !== null &&
    savedSnapshot.length === currentNames.length &&
    savedSnapshot.every((n, i) => currentNames[i] === n)

  const suggestions = name.trim().length > 0
    ? savedNames
        .filter(s =>
          s.name.toLowerCase().startsWith(name.trim().toLowerCase()) &&
          !people.some(p => p.name.toLowerCase() === s.name.toLowerCase())
        )
        .slice(0, 5)
    : []

  function addPerson(personName?: string) {
    const trimmed = (personName ?? name).trim()
    if (!trimmed) return
    if (people.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) return
    const color = getPersonColor(people.length)
    setPeople(p => [...p, { id: uuidv4(), name: trimmed, color }])
    setName('')
    setShowGroupPicker(false)
  }

  function removePerson(id: string) {
    setPeople(p => p.filter(person => person.id !== id))
  }

  function updateVenmo(id: string, raw: string) {
    const handle = raw.replace(/^@/, '').trim()
    setPeople(prev => prev.map(p => p.id === id ? { ...p, venmoHandle: handle || undefined } : p))
  }

  function loadGroup(group: SavedGroup) {
    const loaded = group.people.map((gp, i) => ({
      id: uuidv4(),
      name: gp.name,
      color: gp.color ?? getPersonColor(i),
      venmoHandle: gp.venmoHandle,
    }))
    setPeople(loaded)
    setShowGroupPicker(false)
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') addPerson()
  }

  function handleForget(savedName: string, e: MouseEvent) {
    e.stopPropagation()
    forgetName(savedName)
    setSavedNames(prev => prev.filter(n => n.name !== savedName))
  }

  function confirmSaveGroup() {
    const trimmed = groupName.trim()
    if (!trimmed) return
    saveGroup({
      name: trimmed,
      people: people.map(p => ({ name: p.name, color: p.color ?? getPersonColor(0), venmoHandle: p.venmoHandle })),
    })
    setSavingGroup(false)
    setGroupName('')
    setSavedSnapshot(currentNames.slice())
  }

  return (
    <div>
      <h2 className="font-display text-4xl tracking-wide text-gold mb-1">Who's splitting?</h2>
      <p className="text-text-secondary text-sm mb-6">Add everyone at the table.</p>

      <div className="flex gap-2 mb-2">
        <Input
          placeholder="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={handleKey}
          autoFocus
        />
        <Button onClick={() => addPerson()} className="shrink-0">Add</Button>
      </div>

      <div className="min-h-[42px] mb-2">
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {suggestions.map(s => (
              <div
                key={s.name}
                className="flex items-center gap-0.5 rounded-full bg-surface border border-border pl-3 pr-1 py-1 cursor-pointer active:border-gold transition-colors"
                onClick={() => addPerson(s.name)}
              >
                <span className="text-text-secondary text-sm">{s.name}</span>
                <button
                  onClick={e => handleForget(s.name, e)}
                  className="text-border hover:text-text-secondary text-base leading-none px-1.5 py-0.5"
                  aria-label={`Forget ${s.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-center mb-4">
        <div className="w-4/5 h-[3px] rounded-full bg-gradient-to-r from-transparent via-text-secondary/40 to-transparent" />
      </div>

      {/* Group picker — only when list is empty */}
      {people.length === 0 && savedGroups.length > 0 && (
        <div className="mb-4">
          {!showGroupPicker ? (
            <button
              onClick={() => setShowGroupPicker(true)}
              className="w-full border border-border bg-surface rounded-xl py-2.5 text-sm text-text-secondary hover:border-gold/50 hover:text-text-primary transition-colors"
            >
              Add from group
            </button>
          ) : (
            <div className="flex flex-col gap-2 animate-fade-in">
              {savedGroups.map(group => (
                <button
                  key={group.id}
                  onClick={() => loadGroup(group)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-gold transition-colors"
                >
                  <p className="text-text-primary text-sm font-medium">{group.name}</p>
                  <p className="text-text-secondary text-xs mt-0.5">{group.people.map(p => p.name).join(', ')}</p>
                </button>
              ))}
              <button
                onClick={() => setShowGroupPicker(false)}
                className="text-text-secondary/40 text-xs py-1 text-center"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {people.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {people.map(person => (
            <Card key={person.id} className="py-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {person.color && (
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: person.color }}
                    />
                  )}
                  <span className="text-text-primary">{person.name}</span>
                </div>
                <button
                  onClick={() => removePerson(person.id)}
                  className="text-text-secondary hover:text-text-primary text-lg leading-none"
                  aria-label={`Remove ${person.name}`}
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
                  onChange={e => updateVenmo(person.id, e.target.value)}
                  className="flex-1 bg-transparent text-sm text-text-secondary placeholder:text-text-secondary/30 outline-none border-b border-border/40 pb-0.5 focus:border-gold/50 transition-colors"
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {people.length >= 2 && !savingGroup && !groupSavedVisible && (
        <button
          onClick={() => setSavingGroup(true)}
          className="w-full text-center text-text-secondary/40 text-xs py-2 hover:text-text-secondary/70 transition-colors"
        >
          Save as group
        </button>
      )}

      {groupSavedVisible && (
        <p className="w-full text-center text-gold/70 text-xs py-2 animate-fade-in-delayed">Group saved!</p>
      )}

      {savingGroup && (
        <div className="flex gap-2 items-center mt-1">
          <input
            autoFocus
            type="text"
            placeholder="Group name (e.g. Roommates)"
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') confirmSaveGroup()
              if (e.key === 'Escape') setSavingGroup(false)
            }}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary/40 outline-none border-b border-gold/50 pb-0.5 focus:border-gold transition-colors"
          />
          <button onClick={confirmSaveGroup} className="text-gold text-xs shrink-0">Save</button>
          <button onClick={() => setSavingGroup(false)} className="text-text-secondary/40 text-xs shrink-0">Cancel</button>
        </div>
      )}
    </div>
  )
}
