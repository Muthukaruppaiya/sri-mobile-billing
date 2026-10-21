import { ComboSelect } from './SearchableSelect'
import {
  DISPLAY_GRADES,
  GLASS_GRADES,
  NETWORK_OPTIONS,
  RAM_OPTIONS,
  ROM_OPTIONS,
  SPARE_TYPES,
  gradesForSpare,
  isPhoneCategory,
  isSpareCategory,
  type ProductCategory,
  type SpecDraft,
} from '../lib/productSpecs'

function strOpts(list: string[]) {
  return list.map((o) => ({ id: o, label: o }))
}

export function ProductSpecFields({
  category,
  value,
  onChange,
}: {
  category: ProductCategory
  value: SpecDraft
  onChange: (next: SpecDraft) => void
}) {
  const phone = isPhoneCategory(category)
  const spare = isSpareCategory(category)
  const grades = gradesForSpare(value.spareType)
  const showGrade =
    spare && (value.spareType === 'TEMPERED_GLASS' || value.spareType === 'DISPLAY' || grades.length > 0)

  function set<K extends keyof SpecDraft>(key: K, v: SpecDraft[K]) {
    onChange({ ...value, [key]: v })
  }

  return (
    <>
      {phone ? (
        <>
          <label>
            RAM
            <ComboSelect
              value={value.ram}
              allowCreate
              placeholder="Type RAM…"
              options={strOpts(RAM_OPTIONS)}
              onChange={(v) => set('ram', v)}
            />
          </label>
          <label>
            ROM / storage
            <ComboSelect
              value={value.rom}
              allowCreate
              placeholder="Type ROM…"
              options={strOpts(ROM_OPTIONS)}
              onChange={(v) => set('rom', v)}
            />
          </label>
          <label>
            Color
            <input
              value={value.color}
              onChange={(e) => set('color', e.target.value)}
              placeholder="Black / Blue…"
            />
          </label>
          <label>
            Network
            <ComboSelect
              value={value.network}
              allowCreate
              placeholder="Type network…"
              options={strOpts(NETWORK_OPTIONS)}
              onChange={(v) => set('network', v)}
            />
          </label>
          <label className="span-2">
            Processor
            <input
              value={value.processor}
              onChange={(e) => set('processor', e.target.value)}
              placeholder="Snapdragon / Dimensity…"
            />
          </label>
        </>
      ) : null}

      {spare ? (
        <>
          <label>
            Spare type
            <ComboSelect
              value={value.spareType}
              placeholder="Type spare type…"
              options={SPARE_TYPES.map((t) => ({ id: t.id, label: t.label }))}
              onChange={(v) => onChange({ ...value, spareType: v, spareGrade: '' })}
            />
          </label>
          {showGrade ? (
            <label>
              Grade / quality
              <ComboSelect
                value={value.spareGrade}
                allowCreate
                placeholder="Type grade…"
                options={strOpts(value.spareType === 'DISPLAY' ? DISPLAY_GRADES : GLASS_GRADES)}
                onChange={(v) => set('spareGrade', v)}
              />
            </label>
          ) : (
            <label>
              Variant
              <input
                value={value.spareGrade}
                onChange={(e) => set('spareGrade', e.target.value)}
                placeholder="Size / quality"
              />
            </label>
          )}
        </>
      ) : null}

      <label className="span-2">
        Extra spec note
        <input
          value={value.specNote}
          onChange={(e) => set('specNote', e.target.value)}
          placeholder={phone ? 'e.g. dual SIM, 50MP' : 'e.g. for Note 13, black'}
        />
      </label>
    </>
  )
}
