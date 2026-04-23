'use client'

import { useState } from 'react'
import type { Item, Person } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

interface Props {
  people: Person[]
  items: Item[]
  onDone: (items: Item[]) => void
}

export function Assign({ people, items: initialItems, onDone }: Props) {
  const [items, setItems] = useState<Item[]>(initialItems)

  function toggleAssign(itemId: string, personId: string) {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      const assigned = item.assignedTo.includes(personId)
        ? item.assignedTo.filter(id => id !== personId)
        : [...item.assignedTo, personId]
      return { ...item, assignedTo: assigned }
    }))
  }

  const unassigned = items.filter(i => i.assignedTo.length === 0)
  const canContinue = unassigned.length === 0

  return (
    <div>
      <h2 className="font-display text-2xl text-gold mb-1">Assign Items</h2>
      <p className="text-text-secondary text-sm mb-6">
        Tap names to assign. Tap multiple for a shared item.
      </p>

      <div className="flex flex-col gap-3 mb-8">
        {items.map(item => (
          <Card key={item.id} className={cn(item.assignedTo.length === 0 && 'border-red-900')}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-text-primary font-medium">{item.name}</span>
              <div className="text-right">
                <span className="text-gold font-semibold">${item.price.toFixed(2)}</span>
                {item.assignedTo.length > 1 && (
                  <span className="text-text-secondary text-xs block">
                    ${(item.price / item.assignedTo.length).toFixed(2)} each
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {people.map(person => {
                const selected = item.assignedTo.includes(person.id)
                return (
                  <button
                    key={person.id}
                    onClick={() => toggleAssign(item.id, person.id)}
                    className={cn(
                      'rounded-full px-3 py-1 text-sm transition-colors',
                      selected
                        ? 'bg-gold text-bg font-semibold'
                        : 'bg-bg border border-border text-text-secondary'
                    )}
                  >
                    {person.name}
                  </button>
                )
              })}
            </div>
          </Card>
        ))}
      </div>

      {!canContinue && (
        <p className="text-center text-red-400 text-xs mb-3">
          {unassigned.length} item{unassigned.length > 1 ? 's' : ''} still unassigned
        </p>
      )}

      <Button fullWidth onClick={() => onDone(items)} disabled={!canContinue}>
        See Totals →
      </Button>
    </div>
  )
}
