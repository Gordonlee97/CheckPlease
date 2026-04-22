# CheckPlease Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first PWA that scans a restaurant receipt, assigns items to people (with shared-item support), and computes exact per-person totals with proportional tax and tip.

**Architecture:** Single Next.js 14 app with client-side multi-step flow managed by React state, a server-side API route proxying Azure Document Intelligence (Claude Vision fallback), IndexedDB for local session history, and lz-string-encoded shareable URLs that require no backend storage.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, `idb`, `lz-string`, Azure Document Intelligence REST API, Anthropic SDK, Jest, Vercel.

---

## File Map

```
src/
  app/
    layout.tsx                   Root layout, metadata, Dark Gold CSS vars
    globals.css                  Tailwind base + CSS custom properties
    page.tsx                     Home screen (session history + New Split)
    new/
      page.tsx                   Multi-step new split flow (step state machine)
    share/
      page.tsx                   Read-only shareable view (reads URL hash)
    api/
      scan/
        route.ts                 POST /api/scan — Azure OCR + Claude fallback
  components/
    ui/
      Button.tsx
      Card.tsx
      Input.tsx
    steps/
      AddPeople.tsx              Step 1: enter names
      Scan.tsx                   Step 2: camera/upload + OCR call
      Review.tsx                 Step 3: edit extracted items
      Assign.tsx                 Step 4: assign items to people
      SummaryView.tsx            Step 5: totals + share (also used by history page)
    history/
      [id]/
        page.tsx               Read-only past session view (loads from IndexedDB)
  lib/
    types.ts                     Session, Person, Item, ScanResult interfaces
    splitting.ts                 computeSplit() pure function
    share.ts                     encodeSession, decodeSession, buildShareUrl, buildPlainText
    ocr.ts                       Azure + Claude response → ScanResult normalizer
    storage.ts                   IndexedDB CRUD via idb
    imageUtils.ts                Client-side image resize (canvas)
__tests__/
  splitting.test.ts
  share.test.ts
  ocr.test.ts
public/
  manifest.json
next.config.ts
tailwind.config.ts
```

---

## Task 1: Scaffold project and install dependencies

**Files:**
- Create: `next.config.ts`, `tailwind.config.ts`, `package.json` (via CLI)

- [ ] **Step 1: Bootstrap Next.js app**

```bash
cd C:/Users/gordo/source/repos/CheckPlease
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
```

When prompted, accept all defaults. The `--no-git` flag skips re-initializing git (we already have a repo).

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install idb lz-string @anthropic-ai/sdk
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install --save-dev jest jest-environment-jsdom ts-jest @types/jest
```

- [ ] **Step 4: Add jest config to `package.json`**

Add this to `package.json` (merge with existing):

```json
{
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "moduleNameMapper": {
      "^@/(.*)$": "<rootDir>/src/$1"
    }
  },
  "scripts": {
    "test": "jest"
  }
}
```

- [ ] **Step 5: Verify dev server starts**

```bash
npm run dev
```

Expected: server starts on http://localhost:3000 with default Next.js page. Stop with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js PWA with dependencies"
```

---

## Task 2: TypeScript types

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: Write `src/lib/types.ts`**

```typescript
export interface Person {
  id: string
  name: string
}

export interface Item {
  id: string
  name: string
  price: number        // full line price (quantity already multiplied)
  assignedTo: string[] // person ids; cost splits equally among all listed
}

export interface Session {
  id: string
  createdAt: string    // ISO datetime
  label?: string       // restaurant name from receipt
  people: Person[]
  items: Item[]
  subtotal: number     // from receipt
  tax: number          // from receipt
  tip: number          // from receipt; 0 if absent
  total: number        // from receipt
}

export interface ScanResult {
  label?: string
  items: Array<{ name: string; price: number }>
  subtotal: number
  tax: number
  tip: number
  total: number
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add TypeScript types"
```

---

## Task 3: Splitting algorithm (TDD)

**Files:**
- Create: `src/lib/splitting.ts`
- Create: `__tests__/splitting.test.ts`

- [ ] **Step 1: Write failing tests in `__tests__/splitting.test.ts`**

