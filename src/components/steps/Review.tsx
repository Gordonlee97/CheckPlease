'use client'

import { useState, useImperativeHandle, useRef, useEffect, type Ref } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Item } from '@/lib/types'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

interface ItemInput {
  id: string
  name: string
  priceStr: string
  assignedTo: string[]
  confidence?: number
}

interface Props {
  items: Item[]
  tax: number
  tip: number
  label?: string
  onDone: (items: Item[], tax: number, tip: number, total: number, label?: string) => void
  ref?: Ref<{ submit: () => void }>
  onReadyChange?: (ready: boolean) => void
}

export function Review({ items: initialItems, tax: initTax, tip: initTip, label: initLabel, onDone, ref, onReadyChange }: Props) {
  const [items, setItems] = useState<ItemInput[]>(() =>
    initialItems.map(i => ({
      id: i.id,
      name: i.name,
      priceStr: i.price ? i.price.toFixed(2) : '',
      assignedTo: i.assignedTo,
      confidence: i.confidence,
    }))
  )
  const [tax, setTax] = useState(initTax.toFixed(2))
  const [tip, setTip] = useState(initTip.toFixed(2))
  const [label, setLabel] = useState(initLabel ?? '')

  // Total is always derived — no editable state, so tip/tax/items can never diverge from total
  const itemsSum = items.reduce((sum, i) => sum + (parseFloat(i.priceStr) || 0), 0)
  const computedTotal = itemsSum + (parseFloat(tax) || 0) + (parseFloat(tip) || 0)

  const hasLowConfidence = items.some(i => i.confidence !== undefined && i.confidence < 0.8)

  function formatCurrency(val: string): string {
    const num = parseFloat(val)
    if (isNaN(num)) return val
    return Math.max(0, num).toFixed(2)
  }

  function updateItem(id: string, field: 'name' | 'priceStr', value: string) {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item))
  }

  function formatItem(id: string) {
    setItems(prev => prev.map(item => item.id === id ? { ...item, priceStr: formatCurrency(item.priceStr) } : item))
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

  const submitRef = useRef<() => void>(() => {})
  submitRef.current = handleDone
  useImperativeHandle(ref, () => ({ submit: () => submitRef.current() }), [])

  useEffect(() => {
    onReadyChange?.(hasValidItems)
  }, [hasValidItems, onReadyChange])

  return (
    <div>
      <h2 className="font-display text-2xl text-gold mb-1">Review Items</h2>
      <p className="text-text-secondary text-sm mb-1">Fix any mistakes before assigning.</p>
      {hasLowConfidence && (
        <p className="text-amber-400/80 text-xs mb-5">⚠ Some prices had low scan confidence — double-check those items.</p>
      )}
      {!hasLowConfidence && <div className="mb-6" />}

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
            {item.confidence !== undefined && item.confidence < 0.8 && (
              <span
                className="text-amber-400 text-sm shrink-0"
                title={`Scan confidence: ${Math.round(item.confidence * 100)}%`}
              >
                ⚠
              </span>
            )}
            <Input
              className="flex-1"
              value={item.name}
              onChange={e => updateItem(item.id, 'name', e.target.value)}
              placeholder="Item name"
            />
            <div className="flex items-center gap-1 shrink-0 w-24">
              <span className="text-text-secondary text-sm shrink-0">$</span>
              <Input
                className="text-right min-w-0"
                type="text"
                inputMode="decimal"
                value={item.priceStr}
                onChange={e => updateItem(item.id, 'priceStr', e.target.value)}
                onBlur={() => formatItem(item.id)}
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
        {([
          { label: 'Tax', content: <Input type="text" inputMode="decimal" value={tax} onChange={e => setTax(e.target.value)} onBlur={() => setTax(formatCurrency(tax))} className="text-right" /> },
          { label: 'Tip', content: <Input type="text" inputMode="decimal" value={tip} onChange={e => setTip(e.target.value)} onBlur={() => setTip(formatCurrency(tip))} className="text-right" /> },
          { label: 'Total', content: <Input readOnly value={computedTotal.toFixed(2)} className="text-right opacity-50 cursor-default" /> },
        ] as const).map(({ label, content }) => (
          <div key={label}>
            <div className="flex items-center gap-1 mb-1">
              <span className="text-sm invisible" aria-hidden="true">$</span>
              <label className="text-text-secondary text-xs uppercase tracking-wider">{label}</label>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-text-secondary text-sm">$</span>
              {content}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
