import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { RefreshCw, Landmark, Printer } from 'lucide-react'
import { openDoc } from '../lib/print'
import { api } from '../lib/api'
import type { PhoneUnit, Product, Sale } from '../lib/types'
import { formatINR } from '../lib/types'
import { Modal, SuccessBanner, TitleCount } from '../components/ui'
import { ComboSelect, PAYMENT_MODES, SearchableSelect } from '../components/SearchableSelect'
import { BrandModelFields } from '../components/BrandModelFields'
import {
  CustomerPhoneField,
  customerPayload,
  emptyCustomerDraft,
  type CustomerDraft,
} from '../components/CustomerPhoneField'
import { phoneSearchBlob } from '../lib/search'
import { NETWORK_OPTIONS, RAM_OPTIONS, ROM_OPTIONS, specSummary } from '../lib/productSpecs'
import { splitInclusive } from '../lib/money'

type SaleKind = 'NEW_MOBILE' | 'USED_PHONE'

const kindFromSlug: Record<string, SaleKind> = {
  new: 'NEW_MOBILE',
  used: 'USED_PHONE',
}

const title: Record<SaleKind, string> = {
  NEW_MOBILE: 'New mobile sale',
  USED_PHONE: 'Used phone sale',
}

const emptyExchange = {
  brand: '',
  model: '',
  imei: '',
  agreedValue: 0,
  color: '',
  conditionNote: '',
  ram: '',
  rom: '',
  network: '',
}

