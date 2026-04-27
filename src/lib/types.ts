export type Step = 'people' | 'scan' | 'review' | 'assign' | 'summary'

export interface Person {
  id: string
  name: string
  color?: string
  venmoHandle?: string
}

export interface Item {
  id: string
  name: string
  price: number        // full line price (quantity already multiplied)
  assignedTo: string[] // person ids; cost splits equally among all listed
  confidence?: number  // 0–1 from Azure DI; absent when Claude parsed
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
  items: Array<{ name: string; price: number; confidence?: number }>
  subtotal: number
  tax: number
  tip: number
  total: number
}
