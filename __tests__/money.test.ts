import { formatMoney, currencySymbol, normalizeCurrency, parseAmount, DEFAULT_CURRENCY } from '../src/lib/money'

describe('formatMoney', () => {
  it('formats dollars by default, matching what the app showed before', () => {
    expect(formatMoney(12)).toBe('$12.00')
    expect(formatMoney(12.5, 'USD')).toBe('$12.50')
  })

  it('formats other currencies', () => {
    expect(formatMoney(12.5, 'EUR')).toBe('€12.50')
    expect(formatMoney(1200, 'JPY')).toBe('¥1,200')
  })

  it('falls back to dollars for a missing or unusable code', () => {
    expect(formatMoney(5, undefined)).toBe('$5.00')
    expect(formatMoney(5, 'not-a-currency')).toBe('$5.00')
  })
})

describe('currencySymbol', () => {
  it('gives the symbol used to prefix inputs', () => {
    expect(currencySymbol('USD')).toBe('$')
    expect(currencySymbol('EUR')).toBe('€')
    expect(currencySymbol(undefined)).toBe('$')
  })
})

describe('normalizeCurrency', () => {
  it('upper-cases a valid code', () => {
    expect(normalizeCurrency('eur')).toBe('EUR')
  })

  it('rejects anything that is not a 3-letter code', () => {
    expect(normalizeCurrency('dollars')).toBeUndefined()
    expect(normalizeCurrency('')).toBeUndefined()
    expect(normalizeCurrency(null)).toBeUndefined()
  })

  it('defaults to USD', () => {
    expect(DEFAULT_CURRENCY).toBe('USD')
  })
})

// iOS shows a "," key instead of "." on the decimal keypad in many regions;
// parseFloat stopped at the comma and turned 12,50 into 12.
describe('parseAmount', () => {
  it('reads a dot or a comma as the decimal point', () => {
    expect(parseAmount('12.50')).toBe(12.5)
    expect(parseAmount('12,50')).toBe(12.5)
    expect(parseAmount(' 8,25 ')).toBe(8.25)
    expect(parseAmount('7')).toBe(7)
  })

  it('treats the other mark as a thousands separator when both appear', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56)
    expect(parseAmount('1.234,56')).toBe(1234.56)
  })

  it('rejects anything that is not a whole number, instead of reading its start', () => {
    expect(parseAmount('')).toBeNaN()
    expect(parseAmount('12abc')).toBeNaN()
    expect(parseAmount('1,2,3')).toBeNaN()
    expect(parseAmount('.')).toBeNaN()
  })
})
