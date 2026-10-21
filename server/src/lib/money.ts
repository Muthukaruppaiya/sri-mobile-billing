export function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100
}

/** Shop prices are GST-inclusive. Split charged amount into taxable + tax. */
export function splitInclusive(amountIncl: number, taxPercent: number) {
  const incl = round2(Math.max(Number(amountIncl) || 0, 0))
  const rate = Math.max(Number(taxPercent) || 0, 0)
  if (rate <= 0 || incl <= 0) return { incl, taxable: incl, tax: 0 }
  const taxable = round2(incl / (1 + rate / 100))
  const tax = round2(incl - taxable)
  return { incl, taxable, tax }
}