```typescript
import { computeSplit } from '../src/lib/splitting'
import { Person, Item } from '../src/lib/types'

const gordon: Person = { id: 'g', name: 'Gordon' }
const sarah: Person = { id: 's', name: 'Sarah' }
const mike: Person = { id: 'm', name: 'Mike' }

describe('computeSplit', () => {
  it('single person takes all items, tax, and tip', () => {
    const items: Item[] = [{ id: '1', name: 'Burger', price: 14, assignedTo: ['g'] }]
    const result = computeSplit([gordon], items, 2, 4, 20)
    expect(result).toHaveLength(1)
    expect(result[0].itemSubtotal).toBe(14)
    expect(result[0].taxShare).toBe(2)
    expect(result[0].tipShare).toBe(4)
    expect(result[0].total).toBe(20)
  })

  it('two people split proportionally by subtotal', () => {
    const items: Item[] = [
      { id: '1', name: 'Burger', price: 14, assignedTo: ['g'] },
      { id: '2', name: 'Salad', price: 10, assignedTo: ['s'] },
    ]
    const result = computeSplit([gordon, sarah], items, 2.4, 4.8, 31.2)
    const g = result.find(r => r.personId === 'g')!
    const s = result.find(r => r.personId === 's')!
    expect(g.itemSubtotal).toBe(14)
    expect(g.taxShare).toBe(1.4)
    expect(g.tipShare).toBe(2.8)
    expect(g.total).toBe(18.2)
    expect(s.total).toBe(13)
    expect(g.total + s.total).toBeCloseTo(31.2, 10)
  })

  it('shared item splits cost equally among assignees', () => {
    const items: Item[] = [
      { id: '1', name: 'Burger', price: 14, assignedTo: ['g'] },
      { id: '2', name: 'Nachos', price: 12, assignedTo: ['g', 's'] },
    ]
    const result = computeSplit([gordon, sarah], items, 0, 0, 26)
    const g = result.find(r => r.personId === 'g')!
    const s = result.find(r => r.personId === 's')!
    expect(g.itemSubtotal).toBe(20) // 14 + 6
    expect(s.itemSubtotal).toBe(6)
    expect(g.total + s.total).toBe(26)
  })

  it('rounding guarantee: totals sum exactly to receiptTotal', () => {
    // 3 people share $10 item equally — classic floating-point rounding problem
    const items: Item[] = [{ id: '1', name: 'Shared', price: 10, assignedTo: ['g', 's', 'm'] }]
    const result = computeSplit([gordon, sarah, mike], items, 1, 2, 13)
    const sum = result.reduce((acc, r) => acc + r.total, 0)
    expect(Math.round(sum * 100)).toBe(Math.round(13 * 100))
  })

  it('marks shared items and records split price per person', () => {
    const items: Item[] = [{ id: '1', name: 'Nachos', price: 12, assignedTo: ['g', 's'] }]
    const result = computeSplit([gordon, sarah], items, 0, 0, 12)
    const g = result.find(r => r.personId === 'g')!
    expect(g.assignedItems[0].shared).toBe(true)
    expect(g.assignedItems[0].price).toBe(6)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest __tests__/splitting.test.ts
```

Expected: FAIL — `Cannot find module '../src/lib/splitting'`

- [ ] **Step 3: Implement `src/lib/splitting.ts`**

```typescript
import type { Item, Person } from './types'

export interface AssignedItemShare {
  name: string
  price: number   // this person's share of the item price
  shared: boolean
}

export interface PersonShare {
  personId: string
  name: string
  itemSubtotal: number
  taxShare: number
  tipShare: number
  total: number
  assignedItems: AssignedItemShare[]
}

export function computeSplit(
  people: Person[],
  items: Item[],
  tax: number,
  tip: number,
  receiptTotal: number
): PersonShare[] {
  const computedSubtotal = items.reduce((sum, item) => sum + item.price, 0)

  const shares: PersonShare[] = people.map(person => {
    const assignedItems: AssignedItemShare[] = items
      .filter(item => item.assignedTo.includes(person.id))
      .map(item => ({
        name: item.name,
        price: item.price / item.assignedTo.length,
        shared: item.assignedTo.length > 1,
      }))

    const itemSubtotal = assignedItems.reduce((sum, i) => sum + i.price, 0)
    const taxShare = computedSubtotal > 0 ? (itemSubtotal / computedSubtotal) * tax : 0
    const tipShare = computedSubtotal > 0 ? (itemSubtotal / computedSubtotal) * tip : 0

    return {
      personId: person.id,
      name: person.name,
      itemSubtotal: round2(itemSubtotal),
      taxShare: round2(taxShare),
      tipShare: round2(tipShare),
      total: round2(itemSubtotal + taxShare + tipShare),
      assignedItems,
    }
  })

  // Rounding guarantee: adjust largest share if sum drifts from receiptTotal
  const computedTotal = round2(shares.reduce((sum, s) => sum + s.total, 0))
  const diff = round2(receiptTotal - computedTotal)
  if (diff !== 0 && shares.length > 0) {
    const maxIdx = shares.reduce((mi, s, i, arr) => (s.total > arr[mi].total ? i : mi), 0)
    shares[maxIdx].total = round2(shares[maxIdx].total + diff)
  }

  return shares
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest __tests__/splitting.test.ts
```

Expected: PASS — 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/splitting.ts __tests__/splitting.test.ts
git commit -m "feat: splitting algorithm with rounding guarantee (TDD)"
```

---

## Task 4: Share utilities (TDD)

**Files:**
- Create: `src/lib/share.ts`
- Create: `__tests__/share.test.ts`

- [ ] **Step 1: Write failing tests in `__tests__/share.test.ts`**

```typescript
import { encodeSession, decodeSession, buildPlainText } from '../src/lib/share'
import type { Session } from '../src/lib/types'
import type { PersonShare } from '../src/lib/splitting'

