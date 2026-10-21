import { prisma } from '../prisma.js'

const CATALOG_URLS = [
  'https://cdn.jsdelivr.net/gh/bsthen/device-models/devices.json',
  'https://raw.githubusercontent.com/bsthen/device-models/main/devices.json',
]

const SHOP_BRANDS = new Set(
  [
    'samsung',
    'xiaomi',
    'redmi',
    'poco',
    'vivo',
    'iqoo',
    'oppo',
    'realme',
    'oneplus',
    'apple',
    'motorola',
    'nothing',
    'infinix',
    'tecno',
    'itel',
    'nokia',
    'honor',
    'google',
    'lava',
    'micromax',
    'asus',
    'sony',
    'huawei',
    'lenovo',
    'meizu',
    'nubia',
  ].map((s) => s.toLowerCase()),
)

const SKIP_DEVICE =
  /\b(tab|tablet|watch|pad|tv|book|laptop|chromebook|band|buds|earbud|headphone|pod|monitor|desktop|stick|projector|fridge|soundbar|speaker|router|camera)\b/i

const BRAND_LABEL: Record<string, string> = {
  samsung: 'Samsung',
  xiaomi: 'Xiaomi',
  redmi: 'Redmi',
  poco: 'POCO',
  vivo: 'Vivo',
  iqoo: 'iQOO',
  oppo: 'Oppo',
  realme: 'Realme',
  oneplus: 'OnePlus',
  apple: 'Apple',
  motorola: 'Motorola',
  nothing: 'Nothing',
  infinix: 'Infinix',
  tecno: 'Tecno',
  itel: 'Itel',
  nokia: 'Nokia',
  honor: 'Honor',
  google: 'Google',
  lava: 'Lava',
  micromax: 'Micromax',
  asus: 'Asus',
  sony: 'Sony',
  huawei: 'Huawei',
  lenovo: 'Lenovo',
  meizu: 'Meizu',
  nubia: 'Nubia',
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function shopBrand(apiBrand: string, name: string) {
  const n = name.toLowerCase()
  if (/\bredmi\b/.test(n)) return 'Redmi'
  if (/\bpoco\b/.test(n)) return 'POCO'
  if (/\biqoo\b/.test(n)) return 'iQOO'
  const key = apiBrand.trim().toLowerCase()
  return BRAND_LABEL[key] || apiBrand.trim()
}

function cleanModel(brand: string, name: string) {
  let m = name.trim()
  const stripped = new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i')
  m = m.replace(stripped, '').trim()
  return m || name.trim()
}

async function loadDevices() {
  let lastError = 'Could not download device list'
  for (const url of CATALOG_URLS) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) {
        lastError = `${url} → ${res.status}`
        continue
      }
      const data = (await res.json()) as Record<string, { brand?: string; name?: string }>
      return data
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
    }
  }
  throw new Error(lastError)
}

export async function syncPhoneCatalog() {
  const devices = await loadDevices()
  const grouped = new Map<string, Set<string>>()

  for (const row of Object.values(devices)) {
    const apiBrand = String(row.brand || '').trim()
    const name = String(row.name || '').trim()
    if (!apiBrand || !name) continue
    if (SKIP_DEVICE.test(name)) continue
    if (apiBrand.toLowerCase() === 'apple' && !/iphone/i.test(name)) continue

    const brand = shopBrand(apiBrand, name)
    if (!SHOP_BRANDS.has(brand.toLowerCase()) && !SHOP_BRANDS.has(apiBrand.toLowerCase())) continue

    const model = cleanModel(brand, name)
    if (model.length < 2 || model.length > 80) continue

    if (!grouped.has(brand)) grouped.set(brand, new Set())
    grouped.get(brand)!.add(model)
  }

  let brands = 0
  let models = 0

  for (const [brandName, modelSet] of grouped) {
    const brand = await prisma.catalogBrand.upsert({
      where: { slug: slugify(brandName) },
      update: { name: brandName, source: 'internet', active: true },
      create: { name: brandName, slug: slugify(brandName), source: 'internet' },
    })
    brands += 1
    const names = [...modelSet]
    await prisma.catalogModel.createMany({
      data: names.map((name) => ({ brandId: brand.id, name, source: 'internet' })),
      skipDuplicates: true,
    })
    models += names.length
  }

  return { brands, models }
}
