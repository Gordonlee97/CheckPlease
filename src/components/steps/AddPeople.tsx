'use client'

import { useState, KeyboardEvent } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Person } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

interface Props {
  initialPeople?: Person[]
  onDone: (people: Person[]) => void
}

export function AddPeople({ initialPeople, onDone }: Props) {
  const [people, setPeople] = useState<Person[]>(initialPeople ?? [])
  const [name, setName] = useState('')

  function addPerson() {
    const trimmed = name.trim()
    if (!trimmed) return
    setPeople(p => [...p, { id: uuidv4(), name: trimmed }])
    setName('')
  }

  function removePerson(id: string) {
    setPeople(p => p.filter(person => person.id !== id))
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') addPerson()
  }

  return (
    <div>
      <h2 className="font-display text-2xl text-gold mb-1">Who's splitting?</h2>
      <p className="text-text-secondary text-sm mb-6">Add everyone at the table.</p>

      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={handleKey}
          autoFocus
        />
        <Button onClick={addPerson} className="shrink-0">Add</Button>
      </div>

      {people.length > 0 && (
        <div className="flex flex-col gap-2 mb-8">
          {people.map(person => (
            <Card key={person.id} className="flex items-center justify-between py-3">
              <span className="text-text-primary">{person.name}</span>
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

      <Button
        fullWidth
        onClick={() => onDone(people)}
        disabled={people.length < 2}
      >
        That's Everyone →
      </Button>
      {people.length < 2 && (
        <p className="text-center text-text-secondary text-xs mt-2">Add at least 2 people</p>
      )}
    </div>
  )
}
