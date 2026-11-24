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

// Reads an amount the user typed. Many regions' decimal keypads offer "," and
// no "." — parseFloat would stop there and turn 12,50 into 12. When both marks
// appear, the last one is the decimal point and the other groups thousands.
// Anything that isn't fully a number is NaN, so it shows as missing rather
// than as whatever digits it happened to start with.
export function parseAmount(raw: string): number {
  let s = raw.trim().replace(/\s/g, '')
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  if (lastDot >= 0 && lastComma >= 0) {
    const thousands = lastComma > lastDot ? '.' : ','
    s = s.split(thousands).join('').replace(',', '.')
  } else if (lastComma >= 0) {
    if (s.indexOf(',') !== lastComma) return NaN
    s = s.replace(',', '.')
  }
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN
  return Number(s)
}

// How many minor units make one major unit: 100 for dollars and euros, 1 for
// yen and won. Taken from the same formatter that displays the amount, so a
// split is worked out in exactly the steps people will see.
export function minorUnitScale(currency?: string): number {
  const digits = formatterFor(normalizeCurrency(currency) ?? DEFAULT_CURRENCY).resolvedOptions().maximumFractionDigits ?? 2
  return 10 ** digits
}
