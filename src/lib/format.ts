/** yyyy-mm-dd in the device's local time zone (toISOString would shift to UTC). */
export function localDateInput(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function monthStartInput(d = new Date()) {
  return localDateInput(new Date(d.getFullYear(), d.getMonth(), 1))
}

/** Local start / end of a yyyy-mm-dd day as ISO strings for API ranges. */
export function dayRangeIso(fromInput: string, toInput: string) {
  const [fy, fm, fd] = fromInput.split('-').map(Number)
  const [ty, tm, td] = toInput.split('-').map(Number)
  return {
    from: new Date(fy, fm - 1, fd, 0, 0, 0, 0).toISOString(),
    to: new Date(ty, tm - 1, td, 23, 59, 59, 999).toISOString(),
  }
}

export function formatDate(v?: string | Date | null) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(v?: string | Date | null) {
  if (!v) return '—'
  return new Date(v).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Two-decimal rupee amount for printed documents (₹1,23,456.00). */
export function formatINR2(n: number | string | null | undefined) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n) || 0)
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function belowHundred(n: number) {
  if (n < 20) return ONES[n]
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`
}

function belowThousand(n: number) {
  const h = Math.floor(n / 100)
  const rest = n % 100
  return [h ? `${ONES[h]} Hundred` : '', rest ? belowHundred(rest) : ''].filter(Boolean).join(' ')
}

/** Indian numbering: 1,23,45,678 → "One Crore Twenty Three Lakh …" */
function integerWords(n: number): string {
  if (n === 0) return 'Zero'
  const parts: string[] = []
  const crore = Math.floor(n / 10_000_000)
  const lakh = Math.floor((n % 10_000_000) / 100_000)
  const thousand = Math.floor((n % 100_000) / 1000)
  const rest = n % 1000
  if (crore) parts.push(`${integerWords(crore)} Crore`)
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`)
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`)
  if (rest) parts.push(belowThousand(rest))
  return parts.join(' ')
}

export function amountInWords(amount: number | string) {
  const value = Math.abs(Number(amount) || 0)
  const rupees = Math.floor(value)
  const paise = Math.round((value - rupees) * 100)
  const words = `Rupees ${integerWords(rupees)}`
  return paise ? `${words} and ${belowHundred(paise)} Paise Only` : `${words} Only`
}

export const SERVICE_STATUS_LABEL: Record<string, string> = {
  BOOKED: 'Booked',
  RECEIVED: 'Received',
  IN_PROGRESS: 'In progress',
  AT_SUBCONTRACT: 'At subcontract',
  READY: 'Ready',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

export const SERVICE_TYPE_LABEL: Record<string, string> = {
  SELF_WITH_SPARES: 'With spare',
  SELF_LABOUR: 'Labour only',
  SUBCONTRACT: 'Subcontract',
}

export function serviceStatusTone(status: string) {
  if (status === 'READY') return 'chip--info'
  if (status === 'DELIVERED') return 'chip--live'
  if (status === 'CANCELLED') return 'chip--danger'
  if (status === 'AT_SUBCONTRACT') return 'chip--warn'
  return ''
}

export const PAYMENT_MODE_LABEL: Record<string, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  CARD: 'Card',
  BANK: 'Bank',
  CREDIT: 'Credit',
}