const session: Session = {
  id: 'abc',
  createdAt: '2026-04-22T20:00:00.000Z',
  label: 'The Burger Place',
  people: [
    { id: 'g', name: 'Gordon' },
    { id: 's', name: 'Sarah' },
  ],
  items: [
    { id: '1', name: 'Burger', price: 14, assignedTo: ['g'] },
    { id: '2', name: 'Nachos', price: 12, assignedTo: ['g', 's'] },
  ],
  subtotal: 26,
  tax: 2.6,
  tip: 5.2,
  total: 33.8,
}

describe('encodeSession / decodeSession', () => {
  it('round-trips a session through encode and decode', () => {
    const encoded = encodeSession(session)
    const decoded = decodeSession(encoded)
    expect(decoded).toEqual(session)
  })

  it('encoded string contains only URL-safe characters', () => {
    const encoded = encodeSession(session)
    expect(encoded).toMatch(/^[A-Za-z0-9\-_.~]*$/)
  })

  it('decodeSession returns null for invalid input', () => {
    expect(decodeSession('not-valid-data!!')).toBeNull()
  })
})

describe('buildPlainText', () => {
  const shares: PersonShare[] = [
    {
      personId: 'g',
      name: 'Gordon',
      itemSubtotal: 20,
      taxShare: 2,
      tipShare: 4,
      total: 26,
      assignedItems: [
        { name: 'Burger', price: 14, shared: false },
        { name: 'Nachos', price: 6, shared: true },
      ],
    },
    {
      personId: 's',
      name: 'Sarah',
      itemSubtotal: 6,
      taxShare: 0.6,
      tipShare: 1.2,
      total: 7.8,
      assignedItems: [{ name: 'Nachos', price: 6, shared: true }],
    },
  ]

  it('includes restaurant name and each person', () => {
    const text = buildPlainText(session, shares)
    expect(text).toContain('The Burger Place')
    expect(text).toContain('Gordon')
    expect(text).toContain('Sarah')
  })

  it('marks shared items', () => {
    const text = buildPlainText(session, shares)
    expect(text).toContain('Nachos (shared)')
  })

  it('includes YOU OWE amount for each person', () => {
    const text = buildPlainText(session, shares)
    expect(text).toContain('$26.00')
    expect(text).toContain('$7.80')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest __tests__/share.test.ts
```

Expected: FAIL — `Cannot find module '../src/lib/share'`

- [ ] **Step 3: Implement `src/lib/share.ts`**

```typescript
import LZString from 'lz-string'
import type { Session } from './types'
import type { PersonShare } from './splitting'

export function encodeSession(session: Session): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(session))
}

export function decodeSession(encoded: string): Session | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded)
    if (!json) return null
    return JSON.parse(json) as Session
  } catch {
    return null
  }
}

export function buildShareUrl(session: Session): string {
  const encoded = encodeSession(session)
  return `${window.location.origin}/share#${encoded}`
}

