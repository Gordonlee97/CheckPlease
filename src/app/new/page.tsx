'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import type { Person, Item, ScanResult, Step } from '@/lib/types'
import { saveSession } from '@/lib/storage'
import { recordNames } from '@/lib/savedNames'
import { buildShareUrl, buildPlainText, buildVenmoRequestAllUrl } from '@/lib/share'
import { getSavedGroup } from '@/lib/savedGroups'
import { getMyVenmoHandle } from '@/lib/userSettings'
import Link from 'next/link'
import { AddPeople } from '@/components/steps/AddPeople'
import { Scan } from '@/components/steps/Scan'
import { Review } from '@/components/steps/Review'
import { Assign } from '@/components/steps/Assign'
import { SummaryView } from '@/components/steps/SummaryView'
import { ProgressBar } from '@/components/ProgressBar'
import { computeSplit } from '@/lib/splitting'
import { Button } from '@/components/ui/Button'

const STEP_ORDER: Step[] = ['people', 'scan', 'review', 'assign', 'summary']

const STEP_BTN_LABEL: Record<Step, string> = {
  people: "That's Everyone →",
  scan: 'Scan Receipt →',
  review: 'Assign Items →',
  assign: 'See Totals →',
  summary: 'Done',
}

interface StepHandle {
  submit: () => void
}

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
  const [navDirection, setNavDirection] = useState<'forward' | 'back'>('forward')
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set())
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [addPeopleKey, setAddPeopleKey] = useState(0)
  const [sessionId] = useState(() => uuidv4())
  const [createdAt] = useState(() => new Date().toISOString())
  const [scannedFile, setScannedFile] = useState<File | null>(null)
  const [canProceed, setCanProceed] = useState(false)

  useEffect(() => {
    const groupId = new URLSearchParams(window.location.search).get('group')
    if (!groupId) return
    const group = getSavedGroup(groupId)
    if (!group) return
    const people = group.people.map(gp => ({
      id: uuidv4(),
      name: gp.name,
      color: gp.color,
      venmoHandle: gp.venmoHandle,
    }))
    setDraft(d => ({ ...d, people }))
    setCanProceed(people.length >= 2)
    setAddPeopleKey(k => k + 1) // remount AddPeople with new initialPeople
  }, [])
  const [toast, setToast] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const stepRef = useRef<StepHandle>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function navigate(toStep: Step) {
    const currentIdx = STEP_ORDER.indexOf(step)
    const toIdx = STEP_ORDER.indexOf(toStep)
    setNavDirection(toIdx >= currentIdx ? 'forward' : 'back')

    // Pre-compute readiness so the button never flashes disabled on arrival (#7)
    setCanProceed(
      toStep === 'summary' ||
      (toStep === 'people' && draft.people.length >= 2) ||
      (toStep === 'scan' && !!scannedFile) ||
      (toStep === 'review' && draft.items.some(i => i.name.trim() && i.price > 0)) ||
      (toStep === 'assign' && draft.items.every(i => i.assignedTo.length > 0))
    )

    // Navigating back: un-complete the target step and everything forward (#5)
    if (toIdx < currentIdx) {
      setCompletedSteps(prev => {
        const next = new Set(prev)
        STEP_ORDER.slice(toIdx).forEach(s => next.delete(s))
        return next
      })
    }

    scrollRef.current?.scrollTo({ top: 0 })
    setStep(toStep)
  }

  function goBack() {
    const idx = STEP_ORDER.indexOf(step)
    if (idx > 0) navigate(STEP_ORDER[idx - 1])
  }

  function markCompleted(s: Step) {
    setCompletedSteps(prev => new Set([...prev, s]))
  }

  function handlePeopleDone(people: Person[]) {
    recordNames(people.map(p => p.name))
    setDraft(d => ({ ...d, people }))
    markCompleted('people')
    navigate('scan')
  }

  function handleScanDone(result: ScanResult) {
    const items: Item[] = result.items.map(i => ({
      id: uuidv4(),
      name: i.name,
      price: i.price,
      assignedTo: [],
      confidence: i.confidence,
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
    markCompleted('scan')
    navigate('review')
  }

  function handleReviewDone(items: Item[], tax: number, tip: number, total: number, label?: string) {
    const subtotal = items.reduce((sum, i) => sum + i.price, 0)
    setDraft(d => ({ ...d, items, tax, tip, total, subtotal, label: label ?? d.label }))
    markCompleted('review')
    navigate('assign')
  }

  function handleAssignDone(items: Item[]) {
    setDraft(d => ({ ...d, items }))
    markCompleted('assign')
    navigate('summary')
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

  async function handleShareLink() {
    if (sharing) return
    setSharing(true)
    try {
      const url = buildShareUrl(session)
      if (navigator.share) {
        try { await navigator.share({ title: 'CheckPlease split', url }); return } catch {}
      }
      try { await navigator.clipboard.writeText(url); showToast('Link copied!') }
      catch { showToast('Could not copy link') }
    } finally {
      setSharing(false)
    }
  }

  async function handleCopyText() {
    if (sharing) return
    setSharing(true)
    try {
      const text = buildPlainText(session, shares, getMyVenmoHandle())
      try { await navigator.clipboard.writeText(text); showToast('Copied to clipboard!') }
      catch { showToast('Could not copy text') }
    } finally {
      setSharing(false)
    }
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
  const allVenmoUrl = buildVenmoRequestAllUrl(session, shares, getMyVenmoHandle() ?? undefined)

  return (
    <>
      <main className="flex flex-col h-dvh max-w-md mx-auto">
        <div className="shrink-0 px-6 pt-6">
          <div className="flex items-center justify-between mb-4">
            {step !== 'people' ? (
              <button
                onClick={goBack}
                className="text-text-secondary hover:text-text-primary text-sm"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}
            <Link href="/" className="text-text-secondary hover:text-text-primary text-sm">
              Cancel
            </Link>
          </div>

          <ProgressBar
            current={step}
            completed={completedSteps}
            onNavigate={navigate}
          />
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 px-6 pb-36">
          <div key={step} className={navDirection === 'forward' ? 'animate-slide-from-right' : 'animate-slide-from-left'}>
            {step === 'people' && (
              <AddPeople
                key={addPeopleKey}
                initialPeople={draft.people}
                onDone={handlePeopleDone}
                ref={stepRef}
                onReadyChange={setCanProceed}
              />
            )}
            {step === 'scan' && (
              <Scan
                initialFile={scannedFile ?? undefined}
                onFileSelect={setScannedFile}
                onDone={handleScanDone}
                ref={stepRef}
                onReadyChange={setCanProceed}
              />
            )}
            {step === 'review' && (
              <Review
                items={draft.items}
                tax={draft.tax}
                tip={draft.tip}
                label={draft.label}
                onDone={handleReviewDone}
                ref={stepRef}
                onReadyChange={setCanProceed}
              />
            )}
            {step === 'assign' && (
              <Assign
                people={draft.people}
                items={draft.items}
                onDone={handleAssignDone}
                ref={stepRef}
                onReadyChange={setCanProceed}
              />
            )}
            {step === 'summary' && (
              <SummaryView
                session={session}
                shares={shares}
                onDone={handleSummaryDone}
                ref={stepRef}
                onReadyChange={setCanProceed}
              />
            )}
          </div>
        </div>
      </main>

      {/* Fixed bottom bar — sibling of animated wrapper, never inside a CSS transform */}
      <div className="fixed bottom-0 left-0 right-0 pt-8 pb-6-safe bg-gradient-to-t from-bg to-transparent pointer-events-none">
        <div className="max-w-md mx-auto px-6 pointer-events-auto">
          {step === 'summary' ? (
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <Button fullWidth onClick={handleShareLink} disabled={sharing}>Share link</Button>
                <Button fullWidth variant="ghost" onClick={handleCopyText} disabled={sharing}>Copy text</Button>
              </div>
              <Button fullWidth variant="green" onClick={handleSummaryDone}>Done</Button>
            </div>
          ) : (
            <>
              {step === 'people' && !canProceed && (
                <p className="text-center text-text-secondary text-xs mb-3">Add at least 2 people</p>
              )}
              {(step !== 'scan' || canProceed || !!scannedFile) && (
                <Button
                  fullWidth
                  onClick={() => stepRef.current?.submit()}
                  disabled={!canProceed}
                >
                  {step === 'scan' && !canProceed && scannedFile ? 'Scanning…' : STEP_BTN_LABEL[step]}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface text-text-primary px-4 py-2 rounded-xl shadow-lg text-sm z-50">
          {toast}
        </div>
      )}
    </>
  )
}
