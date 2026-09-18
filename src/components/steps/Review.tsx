'use client'

import { useState, useImperativeHandle, useEffect, useRef, type Ref } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Item } from '@/lib/types'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { currencySymbol, normalizeCurrency, DEFAULT_CURRENCY } from '@/lib/money'

interface ItemInput {
  id: string
  name: string
  priceStr: string
  assignedTo: string[]
  confidence?: number
}

function blankItem(): ItemInput {
  return { id: uuidv4(), name: '', priceStr: '', assignedTo: [] }
}

// An untouched row (the starter row, or one added by mistake) is ignored.
function isEmptyRow(item: ItemInput): boolean {
  return !item.name.trim() && !item.priceStr.trim()
}

function isComplete(item: ItemInput): boolean {
  return Boolean(item.name.trim()) && parseFloat(item.priceStr) > 0
}

// Currencies offered in the override. The detected one is added if missing.
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'MXN', 'KRW']

export interface ReviewResult {
  items: Item[]
  tax: number
  tip: number
  total: number
  label?: string
  currency: string
}

interface Props {
  items: Item[]
  tax: number
  tip: number
  label?: string
  currency?: string
  onDone: (result: ReviewResult) => void
  // Fires on every edit so the saved draft survives a refresh mid-typing
  onEdit?: (result: ReviewResult) => void
  ref?: Ref<{ submit: () => void }>
  onReadyChange?: (ready: boolean) => void
}