export function SalePage() {
  const { kind: kindSlug } = useParams()
  const resolved = kindFromSlug[kindSlug || '']
  const kind: SaleKind = resolved || 'NEW_MOBILE'
  const qc = useQueryClient()

  const [done, setDone] = useState<Sale | null>(null)
  const [error, setError] = useState('')
  const [customer, setCustomer] = useState<CustomerDraft>(emptyCustomerDraft)
  const [phoneUnitId, setPhoneUnitId] = useState('')
  const [unitPrice, setUnitPrice] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [taxPercent, setTaxPercent] = useState(18)
  const [inHand, setInHand] = useState(0)
  const [paymentMode, setPaymentMode] = useState('CASH')
  const [notes, setNotes] = useState('')

  const [useExchange, setUseExchange] = useState(false)
  const [useFinance, setUseFinance] = useState(false)
  const [exchangeOpen, setExchangeOpen] = useState(false)
  const [financeOpen, setFinanceOpen] = useState(false)
  const [exchange, setExchange] = useState(emptyExchange)
  const [exchangeDraft, setExchangeDraft] = useState(emptyExchange)
  const [financierName, setFinancierName] = useState('')
  const [financierDraft, setFinancierDraft] = useState('')
  const [approvalRef, setApprovalRef] = useState('')
  const [approvalDraft, setApprovalDraft] = useState('')

  useEffect(() => {
    setCustomer(emptyCustomerDraft())
    setPhoneUnitId('')
    setUnitPrice(0)
    setDiscount(0)
    setInHand(0)
    setError('')
    setDone(null)
    setUseExchange(false)
    setUseFinance(false)
    setExchange(emptyExchange)
    setFinancierName('')
    setApprovalRef('')
    setApprovalDraft('')
    setExchangeOpen(false)
    setFinanceOpen(false)
  }, [kind])

  const stockQ = useQuery({
    queryKey: ['stock'],
    queryFn: () => api<{ products: Product[]; phones: PhoneUnit[] }>('/stock'),
  })

  const phones = useMemo(() => {
    const list = stockQ.data?.phones || []
    return list.filter((p) =>
      kind === 'NEW_MOBILE'
        ? p.product.category === 'NEW_PHONE'
        : p.product.category === 'USED_PHONE',
    )
  }, [stockQ.data, kind])

  const phoneOptions = useMemo(
    () =>
      phones.map((p) => {
        const specs = specSummary(p.product)
        return {
          id: p.id,
          label: `${p.product.brand} ${p.product.name}`,
          hint: `IMEI ${p.imei}${p.color ? ` · ${p.color}` : ''}${specs ? ` · ${specs}` : ''}`,
          terms: phoneSearchBlob(p),
        }
      }),
    [phones],
  )

  const selected = phones.find((p) => p.id === phoneUnitId)

  const lineTotal = Math.round(Math.max(unitPrice - discount, 0))
  const gst = splitInclusive(lineTotal, taxPercent)
  const exchangeDownpay = useExchange ? Math.round(Math.max(Number(exchange.agreedValue) || 0, 0)) : 0
  const afterExchange = Math.max(lineTotal - exchangeDownpay, 0)
  const onCredit = paymentMode === 'CREDIT'
  // Cash cannot exceed what remains after exchange downpay
  const cashInHand = onCredit ? 0 : Math.min(Math.round(Math.max(Number(inHand) || 0, 0)), afterExchange)
  const remainingDue = Math.max(afterExchange - cashInHand, 0)
  // Finance log only: company remits this remaining amount to the shop
  const financedAmount = useFinance ? remainingDue : 0
  const credit = useFinance ? 0 : remainingDue
  const balance = credit

  const createSale = useMutation({
    mutationFn: () => {
      return api<Sale>('/sales', {
        method: 'POST',
        body: JSON.stringify({
          type: kind,
          ...customerPayload(customer),
          discount: 0,
          paidAmount: cashInHand,
          paymentMode,
          notes: notes || undefined,
          items: [
            {
              phoneUnitId,
              qty: 1,
              unitPrice,
              discount,
              taxPercent,
            },
          ],
          ...(useExchange
            ? {
                exchange: {
                  brand: exchange.brand.trim(),
                  model: exchange.model.trim(),
                  imei: exchange.imei.trim(),
                  agreedValue: exchangeDownpay,
                  color: exchange.color || undefined,
                  conditionNote: exchange.conditionNote || undefined,
                  ram: exchange.ram || undefined,
                  rom: exchange.rom || undefined,
                  network: exchange.network || undefined,
                },
              }
            : {}),
          ...(useFinance
            ? {
                finance: {
                  financierName: financierName.trim(),
                  advanceAmount: exchangeDownpay,
                  financedAmount,
                  approvalRef: approvalRef.trim() || undefined,
                },
              }
            : {}),
        }),
      })
    },
    onSuccess: (s) => {
      setDone(s)
      setPaymentMode('CASH')
      setCustomer(emptyCustomerDraft())
      setPhoneUnitId('')
      setUnitPrice(0)
      setDiscount(0)
      setInHand(0)
      setNotes('')
      setUseExchange(false)
      setUseFinance(false)
      setExchange(emptyExchange)
      setFinancierName('')
      setApprovalRef('')
      setApprovalDraft('')
      setError('')
      qc.invalidateQueries({ queryKey: ['stock'] })
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
      qc.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  function openExchange() {
    setExchangeDraft(useExchange ? { ...exchange } : { ...emptyExchange })
    setExchangeOpen(true)
  }

  function applyExchange() {
    if (!exchangeDraft.brand.trim() || !exchangeDraft.model.trim() || !exchangeDraft.imei.trim()) {
      setError('Fill exchange brand, model and IMEI')
      return
    }
    setError('')
    const agreed = Math.round(Number(exchangeDraft.agreedValue) || 0)
    setExchange({ ...exchangeDraft, agreedValue: agreed })
    setUseExchange(true)
    const nextAfter = Math.max(lineTotal - agreed, 0)
    setInHand((prev) => Math.min(prev, nextAfter))
    setExchangeOpen(false)
  }

  function clearExchange() {
    setUseExchange(false)
    setExchange(emptyExchange)
    setExchangeOpen(false)
  }

  function openFinance() {
    setFinancierDraft(financierName)
    setApprovalDraft(approvalRef)
    setFinanceOpen(true)
  }

  function applyFinance() {
    if (!financierDraft.trim()) {
      setError('Enter financier name')
      return
    }
    setError('')
    setFinancierName(financierDraft.trim())
    setApprovalRef(approvalDraft.trim())
    setUseFinance(true)
    setFinanceOpen(false)
  }

  function clearFinance() {
    setUseFinance(false)
    setFinancierName('')
    setApprovalRef('')
    setApprovalDraft('')
    setFinanceOpen(false)
  }

  function save() {
    setError('')
    if (!customer.phone.trim()) {
      setError('Enter customer phone')
      return
    }
    if (!customer.name.trim()) {
      setError('Enter customer name')
      return
    }
    if (!phoneUnitId) {
      setError('Select a phone from stock')
      return
    }
    if (useExchange && (!exchange.brand || !exchange.imei)) {
      setError('Complete exchange details')
      return
    }
    if (useExchange && exchangeDownpay > lineTotal) {
      setError('Exchange value is more than the phone price')
      return
    }
    if (unitPrice <= 0) {
      setError('Enter the sale price')
      return
    }
    if (useFinance && !financierName.trim()) {
      setError('Add financier in Finance popup')
      return
    }
    createSale.mutate()
  }

  if (!resolved) return <Navigate to="/app/billing/new" replace />

  return (
    <div className="purchase-desk">
      <header className="purchase-desk__top">
        <div className="purchase-desk__title-row">
          <div>
            <h1>{title[kind]}</h1>
            <p className="purchase-desk__sub">
              Exchange = downpay · in-hand = customer cash · finance is a log (company pays remaining to shop)
            </p>
          </div>
        </div>
        <AnimatePresence>
          {done ? (
            <SuccessBanner
              title={`Invoice ${done.invoiceNo || ''} saved`}
              detail={`${done.customer?.name || 'Customer'} · ${formatINR(done.grandTotal)} · ${
                done.hasFinance ? 'Finance' : done.paymentStatus === 'PAID' ? 'Paid' : `${formatINR(done.creditAmount)} due`
              }`}
              onClose={() => setDone(null)}
              actions={
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => openDoc('sale', done.id, { autoPrint: true })}
                >
                  <Printer size={14} /> Print invoice
                </button>
              }
            />
          ) : null}
        </AnimatePresence>
        {error ? <p className="purchase-desk__error">{error}</p> : null}
      </header>

      <div className="purchase-desk__grid purchase-desk__grid--solo">
        <section className="purchase-card">
          <div className="purchase-card__head">
            <h2>Customer</h2>
          </div>
          <CustomerPhoneField value={customer} onChange={setCustomer} />
          <div className="purchase-fields" style={{ marginTop: 10 }}>
            <label className="span-2">
              Notes
              <input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>
        </section>

        <section className="purchase-card purchase-card--pay">
          <div className="purchase-card__head">
            <h2>Payment</h2>
          </div>
          <div className="purchase-fields">
            <label>
              Mode
              <ComboSelect
                value={paymentMode}
                placeholder="Type mode…"
                options={[...PAYMENT_MODES]}
                onChange={(v) => setPaymentMode(v || 'CASH')}
              />
            </label>
            <label>
              In hand ₹
              <input
                type="number"
                min={0}
                max={afterExchange}
                disabled={onCredit}
                value={onCredit ? '' : inHand || ''}
                onChange={(e) => setInHand(Math.min(Number(e.target.value) || 0, afterExchange))}
                onFocus={() => {
                  if (!useFinance && !inHand) setInHand(afterExchange)
                }}
                placeholder="Cash given now"
              />
            </label>
            <label>
              Exchange downpay
              <input readOnly value={formatINR(exchangeDownpay)} />
            </label>
            <label>
              {useFinance ? 'Finance pays shop' : 'Credit due'}
              <input readOnly value={useFinance ? formatINR(financedAmount) : formatINR(credit)} />
            </label>
          </div>
          <div className="purchase-total-bar">
            <div>
              <span className="muted">Phone total</span>
              <strong>{formatINR(lineTotal)}</strong>
            </div>
            <div>
              <span className="muted">{useFinance ? 'Due from customer' : 'Balance'}</span>
              <strong className="purchase-grand">{formatINR(balance)}</strong>
            </div>
            <button
              type="button"
              className="btn btn--primary"
              disabled={createSale.isPending}
              onClick={save}
            >
              {createSale.isPending ? 'Saving…' : 'Save sale'}
            </button>
          </div>
        </section>

        <section className="purchase-card purchase-card--lines purchase-card--lines-wide">
          <div className="purchase-lines-head">
            <h2>
              Phone & options <TitleCount n={phoneUnitId ? 1 : 0} />
            </h2>
          </div>

          <div className="purchase-fields" style={{ marginBottom: 14 }}>
            <label className="span-2">
              Stock unit * (search brand / model / IMEI)
              <SearchableSelect
                options={phoneOptions}
                value={phoneUnitId}
                placeholder="Search brand, model, IMEI…"
                emptyLabel="No phones match"
                onChange={(id) => {
                  setPhoneUnitId(id)
                  const p = phones.find((x) => x.id === id)
                  if (p) {
                    const suggested = Number(p.suggestedSellPrice || p.product.sellPrice || 0)
                    setUnitPrice(Math.round(kind === 'USED_PHONE' ? suggested : Number(p.product.sellPrice || p.cost || 0)))
                    setTaxPercent(Number(p.product.taxPercent ?? (kind === 'USED_PHONE' ? 0 : 18)))
                  }
                }}
              />
            </label>
            <label>
              {kind === 'USED_PHONE' ? 'Sale ₹ (suggested)' : 'Sell ₹ (incl. tax)'}
              <input
                type="number"
                min={0}
                value={unitPrice || ''}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
              />
            </label>
            <label>
              Disc ₹
              <input
                type="number"
                min={0}
                value={discount || ''}
                onChange={(e) => setDiscount(Number(e.target.value))}
              />
            </label>
            <label>
              GST % (included)
              <input
                type="number"
                min={0}
                value={taxPercent || ''}
                onChange={(e) => setTaxPercent(Number(e.target.value))}
              />
            </label>
            {kind === 'USED_PHONE' ? (
              <p className="muted span-2" style={{ margin: 0, fontSize: 'var(--fs-xs)' }}>
                Suggested {selected ? formatINR(selected.suggestedSellPrice || selected.product.sellPrice || 0) : '—'}
                {selected && specSummary(selected.product) ? ` · Specs: ${specSummary(selected.product)}` : ''}
              </p>
            ) : (
              <>
                <label>
                  Cost (ref)
                  <input readOnly value={selected ? formatINR(selected.cost) : '—'} />
                </label>
                <p className="muted span-2" style={{ margin: 0, fontSize: 'var(--fs-xs)' }}>
                  Charged {formatINR(lineTotal)} includes GST {formatINR(gst.tax)}
                  {selected && specSummary(selected.product) ? ` · Specs: ${specSummary(selected.product)}` : ''}
                </p>
              </>
            )}
          </div>

          <div className="option-chip-row">
            <button type="button" className={`option-chip${useExchange ? ' is-on' : ''}`} onClick={openExchange}>
              <RefreshCw size={15} />
              Exchange
              {useExchange ? (
                <span className="option-chip__meta">{formatINR(exchangeDownpay)}</span>
              ) : (
                <span className="option-chip__meta">Add</span>
              )}
            </button>
            <button type="button" className={`option-chip${useFinance ? ' is-on' : ''}`} onClick={openFinance}>
              <Landmark size={15} />
              Finance log
              {useFinance ? (
                <span className="option-chip__meta">
                  {financierName} · {formatINR(financedAmount)}
                </span>
              ) : (
                <span className="option-chip__meta">Add</span>
              )}
            </button>
          </div>

          <div className="summary-pills">
            <span className="summary-pill">Total {formatINR(lineTotal)}</span>
            <span className="summary-pill">Downpay {formatINR(exchangeDownpay)}</span>
            <span className="summary-pill">In hand {formatINR(cashInHand)}</span>
            {useFinance ? (
              <span className="summary-pill">
                Finance log {financierName} · pays shop {formatINR(financedAmount)}
              </span>
            ) : (
              <span className="summary-pill">Due {formatINR(credit)}</span>
            )}
            <span className="summary-pill">
              Covered {formatINR(exchangeDownpay + cashInHand + financedAmount)}
            </span>
          </div>
        </section>
      </div>

      <Modal
        open={exchangeOpen}
        title="Exchange phone"
        subtitle="Agreed value becomes downpayment on the new mobile"
        onClose={() => setExchangeOpen(false)}
        footer={
          <>
            {useExchange ? (
              <button type="button" className="btn btn--ghost" onClick={clearExchange}>
                Remove exchange
              </button>
            ) : null}
            <button type="button" className="btn btn--ghost" onClick={() => setExchangeOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" onClick={applyExchange}>
              Apply exchange
            </button>
          </>
        }
      >
        <div className="purchase-fields">
          <BrandModelFields
            required
            brand={exchangeDraft.brand}
            model={exchangeDraft.model}
            onChange={({ brand, model }) => setExchangeDraft({ ...exchangeDraft, brand, model })}
          />
          <label>
            IMEI *
            <input
              value={exchangeDraft.imei}
              onChange={(e) => setExchangeDraft({ ...exchangeDraft, imei: e.target.value })}
            />
          </label>
          <label>
            Agreed value ₹ *
            <input
              type="number"
              min={0}
              value={exchangeDraft.agreedValue || ''}
              onChange={(e) =>
                setExchangeDraft({ ...exchangeDraft, agreedValue: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Color
            <input
              value={exchangeDraft.color}
              onChange={(e) => setExchangeDraft({ ...exchangeDraft, color: e.target.value })}
            />
          </label>
          <label>
            RAM
            <ComboSelect
              value={exchangeDraft.ram}
              allowCreate
              placeholder="Type RAM…"
              options={RAM_OPTIONS.map((o) => ({ id: o, label: o }))}
              onChange={(v) => setExchangeDraft({ ...exchangeDraft, ram: v })}
            />
          </label>
          <label>
            ROM
            <ComboSelect
              value={exchangeDraft.rom}
              allowCreate
              placeholder="Type ROM…"
              options={ROM_OPTIONS.map((o) => ({ id: o, label: o }))}
              onChange={(v) => setExchangeDraft({ ...exchangeDraft, rom: v })}
            />
          </label>
          <label>
            Network
            <ComboSelect
              value={exchangeDraft.network}
              allowCreate
              placeholder="Type network…"
              options={NETWORK_OPTIONS.map((o) => ({ id: o, label: o }))}
              onChange={(v) => setExchangeDraft({ ...exchangeDraft, network: v })}
            />
          </label>
          <label>
            Condition
            <input
              value={exchangeDraft.conditionNote}
              onChange={(e) =>
                setExchangeDraft({ ...exchangeDraft, conditionNote: e.target.value })
              }
            />
          </label>
        </div>
        <p className="muted" style={{ margin: '12px 0 0', fontSize: 'var(--fs-xs)' }}>
          After exchange:{' '}
          {formatINR(Math.max(lineTotal - Math.round(Number(exchangeDraft.agreedValue) || 0), 0))}
          {' '}· then subtract in-hand cash for final balance
        </p>
      </Modal>

      <Modal
        open={financeOpen}
        title="Finance log"
        subtitle="Shop record only — financier remits the remaining amount to us. No EMI here."
        onClose={() => setFinanceOpen(false)}
        footer={
          <>
            {useFinance ? (
              <button type="button" className="btn btn--ghost" onClick={clearFinance}>
                Remove log
              </button>
            ) : null}
            <button type="button" className="btn btn--ghost" onClick={() => setFinanceOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" onClick={applyFinance}>
              Save finance log
            </button>
          </>
        }
      >
        <div className="purchase-fields">
          <label className="span-2">
            Financier *
            <input
              value={financierDraft}
              onChange={(e) => setFinancierDraft(e.target.value)}
              placeholder="HDFC / Bajaj / …"
            />
          </label>
          <label>
            Approval / ref
            <input
              value={approvalDraft}
              onChange={(e) => setApprovalDraft(e.target.value)}
              placeholder="Optional"
            />
          </label>
          <label>
            Exchange downpay
            <input readOnly value={formatINR(exchangeDownpay)} />
          </label>
          <label>
            Customer in-hand
            <input readOnly value={formatINR(cashInHand)} />
          </label>
          <label>
            Amount finance pays shop
            <input
              readOnly
              value={formatINR(Math.max(lineTotal - exchangeDownpay - cashInHand, 0))}
            />
          </label>
        </div>
        <p className="muted" style={{ margin: '12px 0 0', fontSize: 'var(--fs-xs)' }}>
          This does not collect EMI. It only logs that the finance company will give this remaining
          amount to the shop. Customer due becomes ₹0.
        </p>
      </Modal>
    </div>
  )
}
