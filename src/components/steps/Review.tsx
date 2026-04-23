'use client'

import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Item } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

interface ItemInput {
  id: string
  name: string
  priceStr: string
  assignedTo: string[]
}

interface Props {
  items: Item[]
  tax: number
  tip: number
  label?: string
  onDone: (items: Item[], tax: number, tip: number, total: number, label?: string) => void
}

export function Review({ items: initialItems, tax: initTax, tip: initTip, label: initLabel, onDone }: Props) {
  const [items, setItems] = useState<ItemInput[]>(() =>
    initialItems.map(i => ({ id: i.id, name: i.name, priceStr: i.price ? i.price.toFixed(2) : '', assignedTo: i.assignedTo }))
  )
  const [tax, setTax] = useState(initTax.toFixed(2))
  const [tip, setTip] = useState(initTip.toFixed(2))
  const [label, setLabel] = useState(initLabel ?? '')

  // Total is always derived — no editable state, so tip/tax/items can never diverge from total
  const itemsSum = items.reduce((sum, i) => sum + (parseFloat(i.priceStr) || 0), 0)
  const computedTotal = itemsSum + (parseFloat(tax) || 0) + (parseFloat(tip) || 0)

  function updateItem(id: string, field: 'name' | 'priceStr', value: string) {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item))
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(item => item.id !== id))
  }

  function addItem() {
    setItems(prev => [...prev, { id: uuidv4(), name: '', priceStr: '', assignedTo: [] }])
  }

  function handleDone() {
    const validItems: Item[] = items
      .filter(i => i.name.trim() && parseFloat(i.priceStr) > 0)
      .map(i => ({ id: i.id, name: i.name, price: parseFloat(i.priceStr), assignedTo: i.assignedTo }))
    onDone(validItems, parseFloat(tax) || 0, parseFloat(tip) || 0, computedTotal, label.trim() || undefined)
  }

  const hasValidItems = items.some(i => i.name.trim() && parseFloat(i.priceStr) > 0)

  return (
    <div>
      <h2 className="font-display text-2xl text-gold mb-1">Review Items</h2>
      <p className="text-text-secondary text-sm mb-6">Fix any mistakes before assigning.</p>

      <div className="mb-4">
        <label className="text-text-secondary text-xs uppercase tracking-wider block mb-1">Restaurant</label>
        <Input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Restaurant name (optional)"
        />
      </div>

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
                value={item.priceStr}
                onChange={e => updateItem(item.id, 'priceStr', e.target.value)}
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
        <div>
          <label className="text-text-secondary text-xs uppercase tracking-wider block mb-1">Tax</label>
          <div className="flex items-center gap-1">
            <span className="text-text-secondary text-sm">$</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={tax}
              onChange={e => setTax(e.target.value)}
              className="text-right"
            />
          </div>
        </div>
        <div>
          <label className="text-text-secondary text-xs uppercase tracking-wider block mb-1">Tip</label>
          <div className="flex items-center gap-1">
            <span className="text-text-secondary text-sm">$</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={tip}
              onChange={e => setTip(e.target.value)}
              className="text-right"
            />
          </div>
        </div>
        <div>
          <label className="text-text-secondary text-xs uppercase tracking-wider block mb-1">Total</label>
          <div className="flex items-center gap-1">
            <span className="text-text-secondary text-sm">$</span>
            <span className="text-text-primary font-medium tabular-nums text-sm py-3">{computedTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <Button fullWidth onClick={handleDone} disabled={!hasValidItems}>
        Assign Items →
      </Button>
    </div>
  )
}
