'use client'

import { useState, useImperativeHandle, useRef, useEffect, type Ref } from 'react'
import type { Item, Person } from '@/lib/types'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

interface Props {
  people: Person[]
  items: Item[]
  onDone: (items: Item[]) => void
  ref?: Ref<{ submit: () => void }>
  onReadyChange?: (ready: boolean) => void
}

export function Assign({ people, items: initialItems, onDone, ref, onReadyChange }: Props) {
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

  function assignAll(itemId: string) {
    const allIds = people.map(p => p.id)
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      const allAssigned = allIds.every(id => item.assignedTo.includes(id))
      return { ...item, assignedTo: allAssigned ? [] : allIds }
    }))
  }

  function splitEqually() {
    const allIds = people.map(p => p.id)
    setItems(prev => prev.map(item => ({ ...item, assignedTo: allIds })))
  }

  const unassigned = items.filter(i => i.assignedTo.length === 0)
  const canContinue = unassigned.length === 0

  const submitRef = useRef<() => void>(() => {})
  submitRef.current = () => onDone(items)
  useImperativeHandle(ref, () => ({ submit: () => submitRef.current() }), [])

  useEffect(() => {
    onReadyChange?.(canContinue)
  }, [canContinue, onReadyChange])

  return (
    <div>
      <h2 className="font-display text-2xl text-gold mb-1">Assign Items</h2>
      <p className="text-text-secondary text-sm mb-4">
        Tap names to assign. Tap multiple for a shared item.
      </p>

      <button
        onClick={splitEqually}
        className="w-full text-center text-text-secondary text-sm py-2 mb-5 border border-dashed border-border rounded-xl active:border-gold active:text-gold transition-colors"
      >
        Split equally between everyone
      </button>

      <div className="flex flex-col gap-3 mb-3">
        {items.map(item => {
          const allAssigned = people.length > 0 && people.every(p => item.assignedTo.includes(p.id))

          return (
            <Card key={item.id} className={cn(item.assignedTo.length === 0 && 'ring-1 ring-red-900/70')}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-text-primary font-medium">{item.name}</span>
                <div className="text-right">
                  <span className="text-gold font-semibold">${item.price.toFixed(2)}</span>
                  {/* Always rendered so card height never shifts — invisible when only 1 assigned */}
                  <span className={cn(
                    'text-text-secondary text-xs block',
                    item.assignedTo.length > 1 ? '' : 'invisible'
                  )}>
                    ${(item.price / Math.max(item.assignedTo.length, 1)).toFixed(2)} each
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* "All" shortcut pill */}
                <button
                  onClick={() => assignAll(item.id)}
                  className={cn(
                    'rounded-full px-3 py-1 text-sm transition-colors',
                    allAssigned
                      ? 'bg-text-primary/90 text-bg font-semibold'
                      : 'bg-bg border border-border text-text-secondary'
                  )}
                >
                  All
                </button>

                {people.map(person => {
                  const selected = item.assignedTo.includes(person.id)
                  const color = person.color

                  return (
                    <button
                      key={person.id}
                      onClick={() => toggleAssign(item.id, person.id)}
                      className="rounded-full px-3 py-1 text-sm transition-colors"
                      style={selected
                        ? { backgroundColor: color ?? 'var(--color-gold)', color: '#0f0e0a', fontWeight: 600 }
                        : { borderWidth: 1, borderStyle: 'solid', borderColor: color ? `${color}55` : 'var(--color-border)', color: color ? `${color}bb` : 'var(--color-text-secondary)' }
                      }
                    >
                      {person.name}
                    </button>
                  )
                })}
              </div>
            </Card>
          )
        })}
      </div>

      <p className={cn('text-sm text-center mb-6 transition-opacity', canContinue ? 'opacity-0' : 'text-red-400')}>
        {unassigned.length} item{unassigned.length !== 1 ? 's' : ''} still need to be assigned
      </p>

    </div>
  )
}