export function buildPlainText(session: Session, shares: PersonShare[]): string {
  const date = new Date(session.createdAt).toLocaleDateString()
  const header = `CheckPlease — ${session.label ?? 'Dinner'} ${date}`

  const lines = shares.map(share => {
    const itemNames = share.assignedItems
      .map(i => (i.shared ? `${i.name} (shared)` : i.name))
      .join(' · ')
    return [
      `${share.name}: ${itemNames}`,
      `  Items $${share.itemSubtotal.toFixed(2)} · Tax $${share.taxShare.toFixed(2)} · Tip $${share.tipShare.toFixed(2)}`,
      `  YOU OWE: $${share.total.toFixed(2)}`,
    ].join('\n')
  })

  return [header, '', ...lines].join('\n')
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest __tests__/share.test.ts
```

Expected: PASS — 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/share.ts __tests__/share.test.ts
git commit -m "feat: share URL encoding and plain text generation (TDD)"
```

---

## Task 5: OCR response normalizer (TDD)

**Files:**
- Create: `src/lib/ocr.ts`
- Create: `__tests__/ocr.test.ts`

- [ ] **Step 1: Write failing tests in `__tests__/ocr.test.ts`**

```typescript
import { parseAzureResponse, parseClaudeResponse } from '../src/lib/ocr'

const azureSuccess = {
  status: 'succeeded',
  analyzeResult: {
    documents: [{
      fields: {
        MerchantName: { valueString: 'The Burger Place' },
        Items: {
          valueArray: [
            {
              valueObject: {
                Description: { valueString: 'Classic Burger' },
                TotalPrice: { valueCurrency: { amount: 14.00 } },
              },
            },
            {
              valueObject: {
                Description: { valueString: 'Nachos' },
                TotalPrice: { valueCurrency: { amount: 12.00 } },
              },
            },
          ],
        },
        SubTotal: { valueCurrency: { amount: 26.00 } },
        TotalTax: { valueCurrency: { amount: 2.60 } },
        Tip: { valueCurrency: { amount: 5.20 } },
        Total: { valueCurrency: { amount: 33.80 } },
      },
    }],
  },
}

const azureNoTip = {
  status: 'succeeded',
  analyzeResult: {
    documents: [{
      fields: {
        Items: {
          valueArray: [
            { valueObject: { Description: { valueString: 'Burger' }, TotalPrice: { valueCurrency: { amount: 14 } } } },
          ],
        },
        SubTotal: { valueCurrency: { amount: 14 } },
        TotalTax: { valueCurrency: { amount: 1.4 } },
        Total: { valueCurrency: { amount: 15.4 } },
      },
    }],
  },
}

describe('parseAzureResponse', () => {
  it('extracts label, items, subtotal, tax, tip, and total', () => {
    const result = parseAzureResponse(azureSuccess)
    expect(result.label).toBe('The Burger Place')
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toEqual({ name: 'Classic Burger', price: 14 })
    expect(result.items[1]).toEqual({ name: 'Nachos', price: 12 })
    expect(result.subtotal).toBe(26)
    expect(result.tax).toBe(2.6)
    expect(result.tip).toBe(5.2)
    expect(result.total).toBe(33.8)
  })

  it('defaults tip to 0 when absent', () => {
    const result = parseAzureResponse(azureNoTip)
    expect(result.tip).toBe(0)
    expect(result.label).toBeUndefined()
  })

  it('returns null when documents array is empty', () => {
    const result = parseAzureResponse({ status: 'succeeded', analyzeResult: { documents: [] } })
    expect(result).toBeNull()
  })
})

describe('parseClaudeResponse', () => {
  it('parses JSON returned by Claude', () => {
    const claudeJson = JSON.stringify({
      label: 'Taco House',
      items: [{ name: 'Tacos', price: 12 }],
      subtotal: 12,
      tax: 1.2,
      tip: 0,
      total: 13.2,
    })
    const result = parseClaudeResponse(claudeJson)
    expect(result).not.toBeNull()
    expect(result!.label).toBe('Taco House')
    expect(result!.items[0].price).toBe(12)
  })

  it('returns null for unparseable Claude output', () => {
    expect(parseClaudeResponse('Sorry, I cannot read this image.')).toBeNull()
  })
})
```

- [ ] **Step 2: Run — verify failure**

```bash
npx jest __tests__/ocr.test.ts
```

Expected: FAIL — `Cannot find module '../src/lib/ocr'`

- [ ] **Step 3: Implement `src/lib/ocr.ts`**

```typescript
import type { ScanResult } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseAzureResponse(azureResult: any): ScanResult | null {
  const doc = azureResult?.analyzeResult?.documents?.[0]
  if (!doc) return null

  const fields = doc.fields ?? {}
  const itemsArray: Array<{ name: string; price: number }> = (
    fields.Items?.valueArray ?? []
  ).map((entry: any) => ({
    name: entry.valueObject?.Description?.valueString ?? 'Unknown item',
    price: entry.valueObject?.TotalPrice?.valueCurrency?.amount ?? 0,
  }))

  return {
    label: fields.MerchantName?.valueString,
    items: itemsArray,
    subtotal: fields.SubTotal?.valueCurrency?.amount ?? 0,
    tax: fields.TotalTax?.valueCurrency?.amount ?? 0,
    tip: fields.Tip?.valueCurrency?.amount ?? 0,
    total: fields.Total?.valueCurrency?.amount ?? 0,
  }
}

export function parseClaudeResponse(text: string): ScanResult | null {
  try {
    // Claude may wrap JSON in a code block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) 
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim()
    const parsed = JSON.parse(jsonStr)
    if (!Array.isArray(parsed.items)) return null
    return parsed as ScanResult
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npx jest __tests__/ocr.test.ts
```

Expected: PASS — 5 tests pass.

- [ ] **Step 5: Run all tests**

```bash
npx jest
```

Expected: PASS — all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ocr.ts __tests__/ocr.test.ts
git commit -m "feat: OCR response normalizer for Azure and Claude (TDD)"
```

---

## Task 6: IndexedDB storage

**Files:**
- Create: `src/lib/storage.ts`

- [ ] **Step 1: Write `src/lib/storage.ts`**

```typescript
import { openDB } from 'idb'
import type { Session } from './types'

const DB_NAME = 'checkplease'
const STORE = 'sessions'
const VERSION = 1

async function getDB() {
  return openDB(DB_NAME, VERSION, {
    upgrade(db) {
      db.createObjectStore(STORE, { keyPath: 'id' })
    },
  })
}

export async function saveSession(session: Session): Promise<void> {
  const db = await getDB()
  await db.put(STORE, session)
}

export async function listSessions(): Promise<Session[]> {
  const db = await getDB()
  const all = await db.getAll(STORE)
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getSession(id: string): Promise<Session | undefined> {
  const db = await getDB()
  return db.get(STORE, id)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/storage.ts
git commit -m "feat: IndexedDB session storage"
```

---

## Task 7: Image resize utility

**Files:**
- Create: `src/lib/imageUtils.ts`

- [ ] **Step 1: Write `src/lib/imageUtils.ts`**

```typescript
// Resizes an image file client-side and returns a base64 data URL.
// Caps the long edge at maxDimension to stay under Vercel's 4.5MB body limit.
export function resizeImage(file: File, maxDimension = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { width, height } = img
      const scale = Math.min(1, maxDimension / Math.max(width, height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = reject
    img.src = url
  })
}

// Strips the data:image/...;base64, prefix to get raw base64
export function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.split(',')[1]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/imageUtils.ts
git commit -m "feat: client-side image resize utility"
```

---

## Task 8: API route — /api/scan

**Files:**
- Create: `src/app/api/scan/route.ts`

- [ ] **Step 1: Add environment variable types to `src/env.d.ts`**

Create `src/env.d.ts`:

```typescript
declare namespace NodeJS {
  interface ProcessEnv {
    AZURE_DI_ENDPOINT: string
    AZURE_DI_KEY: string
    ANTHROPIC_API_KEY: string
  }
}
```

- [ ] **Step 2: Write `src/app/api/scan/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseAzureResponse, parseClaudeResponse } from '@/lib/ocr'
import type { ScanResult } from '@/lib/types'

const AZURE_API_VERSION = '2024-11-30'
const AZURE_MODEL = 'prebuilt-receipt'

async function analyzeWithAzure(base64Image: string): Promise<ScanResult | null> {
  const endpoint = process.env.AZURE_DI_ENDPOINT.replace(/\/$/, '')
  const key = process.env.AZURE_DI_KEY

  // Submit analysis job
  const submitRes = await fetch(
    `${endpoint}/documentintelligence/documentModels/${AZURE_MODEL}:analyze?api-version=${AZURE_API_VERSION}`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ base64Source: base64Image }),
    }
  )

  if (!submitRes.ok) return null
  const operationUrl = submitRes.headers.get('Operation-Location')
  if (!operationUrl) return null

  // Poll until succeeded (max 8 seconds)
  for (let i = 0; i < 16; i++) {
    await new Promise(r => setTimeout(r, 500))
    const pollRes = await fetch(operationUrl, {
      headers: { 'Ocp-Apim-Subscription-Key': key },
    })
    if (!pollRes.ok) return null
    const data = await pollRes.json()
    if (data.status === 'succeeded') return parseAzureResponse(data)
    if (data.status === 'failed') return null
  }
  return null
}

