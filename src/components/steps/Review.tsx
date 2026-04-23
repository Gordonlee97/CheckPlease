'use client'

import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Item } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

interface Props {
  items: Item[]
  tax: number
  tip: number
  total: number
  onDone: (items: Item[], tax: number, tip: number, total: number) => void
}

export function Review({ items: initialItems, tax: initTax, tip: initTip, total: initTotal, onDone }: Props) {
  const [items, setItems] = useState<Item[]>(initialItems)
  const [tax, setTax] = useState(initTax.toFixed(2))
  const [tip, setTip] = useState(initTip.toFixed(2))
  const [total, setTotal] = useState(initTotal.toFixed(2))

  function updateItem(id: string, field: 'name' | 'price', value: string) {
    setItems(prev => prev.map(item =>
      item.id === id
        ? { ...item, [field]: field === 'price' ? parseFloat(value) || 0 : value }
        : item
    ))
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(item => item.id !== id))
  }

  function addItem() {
    setItems(prev => [...prev, { id: uuidv4(), name: '', price: 0, assignedTo: [] }])
  }

  function handleDone() {
    const validItems = items.filter(i => i.name.trim() && i.price > 0)
    onDone(validItems, parseFloat(tax) || 0, parseFloat(tip) || 0, parseFloat(total) || 0)
  }

  return (
    <div>
      <h2 className="font-display text-2xl text-gold mb-1">Review Items</h2>
      <p className="text-text-secondary text-sm mb-6">Fix any mistakes before assigning.</p>

      <div className="flex flex-col gap-2 mb-4">
        {items.map(item => (
          <Card key={item.id} className="flex gap-2 items-center">
            <Input
              className="flex-1"
              value={item.name}
              onChange={e => updateItem(item.id, 'name', e.target.value)}
              placeholder="Item name"
            />
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-text-secondary text-sm">$</span>
              <Input
                className="w-20 text-right"
                type="number"
                step="0.01"
                min="0"
                value={item.price}
                onChange={e => updateItem(item.id, 'price', e.target.value)}
              />
            </div>
            <button
              onClick={() => removeItem(item.id)}
              className="text-text-secondary hover:text-text-primary text-lg shrink-0"
              aria-label="Remove item"
            >
              ×
            </button>
          </Card>
        ))}
      </div>

      <button
        onClick={addItem}
        className="w-full text-center text-gold text-sm py-2 mb-6 border border-dashed border-border rounded-xl"
      >
        + Add item
      </button>

      <div className="grid grid-cols-3 gap-2 mb-8">
        {[
          { label: 'Tax', value: tax, setter: setTax },
          { label: 'Tip', value: tip, setter: setTip },
          { label: 'Total', value: total, setter: setTotal },
        ].map(({ label, value, setter }) => (
          <div key={label}>
            <label className="text-text-secondary text-xs uppercase tracking-wider block mb-1">{label}</label>
            <div className="flex items-center gap-1">
              <span className="text-text-secondary text-sm">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={value}
                onChange={e => setter(e.target.value)}
                className="text-right"
              />
            </div>
          </div>
        ))}
      </div>

      <Button fullWidth onClick={handleDone} disabled={items.filter(i => i.name.trim() && i.price > 0).length === 0}>
        Assign Items →
      </Button>
    </div>
  )
}
