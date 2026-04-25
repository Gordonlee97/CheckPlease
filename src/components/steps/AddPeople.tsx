'use client'

import { useState, useEffect, useImperativeHandle, useRef, type Ref, KeyboardEvent, MouseEvent } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Person } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { getSavedNames, forgetName, type SavedName } from '@/lib/savedNames'
import { getPersonColor } from '@/lib/personColors'

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

  useEffect(() => {
    setSavedNames(getSavedNames())
  }, [])

  const submitRef = useRef<() => void>(() => {})
  submitRef.current = () => onDone(people)
  useImperativeHandle(ref, () => ({ submit: () => submitRef.current() }), [])

  useEffect(() => {
    onReadyChange?.(people.length >= 2)
  }, [people.length, onReadyChange])

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
  }

  function removePerson(id: string) {
    setPeople(p => p.filter(person => person.id !== id))
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') addPerson()
  }

  function handleForget(savedName: string, e: MouseEvent) {
    e.stopPropagation()
    forgetName(savedName)
    setSavedNames(prev => prev.filter(n => n.name !== savedName))
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

      {people.length > 0 && (
        <div className="flex flex-col gap-2 mb-8">
          {people.map(person => (
            <Card key={person.id} className="flex items-center justify-between py-3">
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
            </Card>
          ))}
        </div>
      )}

    </div>
  )
}