async function analyzeWithClaude(base64Image: string): Promise<ScanResult | null> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: base64Image },
        },
        {
          type: 'text',
          text: `Extract all line items from this receipt. Return ONLY a JSON object with this structure, no other text:
{
  "label": "restaurant name or null",
  "items": [{"name": "item description", "price": 0.00}],
  "subtotal": 0.00,
  "tax": 0.00,
  "tip": 0.00,
  "total": 0.00
}
Each item's price should be the full line total (quantity × unit price already multiplied).`,
        },
      ],
    }],
  })
  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return parseClaudeResponse(text)
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const base64Image = formData.get('image') as string | null
  if (!base64Image) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }

  // Try Azure, fall back to Claude
  let result = await analyzeWithAzure(base64Image)
  if (!result || result.items.length < 2) {
    result = await analyzeWithClaude(base64Image)
  }

  if (!result) {
    return NextResponse.json({ error: 'Could not read receipt' }, { status: 422 })
  }

  return NextResponse.json(result)
}
```

- [ ] **Step 3: Create `.env.local` with placeholder values**

Create `.env.local` in the project root:

```
AZURE_DI_ENDPOINT=https://YOUR_RESOURCE_NAME.cognitiveservices.azure.com
AZURE_DI_KEY=your_azure_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
```

Add `.env.local` to `.gitignore` (it should already be there from Next.js scaffold — verify).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/scan/route.ts src/env.d.ts
git commit -m "feat: OCR API route with Azure primary and Claude fallback"
```

---

## Task 9: Tailwind Dark Gold theme

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update `tailwind.config.ts`**

Replace the content with:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f0e0a',
        surface: '#1a1710',
        border: '#2d2820',
        'text-primary': '#f5f0e8',
        'text-secondary': '#8a7a5a',
        gold: '#c9a84c',
        'gold-dark': '#a07c2e',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 2: Update `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-bg text-text-primary;
    -webkit-tap-highlight-color: transparent;
  }
}
```