export function Review({ items: initialItems, tax: initTax, tip: initTip, label: initLabel, currency: initCurrency, onDone, onEdit, ref, onReadyChange }: Props) {
  const [items, setItems] = useState<ItemInput[]>(() =>
    initialItems.length === 0
      // Manual entry (or a scan that found nothing): give them a row to type into
      ? [blankItem()]
      : initialItems.map(i => ({
          id: i.id,
          name: i.name,
          priceStr: i.price ? i.price.toFixed(2) : '',
          assignedTo: i.assignedTo,
          confidence: i.confidence,
        }))
  )
  const itemCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [tax, setTax] = useState(initTax.toFixed(2))
  const [tip, setTip] = useState(initTip.toFixed(2))
  const [label, setLabel] = useState(initLabel ?? '')
  const [currency, setCurrency] = useState(normalizeCurrency(initCurrency) ?? DEFAULT_CURRENCY)

  // Total is always derived — no editable state, so tip/tax/items can never diverge from total
  const itemsSum = items.reduce((sum, i) => sum + (parseFloat(i.priceStr) || 0), 0)
  const computedTotal = itemsSum + Math.max(0, parseFloat(tax) || 0) + Math.max(0, parseFloat(tip) || 0)

  const hasLowConfidence = items.some(i => i.confidence !== undefined && i.confidence < 0.8)

  function formatCurrency(val: string): string {
    const num = parseFloat(val)
    if (isNaN(num)) return val
    return Math.max(0, num).toFixed(2)
  }

  function updateItem(id: string, field: 'name' | 'priceStr', value: string) {
    setItems(prev => prev.map(item =>
      item.id === id
        ? { ...item, [field]: value, ...(field === 'priceStr' ? { confidence: undefined } : {}) }
        : item
    ))
  }

  function formatItem(id: string) {
    setItems(prev => prev.map(item => item.id === id ? { ...item, priceStr: formatCurrency(item.priceStr) } : item))
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(item => item.id !== id))
  }

  function addItem() {
    setItems(prev => [...prev, blankItem()])
  }

  function focusNextReviewInput(currentEl: HTMLElement) {
    const all = Array.from(document.querySelectorAll<HTMLInputElement>('[data-review-input]'))
    const idx = all.indexOf(currentEl as HTMLInputElement)
    if (idx >= 0 && idx < all.length - 1) {
      all[idx + 1].focus()
      all[idx + 1].select()
    }
  }

  function currentResult(onlyComplete = true): ReviewResult {
    const rows = onlyComplete ? items.filter(isComplete) : items
    return {
      items: rows.map(i => ({ id: i.id, name: i.name, price: parseFloat(i.priceStr), assignedTo: i.assignedTo, confidence: i.confidence })),
      tax: Math.max(0, parseFloat(tax) || 0),
      tip: Math.max(0, parseFloat(tip) || 0),
      total: computedTotal,
      label: label.trim() || undefined,
      currency,
    }
  }

  function handleDone() {
    if (!canContinue) return
    onDone(currentResult())
  }

  // A half-filled row means the scan missed something. Silently dropping it
  // would quietly remove money from the split, so it blocks instead.
  const incomplete = items.filter(i => !isEmptyRow(i) && !isComplete(i))
  const missingPrice = incomplete.filter(i => !(parseFloat(i.priceStr) > 0)).length
  const missingName = incomplete.length - missingPrice
  const canContinue = incomplete.length === 0 && items.some(isComplete)

  // No deps: rebuilt each render so submit() always sees the current items
  useImperativeHandle(ref, () => ({ submit: handleDone }))

  useEffect(() => {
    onReadyChange?.(canContinue)
  }, [canContinue, onReadyChange])

  const onEditRef = useRef(onEdit)
  useEffect(() => { onEditRef.current = onEdit })

  // Keep the parent's draft in step with what's typed, so a refresh keeps it
  useEffect(() => {
    onEditRef.current?.(currentResult())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentResult reads exactly these
  }, [items, tax, tip, computedTotal, label, currency])

  return (
    <div>
      <h2 className="font-display text-4xl tracking-wide text-gold mb-1">Review Items</h2>
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
          <Card
            key={item.id}
            ref={el => { itemCardRefs.current[item.id] = el }}
            className={cn(
              'flex gap-2 items-center',
              !isEmptyRow(item) && !isComplete(item) && 'ring-2 ring-red-500/70'
            )}
          >
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
              onKeyDown={e => { if (e.key === 'Enter') focusNextReviewInput(e.currentTarget) }}
              placeholder="Item name"
              data-review-input
            />
            <div className="flex items-center gap-1 shrink-0 w-24">
              <span className="text-text-secondary text-sm shrink-0">{currencySymbol(currency)}</span>
              <Input
                className="text-right min-w-0"
                type="text"
                inputMode="decimal"
                value={item.priceStr}
                placeholder="0.00"
                onChange={e => updateItem(item.id, 'priceStr', e.target.value)}
                onBlur={() => formatItem(item.id)}
                onKeyDown={e => { if (e.key === 'Enter') { formatItem(item.id); focusNextReviewInput(e.currentTarget) } }}
                data-review-input
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

      {incomplete.length > 0 && (
        <div className="flex flex-col items-center gap-2 mb-6">
          <p className="text-sm text-red-400">
            {[
              missingPrice > 0 && `${missingPrice} item${missingPrice !== 1 ? 's' : ''} need${missingPrice === 1 ? 's' : ''} a price`,
              missingName > 0 && `${missingName} item${missingName !== 1 ? 's' : ''} need${missingName === 1 ? 's' : ''} a name`,
            ].filter(Boolean).join(' · ')}
          </p>
          <Button
            variant="ghost"
            onClick={() => itemCardRefs.current[incomplete[0].id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          >
            Go to item ↓
          </Button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mb-3">
        {([
          { label: 'Tax', content: <Input type="text" inputMode="decimal" value={tax} onChange={e => setTax(e.target.value)} onBlur={() => setTax(formatCurrency(tax))} onKeyDown={e => { if (e.key === 'Enter') focusNextReviewInput(e.currentTarget) }} className="text-right" data-review-input /> },
          { label: 'Tip', content: <Input type="text" inputMode="decimal" value={tip} onChange={e => setTip(e.target.value)} onBlur={() => setTip(formatCurrency(tip))} onKeyDown={e => { if (e.key === 'Enter') setTip(formatCurrency(tip)) }} className="text-right" data-review-input /> },
          { label: 'Total', content: <Input readOnly value={computedTotal.toFixed(2)} className="text-right opacity-50 cursor-default" /> },
        ] as const).map(({ label, content }) => (
          <div key={label}>
            <div className="flex items-center gap-1 mb-1">
              <span className="text-sm invisible" aria-hidden="true">{currencySymbol(currency)}</span>
              <label className="text-text-secondary text-xs uppercase tracking-wider">{label}</label>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-text-secondary text-sm">{currencySymbol(currency)}</span>
              {content}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 mb-8">
        <label htmlFor="currency" className="text-text-secondary/60 text-xs uppercase tracking-wider">Currency</label>
        <select
          id="currency"
          value={currency}
          onChange={e => setCurrency(e.target.value)}
          className="bg-surface border border-border rounded-lg px-2 py-1 text-sm text-text-primary outline-none focus:border-gold"
        >
          {[...new Set([currency, ...CURRENCIES])].map(code => (
            <option key={code} value={code}>{code}</option>
          ))}
        </select>
      </div>

    </div>
  )
}
