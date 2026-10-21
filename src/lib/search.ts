/** Normalize query for case-insensitive contains matching */
export function norm(s: string | null | undefined) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function digitsOnly(s: string | number | null | undefined) {
  return String(s || '').replace(/\D/g, '')
}

/** True if every token in query appears somewhere in haystack */
export function matchesQuery(query: string, ...parts: Array<string | number | null | undefined>) {
  const q = norm(query)
  if (!q) return true
  const hay = norm(parts.filter((p) => p != null && p !== '').join(' '))
  const textHit = q.split(' ').every((token) => hay.includes(token))
  const qDigits = digitsOnly(query)
  if (qDigits.length >= 3) {
    const hayDigits = digitsOnly(parts.filter((p) => p != null && p !== '').join(''))
    if (hayDigits.includes(qDigits)) return true
  }
  return textHit
}

export function productSearchBlob(p: {
  name?: string | null
  brand?: string | null
  model?: string | null
  sku?: string | null
  category?: string | null
  ram?: string | null
  rom?: string | null
  color?: string | null
  network?: string | null
  spareType?: string | null
  spareGrade?: string | null
  specNote?: string | null
}) {
  return [
    p.brand,
    p.name,
    p.model,
    p.sku,
    p.category,
    p.ram,
    p.rom,
    p.color,
    p.network,
    p.spareType,
    p.spareType === 'TEMPERED_GLASS' ? 'tempered glass' : p.spareType,
    p.spareGrade,
    p.specNote,
  ]
}

export function phoneSearchBlob(p: {
  imei?: string | null
  color?: string | null
  product?: {
    name?: string | null
    brand?: string | null
    model?: string | null
    sku?: string | null
    ram?: string | null
    rom?: string | null
    color?: string | null
    network?: string | null
  }
}) {
  return [
    p.imei,
    p.color,
    p.product?.brand,
    p.product?.name,
    p.product?.model,
    p.product?.sku,
    p.product?.ram,
    p.product?.rom,
    p.product?.color,
    p.product?.network,
  ]
}
