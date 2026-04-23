'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import type { Person, Item, ScanResult } from '@/lib/types'
import { saveSession } from '@/lib/storage'
import { AddPeople } from '@/components/steps/AddPeople'
import { Scan } from '@/components/steps/Scan'
import { Review } from '@/components/steps/Review'
import { Assign } from '@/components/steps/Assign'
import { SummaryView } from '@/components/steps/SummaryView'
import { computeSplit } from '@/lib/splitting'

type Step = 'people' | 'scan' | 'review' | 'assign' | 'summary'

interface Draft {
  people: Person[]
  items: Item[]
  subtotal: number
  tax: number
  tip: number
  total: number
  label?: string
}

const EMPTY_DRAFT: Draft = { people: [], items: [], subtotal: 0, tax: 0, tip: 0, total: 0 }

export default function NewSplitPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('people')
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [sessionId] = useState(() => uuidv4())
  const [createdAt] = useState(() => new Date().toISOString())

  function handlePeopleDone(people: Person[]) {
    setDraft(d => ({ ...d, people }))
    setStep('scan')
  }

  function handleScanDone(result: ScanResult) {
    const items: Item[] = result.items.map(i => ({
      id: uuidv4(),
      name: i.name,
      price: i.price,
      assignedTo: [],
    }))
    setDraft(d => ({
      ...d,
      items,
      subtotal: result.subtotal,
      tax: result.tax,
      tip: result.tip,
      total: result.total,
      label: result.label,
    }))
    setStep('review')
  }

  function handleReviewDone(items: Item[], tax: number, tip: number, total: number, label?: string) {
    const subtotal = items.reduce((sum, i) => sum + i.price, 0)
    setDraft(d => ({ ...d, items, tax, tip, total, subtotal, label: label ?? d.label }))
    setStep('assign')
  }

  function handleAssignDone(items: Item[]) {
    setDraft(d => ({ ...d, items }))
    setStep('summary')
  }

  async function handleSummaryDone() {
    const session = {
      id: sessionId,
      createdAt,
      label: draft.label,
      people: draft.people,
      items: draft.items,
      subtotal: draft.subtotal,
      tax: draft.tax,
      tip: draft.tip,
      total: draft.total,
    }
    await saveSession(session)
    router.push('/')
  }

  const session = {
    id: sessionId,
    createdAt,
    label: draft.label,
    people: draft.people,
    items: draft.items,
    subtotal: draft.subtotal,
    tax: draft.tax,
    tip: draft.tip,
    total: draft.total,
  }
  const shares = step === 'summary'
    ? computeSplit(draft.people, draft.items, draft.tax, draft.tip, draft.total)
    : []

  return (
    <main className="min-h-screen p-6 max-w-md mx-auto">
      {step === 'people' && <AddPeople onDone={handlePeopleDone} />}
      {step === 'scan' && <Scan onDone={handleScanDone} />}
      {step === 'review' && (
        <Review
          items={draft.items}
          tax={draft.tax}
          tip={draft.tip}
          total={draft.total}
          label={draft.label}
          onDone={handleReviewDone}
        />
      )}
      {step === 'assign' && (
        <Assign
          people={draft.people}
          items={draft.items}
          onDone={handleAssignDone}
        />
      )}
      {step === 'summary' && (
        <SummaryView
          session={session}
          shares={shares}
          onDone={handleSummaryDone}
        />
      )}
    </main>
  )
}
