import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { SearchableSelect } from './SearchableSelect'

type BrandRow = { id: string; name: string; modelCount: number }
type ModelRow = { id: string; name: string; brand: string }

export function BrandModelFields({
  brand,
  model,
  onChange,
  required,
  compact = false,
}: {
  brand: string
  model: string
  onChange: (next: { brand: string; model: string }) => void
  required?: boolean
  compact?: boolean
}) {
  const qc = useQueryClient()
  const brandsQ = useQuery({
    queryKey: ['catalog', 'brands'],
    queryFn: () => api<BrandRow[]>('/catalog/brands'),
  })
  const modelsQ = useQuery({
    queryKey: ['catalog', 'models', brand],
    queryFn: () => api<ModelRow[]>(`/catalog/models?brand=${encodeURIComponent(brand)}`),
    enabled: Boolean(brand),
  })

  const brandOptions = (brandsQ.data || []).map((b) => ({
    id: b.name,
    label: b.name,
    hint: `${b.modelCount} models`,
    terms: [b.name],
  }))
  const modelOptions = (modelsQ.data || []).map((m) => ({
    id: m.name,
    label: m.name,
    terms: [m.name, brand],
  }))

  async function rememberBrand(name: string) {
    const exists = (brandsQ.data || []).some((b) => b.name.toLowerCase() === name.toLowerCase())
    if (exists) return
    try {
      await api('/catalog/brands', { method: 'POST', body: JSON.stringify({ name }) })
      qc.invalidateQueries({ queryKey: ['catalog', 'brands'] })
    } catch {
      /* keep local value even if catalog save fails */
    }
  }

  async function rememberModel(brandName: string, modelName: string) {
    if (!brandName || !modelName) return
    const exists = (modelsQ.data || []).some((m) => m.name.toLowerCase() === modelName.toLowerCase())
    if (exists) return
    try {
      await api('/catalog/models', {
        method: 'POST',
        body: JSON.stringify({ brand: brandName, name: modelName }),
      })
      qc.invalidateQueries({ queryKey: ['catalog', 'models', brandName] })
      qc.invalidateQueries({ queryKey: ['catalog', 'brands'] })
    } catch {
      /* keep local value */
    }
  }

  const brandSelect = (
    <SearchableSelect
      options={brandOptions}
      value={brand}
      allowCreate
      placeholder="Type brand…"
      emptyLabel="No brand match — type to add"
      onChange={(name) => {
        onChange({ brand: name, model: name === brand ? model : '' })
        if (name) void rememberBrand(name)
      }}
    />
  )
  const modelSelect = (
    <SearchableSelect
      options={modelOptions}
      value={model}
      allowCreate
      disabled={!brand}
      placeholder={brand ? 'Type model…' : 'Pick brand first'}
      emptyLabel="No model match — type to add"
      onChange={(name) => {
        onChange({ brand, model: name })
        if (name) void rememberModel(brand, name)
      }}
    />
  )

  if (compact) {
    return (
      <>
        {brandSelect}
        {modelSelect}
      </>
    )
  }

  return (
    <>
      <label>
        Brand{required ? ' *' : ''}
        {brandSelect}
      </label>
      <label>
        Model{required ? ' *' : ''}
        {modelSelect}
      </label>
    </>
  )
}
