# CheckPlease — Design Spec
**Date:** 2026-04-22

## Overview

CheckPlease is a mobile-first PWA for splitting restaurant bills among friends. One person photographs the receipt; the app extracts every item and price via OCR, lets the phone owner assign items to people (including shared items), and calculates each person's exact total — subtotal, tax, and tip all proportionally allocated. The result is shareable as an encoded link or plain text via the native share sheet.

---

## Goals

- One photo → accurate per-person totals, every time
- Fast enough to use at the table before anyone gets up
- No accounts, no installs required for friends (they just open a link)
- Session history kept locally for accountability
- Architecture stays close to React Native so a Google Play app is a natural next step

## Non-Goals (v1)

- Venmo / payment integration (planned for v2)
- Cloud database / multi-device sync (deferred to when auth is added)
- Shareable live sessions (each person claiming on their own device)
- Android / iOS native app build

---

## App Flow — 6 Screens

1. **Home** — list of past splits (from IndexedDB) + "New Split" button
2. **Add People** — enter names of everyone at the table before scanning
3. **Scan** — camera capture or gallery upload of the receipt
4. **Review** — display extracted items and totals; user can edit, add, or delete items before assigning
5. **Assign** — for each item, tap one or more names to assign it; multi-person assigns split the item equally
6. **Summary + Share** — per-person totals with itemized breakdown; share via encoded link or copy plain text

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript |
| Styling | Tailwind CSS |
| Local storage | `idb` (IndexedDB wrapper) |
| URL compression | `lz-string` |
| OCR primary | Azure Document Intelligence — prebuilt receipt model |
| OCR fallback | Claude Vision (Anthropic SDK) |
| API proxy | Next.js API route `/api/scan` (keeps keys server-side) |
| Deployment | Vercel (free tier) |

---

## Visual Design

**Theme: Dark Gold**
- Background: near-black warm (`#0f0e0a`)
- Card surface: `#1a1710`, border `#2d2820`
- Primary text: `#f5f0e8`
- Secondary text: `#8a7a5a`
- Accent / money amounts: `#c9a84c` (gold)
- CTA button: gold gradient (`#c9a84c` → `#a07c2e`), dark text

---

## Data Model

```typescript
interface Session {
  id: string           // uuid
  createdAt: string    // ISO datetime
  label?: string       // restaurant name extracted from receipt
  people: Person[]
  items: Item[]
  subtotal: number     // sum of item prices as read from receipt
  tax: number          // as read from receipt
  tip: number          // as read from receipt; 0 if absent
  total: number        // as read from receipt
}

interface Person {
  id: string           // uuid
  name: string
}

interface Item {
  id: string           // uuid
  name: string
  price: number        // full line price (quantity × unit price, resolved by Azure)
  assignedTo: string[] // person ids; cost divides equally among all listed
}
```

Sessions are stored in IndexedDB under the key `checkplease_sessions` as an array, newest first.

---

## Splitting Algorithm

For each person:

```
personalSubtotal = Σ (item.price / item.assignedTo.length)
                    for each item where personId ∈ item.assignedTo

taxShare  = (personalSubtotal / receiptSubtotal) × receipt.tax
tipShare  = (personalSubtotal / receiptSubtotal) × receipt.tip
personTotal = personalSubtotal + taxShare + tipShare
```

**`receiptSubtotal` definition:** The denominator used in tax/tip proration is the **computed sum of all items** (`Σ item.price`) after user edits on the Review screen — not `Session.subtotal` from the receipt. This handles cases where the user added or deleted items that change the line-item total.

**Rounding guarantee:** All person totals are rounded to 2 decimal places. After rounding, if `Σ personTotal ≠ receipt.total` due to floating point, the difference (always ≤ $0.01) is added to the person with the largest share. This ensures the split always sums to exactly the receipt total.

---

## OCR Pipeline

**Endpoint:** `POST /api/scan`
- Accepts: `multipart/form-data` with an image field
- Calls Azure Document Intelligence prebuilt receipt model
- On success: returns structured `{ label, items, subtotal, tax, tip, total }`
- On failure (non-2xx, timeout, or fewer than 2 items extracted): retries once, then falls back to Claude Vision with a prompt requesting the same JSON structure
- Azure and Claude API keys stored as Vercel environment variables, never exposed to the client

**Azure output mapping:**
- `MerchantName` → `Session.label`
- `Items[].Description` → `Item.name`
- `Items[].TotalPrice` → `Item.price` (quantity already factored in)
- `TotalTax` → `Session.tax`
- `Tip` → `Session.tip`
- `Total` → `Session.total`
- `SubTotal` → `Session.subtotal`

**Review screen obligation:** The user always sees extracted items before assigning. They can edit any name or price, delete erroneous items, and add missing items manually. This screen is the accuracy gate — no item reaches the assign step unchecked.

---

## Shareable URL

At the end of a session, the full `Session` object is:
1. Serialized to JSON
2. Compressed with `lz-string` (LZ-based compression, URL-safe output)
3. Appended as the URL hash: `https://<domain>/split#<compressed>`

The `/split` page reads the hash, decompresses, and renders a read-only per-person breakdown. No backend call required — all data is in the URL.

**Plain text fallback** (generated alongside the link):
```
CheckPlease — [Restaurant] [Date]

Gordon: Burger · Nachos (½)
  Items $20.00 · Tax $1.80 · Tip $4.00
  YOU OWE: $25.80

Sarah: Salad · Nachos (½)
  Items $14.00 · Tax $1.26 · Tip $2.80
  YOU OWE: $18.06
```

Both are offered on the Summary screen. Tapping "Share link" triggers the Web Share API (falls back to clipboard copy on unsupported browsers). Tapping "Copy text" copies the plain text to clipboard.

---

## Session History

- Stored locally in IndexedDB — no server, no auth
- Home screen lists past sessions: restaurant name (or "Unknown"), date, number of people
- Each past session opens to a read-only Summary view
- No sync across devices in v1; this is intentionally deferred to when Venmo/auth is added

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Azure OCR fails | Retry once; fall back to Claude Vision |
| Claude Vision also fails | Show error; let user enter items manually on Review screen |
| Item price not detected | Item appears on Review screen flagged as "needs price" |
| Rounding mismatch | Silently adjusted on largest share; shown in breakdown tooltip |
| Item unassigned when leaving Assign screen | Block proceeding to Summary; highlight unassigned items in red |
| Web Share API unsupported | "Share link" button copies link to clipboard instead |

---

## Future Scope (not in v1)

- **Venmo integration** — direct payment links per person from the Summary screen
- **Cloud storage + auth** — multi-device history, session sharing before the split is done
- **Google Play app** — React Native rebuild of UI layer; business logic (math, data model) transfers as-is
- **Per-person tip override** — some people want to tip more; let them adjust their tip share manually
- **Currency support** — non-USD receipts
