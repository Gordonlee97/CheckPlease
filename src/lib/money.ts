export const DEFAULT_CURRENCY = 'USD'

// Formatting is pinned to en-US so a split looks the same on every phone at
// the table; only the currency changes, not the number conventions.
const LOCALE = 'en-US'

const formatters = new Map<string, Intl.NumberFormat>()

function formatterFor(currency: string): Intl.NumberFormat {
  const cached = formatters.get(currency)
  if (cached) return cached
  let formatter: Intl.NumberFormat
  try {
    formatter = new Intl.NumberFormat(LOCALE, { style: 'currency', currency })
  } catch {
    // Unknown code (bad OCR, or a currency Intl doesn't know): show dollars
    formatter = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: DEFAULT_CURRENCY })
  }
  formatters.set(currency, formatter)
  return formatter
}

export function formatMoney(amount: number, currency?: string): string {
  return formatterFor(normalizeCurrency(currency) ?? DEFAULT_CURRENCY).format(amount)
}

// The symbol shown beside amount inputs, where the number is typed separately.
export function currencySymbol(currency?: string): string {
  const parts = formatterFor(normalizeCurrency(currency) ?? DEFAULT_CURRENCY).formatToParts(0)
  return parts.find(part => part.type === 'currency')?.value ?? '$'
}

// ISO 4217 codes are three letters; anything else came from a bad read.
export function normalizeCurrency(currency?: string | null): string | undefined {
  if (!currency) return undefined
  const code = currency.trim().toUpperCase()
  return /^[A-Z]{3}$/.test(code) ? code : undefined
}