- [ ] **Step 3: Update `src/app/layout.tsx`**

```typescript
import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' })

export const metadata: Metadata = {
  title: 'CheckPlease',
  description: 'Split restaurant bills instantly',
  manifest: '/manifest.json',
  themeColor: '#0f0e0a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts src/app/globals.css src/app/layout.tsx
git commit -m "feat: Dark Gold Tailwind theme and root layout"
```

---

## Task 10: UI primitives

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Input.tsx`

- [ ] **Step 1: Write `src/components/ui/Button.tsx`**

```typescript
import { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'gold' | 'ghost'
  fullWidth?: boolean
}

export function Button({ variant = 'gold', fullWidth, className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded-xl px-5 py-3 font-semibold text-sm transition-opacity active:opacity-70 disabled:opacity-40',
        variant === 'gold' && 'bg-gradient-to-r from-gold to-gold-dark text-bg',
        variant === 'ghost' && 'border border-border text-text-primary bg-surface',
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 2: Create `src/lib/cn.ts`**

```typescript
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
```

- [ ] **Step 3: Write `src/components/ui/Card.tsx`**

```typescript
import { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-2xl border border-border bg-surface p-4', className)}
      {...props}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Write `src/components/ui/Input.tsx`**

```typescript
import { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-xl border border-border bg-surface px-4 py-3 text-text-primary placeholder:text-text-secondary outline-none focus:border-gold text-sm',
        className
      )}
      {...props}
    />
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ src/lib/cn.ts
git commit -m "feat: UI primitives — Button, Card, Input"
```

---

## Task 11: Home page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Write `src/app/page.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { listSessions } from '@/lib/storage'
import type { Session } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([])

  useEffect(() => {
    listSessions().then(setSessions)
  }, [])

  return (
    <main className="min-h-screen p-6 max-w-md mx-auto">
      <h1 className="font-display text-3xl text-gold mb-1">CheckPlease</h1>
      <p className="text-text-secondary text-sm mb-8">Split the bill, not the friendship.</p>

      <Link href="/new">
        <Button fullWidth className="mb-8">+ New Split</Button>
      </Link>

      {sessions.length > 0 && (
        <>
          <h2 className="text-text-secondary text-xs uppercase tracking-widest mb-3">Recent Splits</h2>
          <div className="flex flex-col gap-3">
            {sessions.map(session => (
              <Link key={session.id} href={`/history/${session.id}`}>
                <Card className="flex items-center justify-between hover:border-gold transition-colors cursor-pointer">
                  <div>
                    <p className="text-text-primary font-medium">{session.label ?? 'Unknown Restaurant'}</p>
                    <p className="text-text-secondary text-xs mt-0.5">
                      {new Date(session.createdAt).toLocaleDateString()} · {session.people.length} people
                    </p>
                  </div>
                  <span className="text-gold text-sm">${session.total.toFixed(2)}</span>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}

      {sessions.length === 0 && (
        <p className="text-center text-text-secondary text-sm mt-16">No splits yet — start one!</p>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Create history page at `src/app/history/[id]/page.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSession } from '@/lib/storage'
import { computeSplit } from '@/lib/splitting'
import type { Session } from '@/lib/types'
import { SummaryView } from '@/components/steps/SummaryView'

export default function HistoryPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    getSession(id).then(s => {
      if (!s) router.replace('/')
      else setSession(s)
    })
  }, [id, router])

  if (!session) return null

  const shares = computeSplit(session.people, session.items, session.tax, session.tip, session.total)
  return <SummaryView session={session} shares={shares} readOnly />
}
```

Note: `SummaryView` is created in Task 17. This file will compile only after that task.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx src/app/history/
git commit -m "feat: Home screen with session history"
```

---

## Task 12: New split page — step state machine

**Files:**
- Create: `src/app/new/page.tsx`

- [ ] **Step 1: Write `src/app/new/page.tsx`**

```typescript
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

  function handleReviewDone(items: Item[], tax: number, tip: number, total: number) {
    setDraft(d => ({ ...d, items, tax, tip, total }))
    setStep('assign')
  }

  function handleAssignDone(items: Item[]) {
    setDraft(d => ({ ...d, items }))
    setStep('summary')
  }

  async function handleSummaryDone() {
    const session = {
      id: sessionId,
      createdAt: new Date().toISOString(),
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
    createdAt: new Date().toISOString(),
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
```

- [ ] **Step 2: Install uuid**

```bash
npm install uuid
npm install --save-dev @types/uuid
```

- [ ] **Step 3: Commit**

```bash
git add src/app/new/ package.json package-lock.json
git commit -m "feat: new split page with step state machine"
```

---

## Task 13: AddPeople component

**Files:**
- Create: `src/components/steps/AddPeople.tsx`

- [ ] **Step 1: Write `src/components/steps/AddPeople.tsx`**

```typescript
'use client'

import { useState, KeyboardEvent } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Person } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

interface Props {
  onDone: (people: Person[]) => void
}

export function AddPeople({ onDone }: Props) {
  const [people, setPeople] = useState<Person[]>([])
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
        Scan Receipt →
      </Button>
      {people.length < 2 && (
        <p className="text-center text-text-secondary text-xs mt-2">Add at least 2 people</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/steps/AddPeople.tsx
git commit -m "feat: AddPeople step component"
```

---

## Task 14: Scan component

**Files:**
- Create: `src/components/steps/Scan.tsx`

- [ ] **Step 1: Write `src/components/steps/Scan.tsx`**

```typescript
'use client'

import { useRef, useState } from 'react'
import type { ScanResult } from '@/lib/types'
import { resizeImage, dataUrlToBase64 } from '@/lib/imageUtils'
import { Button } from '@/components/ui/Button'

interface Props {
  onDone: (result: ScanResult) => void
}

export function Scan({ onDone }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'scanning' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleFile(file: File) {
    setStatus('scanning')
    setErrorMsg('')
    try {
      const dataUrl = await resizeImage(file)
      const base64 = dataUrlToBase64(dataUrl)

      const form = new FormData()
      form.append('image', base64)

      const res = await fetch('/api/scan', { method: 'POST', body: form })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Scan failed')
      }
      const result: ScanResult = await res.json()
      onDone(result)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <div>
      <h2 className="font-display text-2xl text-gold mb-1">Scan Receipt</h2>
      <p className="text-text-secondary text-sm mb-6">Take a photo or upload from your gallery.</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />

      {status === 'idle' && (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-2xl border-2 border-dashed border-border bg-surface flex flex-col items-center justify-center py-16 gap-3 active:border-gold transition-colors"
        >
          <span className="text-4xl">📷</span>
          <span className="text-text-secondary text-sm">Tap to take photo</span>
          <span className="text-text-secondary text-xs">or choose from gallery</span>
        </button>
      )}

      {status === 'scanning' && (
        <div className="w-full rounded-2xl border border-border bg-surface flex flex-col items-center justify-center py-16 gap-3">
          <span className="text-4xl animate-pulse">🧾</span>
          <span className="text-text-secondary text-sm">Reading receipt…</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-red-900 bg-surface p-6 text-center">
            <p className="text-red-400 text-sm mb-1">Could not read receipt</p>
            <p className="text-text-secondary text-xs">{errorMsg}</p>
          </div>
          <Button fullWidth onClick={() => { setStatus('idle'); inputRef.current?.click() }}>
            Try Again
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/steps/Scan.tsx
git commit -m "feat: Scan step component with camera/upload and OCR call"
```

---

## Task 15: Review component

**Files:**
- Create: `src/components/steps/Review.tsx`

- [ ] **Step 1: Write `src/components/steps/Review.tsx`**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/steps/Review.tsx
git commit -m "feat: Review step — edit/add/remove extracted items"
```

---

## Task 16: Assign component

**Files:**
- Create: `src/components/steps/Assign.tsx`

- [ ] **Step 1: Write `src/components/steps/Assign.tsx`**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/steps/Assign.tsx
git commit -m "feat: Assign step — tap to assign items, shared item support"
```

---

## Task 17: Summary component and SummaryView

**Files:**
- Create: `src/components/steps/SummaryView.tsx`

- [ ] **Step 1: Write `src/components/steps/SummaryView.tsx`**

```typescript
'use client'

import type { Session } from '@/lib/types'
import type { PersonShare } from '@/lib/splitting'
import { buildShareUrl, buildPlainText } from '@/lib/share'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface Props {
  session: Session
  shares: PersonShare[]
  readOnly?: boolean
  onDone?: () => void
}

export function SummaryView({ session, shares, readOnly = false, onDone }: Props) {
  async function handleShareLink() {
    const url = buildShareUrl(session)
    if (navigator.share) {
      await navigator.share({ title: 'CheckPlease split', url })
    } else {
      await navigator.clipboard.writeText(url)
      alert('Link copied to clipboard!')
    }
  }

  async function handleCopyText() {
    const text = buildPlainText(session, shares)
    await navigator.clipboard.writeText(text)
    alert('Copied to clipboard!')
  }

  return (
    <div>
      <h2 className="font-display text-2xl text-gold mb-1">
        {session.label ?? 'Dinner'}
      </h2>
      <p className="text-text-secondary text-sm mb-6">
        {new Date(session.createdAt).toLocaleDateString()} · {session.people.length} people · ${session.total.toFixed(2)} total
      </p>

      <div className="flex flex-col gap-3 mb-8">
        {shares.map(share => (
          <Card key={share.personId}>
            <div className="flex justify-between items-start mb-2">
              <span className="text-text-primary font-semibold text-lg">{share.name}</span>
              <span className="text-gold font-bold text-xl">${share.total.toFixed(2)}</span>
            </div>
            <div className="text-text-secondary text-xs space-y-0.5">
              <p>{share.assignedItems.map(i => i.shared ? `${i.name} (shared)` : i.name).join(' · ')}</p>
              <p>
                Items ${share.itemSubtotal.toFixed(2)}
                {session.tax > 0 && ` · Tax $${share.taxShare.toFixed(2)}`}
                {session.tip > 0 && ` · Tip $${share.tipShare.toFixed(2)}`}
              </p>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex gap-3 mb-4">
        <Button fullWidth onClick={handleShareLink}>Share link</Button>
        <Button fullWidth variant="ghost" onClick={handleCopyText}>Copy text</Button>
      </div>

      {!readOnly && onDone && (
        <Button fullWidth variant="ghost" onClick={onDone}>
          Done — back to home
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/steps/SummaryView.tsx
git commit -m "feat: SummaryView with per-person breakdown and share actions"
```

---

## Task 18: Share page (read-only)

**Files:**
- Create: `src/app/share/page.tsx`

- [ ] **Step 1: Write `src/app/share/page.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { decodeSession } from '@/lib/share'
import { computeSplit } from '@/lib/splitting'
import type { Session } from '@/lib/types'
import { SummaryView } from '@/components/steps/SummaryView'

export default function SharePage() {
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) { setError(true); return }
    const decoded = decodeSession(hash)
    if (!decoded) { setError(true); return }
    setSession(decoded)
  }, [])

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p className="text-text-secondary text-center">Invalid or expired link.</p>
      </main>
    )
  }

  if (!session) return null

  const shares = computeSplit(session.people, session.items, session.tax, session.tip, session.total)

  return (
    <main className="min-h-screen p-6 max-w-md mx-auto">
      <SummaryView session={session} shares={shares} readOnly />
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/share/page.tsx
git commit -m "feat: shareable read-only split view"
```

---

## Task 19: PWA configuration

**Files:**
- Create: `public/manifest.json`
- Modify: `next.config.ts`

- [ ] **Step 1: Create `public/manifest.json`**

```json
{
  "name": "CheckPlease",
  "short_name": "CheckPlease",
  "description": "Split restaurant bills instantly",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f0e0a",
  "theme_color": "#0f0e0a",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 2: Add PWA headers to `next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}

export default nextConfig
```

- [ ] **Step 3: Add placeholder icons**

Create two 1×1 pixel placeholder PNG files so the manifest doesn't 404. Replace with real icons before launch:

```bash
# Using Node to create minimal valid PNGs
node -e "
const { createCanvas } = require('canvas');
" 
```

If `canvas` is not available, create the placeholder icons manually using any image editor — a 192×192 and 512×512 dark gold square saved as `public/icon-192.png` and `public/icon-512.png`.

- [ ] **Step 4: Commit**

```bash
git add public/manifest.json next.config.ts
git commit -m "feat: PWA manifest and security headers"
```

---

## Task 20: End-to-end smoke test and Vercel deploy prep

**Files:**
- Create: `.env.local` (already done in Task 8)

- [ ] **Step 1: Fill in real credentials in `.env.local`**

Replace placeholder values:
- `AZURE_DI_ENDPOINT`: your Azure Document Intelligence resource endpoint (from Azure portal → your resource → Keys and Endpoint)
- `AZURE_DI_KEY`: Key 1 from the same page
- `ANTHROPIC_API_KEY`: from console.anthropic.com → API Keys

- [ ] **Step 2: Run the full test suite**

```bash
npx jest
```

Expected: PASS — all tests pass (splitting, share, ocr).

- [ ] **Step 3: Start dev server and test the full flow manually**

```bash
npm run dev
```

Open http://localhost:3000 on your phone (find your machine's local IP, e.g. http://192.168.1.x:3000).

Walk through the full flow:
1. Tap "New Split", add 2+ people
2. Scan a real receipt (or use a receipt photo from your camera roll)
3. Verify items are extracted correctly on Review screen
4. Assign items, including at least one shared item
5. Verify the Summary totals are correct
6. Tap "Share link" — verify the URL works when opened in a new tab
7. Tap "Done" — verify session appears in Home history

- [ ] **Step 4: Build for production**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 5: Add Vercel environment variables**

In the Vercel dashboard (after deploying):
- Add `AZURE_DI_ENDPOINT`, `AZURE_DI_KEY`, `ANTHROPIC_API_KEY` as environment variables under Project Settings → Environment Variables.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: CheckPlease v1 complete"
```

---

## Environment Setup Reference

| Variable | Where to get it |
|---|---|
| `AZURE_DI_ENDPOINT` | Azure portal → Document Intelligence resource → Keys and Endpoint |
| `AZURE_DI_KEY` | Same page, "Key 1" |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |

Azure Document Intelligence free tier: 500 pages/month. No credit card required for the free tier resource.
