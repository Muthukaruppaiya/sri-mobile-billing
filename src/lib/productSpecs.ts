export const RAM_OPTIONS = ['2 GB', '3 GB', '4 GB', '6 GB', '8 GB', '12 GB', '16 GB']
export const ROM_OPTIONS = ['32 GB', '64 GB', '128 GB', '256 GB', '512 GB', '1 TB']
export const NETWORK_OPTIONS = ['4G', '5G', '4G / 5G']

export const SPARE_TYPES = [
  { id: 'TEMPERED_GLASS', label: 'Tempered glass' },
  { id: 'DISPLAY', label: 'Display' },
  { id: 'BATTERY', label: 'Battery' },
  { id: 'BACK_PANEL', label: 'Back panel' },
  { id: 'CHARGING', label: 'Charging port' },
  { id: 'CAMERA', label: 'Camera' },
  { id: 'SPEAKER', label: 'Speaker' },
  { id: 'FLEX', label: 'Flex / connector' },
  { id: 'OTHER', label: 'Other spare' },
] as const

export const GLASS_GRADES = ['D', 'D+', 'OG', '9H', 'Matte', 'Privacy', 'Ceramic']
export const DISPLAY_GRADES = ['Incell', 'Soft OLED', 'Hard OLED', 'Original', 'Copy', 'AAA']

export type ProductCategory = 'NEW_PHONE' | 'USED_PHONE' | 'SPARE' | 'ACCESSORY'

export type SpecDraft = {
  ram: string
  rom: string
  color: string
  network: string
  processor: string
  spareType: string
  spareGrade: string
  specNote: string
}

export const emptySpecs = (): SpecDraft => ({
  ram: '',
  rom: '',
  color: '',
  network: '',
  processor: '',
  spareType: '',
  spareGrade: '',
  specNote: '',
})

export function specsFromProduct(p?: {
  ram?: string | null
  rom?: string | null
  color?: string | null
  network?: string | null
  processor?: string | null
  spareType?: string | null
  spareGrade?: string | null
  specNote?: string | null
} | null): SpecDraft {
  return {
    ram: p?.ram || '',
    rom: p?.rom || '',
    color: p?.color || '',
    network: p?.network || '',
    processor: p?.processor || '',
    spareType: p?.spareType || '',
    spareGrade: p?.spareGrade || '',
    specNote: p?.specNote || '',
  }
}

export function specPayload(s: SpecDraft) {
  const blank = (v: string) => v.trim() || undefined
  return {
    ram: blank(s.ram),
    rom: blank(s.rom),
    color: blank(s.color),
    network: blank(s.network),
    processor: blank(s.processor),
    spareType: blank(s.spareType),
    spareGrade: blank(s.spareGrade),
    specNote: blank(s.specNote),
  }
}

export function gradesForSpare(type: string) {
  if (type === 'TEMPERED_GLASS') return GLASS_GRADES
  if (type === 'DISPLAY') return DISPLAY_GRADES
  return []
}

export function spareTypeLabel(id?: string | null) {
  return SPARE_TYPES.find((t) => t.id === id)?.label || id || ''
}

export function specSummary(p: {
  ram?: string | null
  rom?: string | null
  color?: string | null
  network?: string | null
  processor?: string | null
  spareType?: string | null
  spareGrade?: string | null
}) {
  const bits: string[] = []
  if (p.ram || p.rom) bits.push([p.ram, p.rom].filter(Boolean).join(' / '))
  if (p.color) bits.push(p.color)
  if (p.network) bits.push(p.network)
  if (p.processor) bits.push(p.processor)
  if (p.spareType) {
    bits.push([spareTypeLabel(p.spareType), p.spareGrade].filter(Boolean).join(' · '))
  } else if (p.spareGrade) {
    bits.push(p.spareGrade)
  }
  return bits.filter(Boolean).join(' · ')
}

export function isPhoneCategory(c: ProductCategory) {
  return c === 'NEW_PHONE' || c === 'USED_PHONE'
}

export function isSpareCategory(c: ProductCategory) {
  return c === 'SPARE' || c === 'ACCESSORY'
}
