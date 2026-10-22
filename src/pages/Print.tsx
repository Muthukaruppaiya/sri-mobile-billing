import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Printer, X } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useSettings, type AppSettings } from '../lib/settings'
import type { Purchase, Sale, ServiceJob } from '../lib/types'
import {
  amountInWords,
  formatDate,
  formatDateTime,
  formatINR2,
  PAYMENT_MODE_LABEL,
  SERVICE_STATUS_LABEL,
  SERVICE_TYPE_LABEL,
} from '../lib/format'
import { specSummary } from '../lib/productSpecs'
import type { DocKind } from '../lib/print'

type Paper = 'a4' | 'thermal'

const DOC_TITLE: Record<DocKind, string> = {
  sale: 'Sale invoice',
  jobcard: 'Service job card',
  'service-bill': 'Service bill',
  purchase: 'Purchase voucher',
}

const DEFAULT_INVOICE_TERMS =
  'Goods once sold will not be taken back or exchanged.\nWarranty is as per manufacturer terms; physical / liquid damage is not covered.\nSubject to local jurisdiction.'

const DEFAULT_SERVICE_TERMS =
  'Please bring this job card when collecting the device.\nWe are not responsible for data loss — take a backup before service.\nDevices not collected within 30 days of the ready date may be disposed of.\nWarranty on replaced parts only; no warranty on liquid / physically damaged devices.'

function money(n: number | string | null | undefined) {
  return formatINR2(n)
}

function n(v: number | string | null | undefined) {
  return Number(v || 0)
}

export function PrintPage() {
  const { kind, id } = useParams<{ kind: DocKind; id: string }>()
  const [params] = useSearchParams()
  const { user, loading } = useAuth()
  const { settings } = useSettings()
  const [paper, setPaper] = useState<Paper>(
    () => (localStorage.getItem('sri_paper') as Paper) || 'a4',
  )
  const [ready, setReady] = useState(false)

  useEffect(() => {
    localStorage.setItem('sri_paper', paper)
  }, [paper])

  useEffect(() => {
    if (!ready || params.get('print') !== '1') return
    const t = window.setTimeout(() => window.print(), 350)
    return () => window.clearTimeout(t)
  }, [ready, params])

  if (!loading && !user) return <Navigate to="/login" replace />
  if (!kind || !id || !(kind in DOC_TITLE)) return <Navigate to="/app" replace />

  const shop = settings
  const body =
    !shop || loading ? (
      <p className="muted">Loading…</p>
    ) : kind === 'sale' ? (
      <SaleDoc id={id} shop={shop} paper={paper} onReady={() => setReady(true)} />
    ) : kind === 'jobcard' ? (
      <JobCardDoc id={id} shop={shop} paper={paper} onReady={() => setReady(true)} />
    ) : kind === 'service-bill' ? (
      <ServiceBillDoc id={id} shop={shop} paper={paper} onReady={() => setReady(true)} />
    ) : (
      <PurchaseDoc id={id} shop={shop} paper={paper} onReady={() => setReady(true)} />
    )

  return (
    <div className="print-shell">
      <div className="print-toolbar">
        <span className="print-toolbar__title">{DOC_TITLE[kind]}</span>
        <div className="print-toolbar__actions">
          <div className="seg" style={{ width: 'auto' }}>
            {(
              [
                ['a4', 'A4'],
                ['thermal', '80mm receipt'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`seg__btn${paper === id ? ' is-active' : ''}`}
                onClick={() => setPaper(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--primary" onClick={() => window.print()}>
            <Printer size={15} /> Print / Save PDF
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => window.close()}>
            <X size={15} /> Close
          </button>
        </div>
      </div>
      {body}
    </div>
  )
}

function useDoc<T>(key: string, path: string, onReady: () => void) {
  const q = useQuery({ queryKey: ['print', key, path], queryFn: () => api<T>(path) })
  useEffect(() => {
    if (q.data) onReady()
  }, [q.data, onReady])
  return q
}

function DocFrame({ paper, children }: { paper: Paper; children: ReactNode }) {
  return <div className={`doc${paper === 'thermal' ? ' doc--thermal' : ''}`}>{children}</div>
}

function ShopHead({
  shop,
  title,
  lines,
}: {
  shop: AppSettings
  title: string
  lines: Array<ReactNode>
}) {
  const address = [shop.shopAddress, shop.shopCity].filter(Boolean).join(', ')
  return (
    <header className="doc__head">
      <div>
        <h1 className="doc__shop">{shop.shopName || 'SRI MOBILES'}</h1>
        <p className="doc__shop-meta">
          {address ? `${address}\n` : ''}
          {shop.shopPhone ? `Phone: ${shop.shopPhone}` : ''}
          {shop.shopGstin ? `${shop.shopPhone ? '  ·  ' : ''}GSTIN: ${shop.shopGstin}` : ''}
        </p>
      </div>
      <div className="doc__title">
        <h2>{title}</h2>
        {lines.filter(Boolean).map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>
    </header>
  )
}

function PartyBox({
  heading,
  name,
  rows,
}: {
  heading: string
  name?: string | null
  rows: Array<string | null | undefined | false>
}) {
  return (
    <div className="doc__box">
      <h3>{heading}</h3>
      <p>
        <strong>{name || 'Walk-in customer'}</strong>
      </p>
      {rows.filter(Boolean).map((r, i) => (
        <p key={i}>{r}</p>
      ))}
    </div>
  )
}

function Terms({ text, heading = 'Terms & conditions' }: { text?: string | null; heading?: string }) {
  if (!text?.trim()) return null
  return (
    <div className="doc__terms">
      <h3>{heading}</h3>
      {text}
    </div>
  )
}

function Signatures({ left, shopName }: { left: string; shopName: string }) {
  return (
    <div className="doc__sign">
      <div>{left}</div>
      <div>For {shopName} · Authorised signatory</div>
    </div>
  )
}

function Loading({ error }: { error?: Error | null }) {
  return <p className={error ? 'danger' : 'muted'}>{error ? error.message : 'Loading…'}</p>
}

/* ---------------- Sale invoice ---------------- */

function SaleDoc({
  id,
  shop,
  paper,
  onReady,
}: {
  id: string
  shop: AppSettings
  paper: Paper
  onReady: () => void
}) {
  const q = useDoc<Sale>('sale', `/sales/${id}`, onReady)
  const s = q.data
  if (!s) return <Loading error={q.error} />

  const items = s.items || []
  const exchangeTotal = (s.exchanges || []).reduce((sum, ex) => sum + n(ex.agreedValue), 0)
  const linesTotal = items.reduce((sum, it) => sum + n(it.lineTotal), 0)
  const otherDiscount = Math.max(n(s.discount) - exchangeTotal, 0)
  const tax = n(s.tax)
  const thermal = paper === 'thermal'
  const title = tax > 0 ? 'Tax invoice' : 'Invoice'
  const due = n(s.creditAmount)
  const financed = s.financePlan ? n(s.financePlan.financedAmount) : 0
  const payments = (s.payments || []).slice().reverse()

  return (
    <DocFrame paper={paper}>
      <ShopHead
        shop={shop}
        title={title}
        lines={[
          <>
            No: <strong>{s.invoiceNo || s.id.slice(-8).toUpperCase()}</strong>
          </>,
          `Date: ${formatDateTime(s.saleDate)}`,
          <span key="stamp" className={`doc__stamp ${due > 0 ? 'doc__stamp--due' : 'doc__stamp--paid'}`}>
            {s.hasFinance ? 'Finance' : due > 0 ? (n(s.paidAmount) > 0 ? 'Partly paid' : 'Credit') : 'Paid'}
          </span>,
        ]}
      />

      <div className="doc__parties">
        <PartyBox
          heading="Bill to"
          name={s.customer?.name}
          rows={[
            s.customer?.phone ? `Phone: ${s.customer.phone}` : null,
            [s.customer?.address, s.customer?.city].filter(Boolean).join(', ') || null,
            s.customer?.gstin ? `GSTIN: ${s.customer.gstin}` : null,
          ]}
        />
        {!thermal ? (
          <div className="doc__box">
            <h3>Details</h3>
            <p>Sale type: {s.type === 'USED_PHONE' ? 'Used phone' : 'New mobile'}</p>
            <p>Billed by: {s.createdBy?.name || '—'}</p>
            {s.notes ? <p>Note: {s.notes}</p> : null}
          </div>
        ) : null}
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: 24 }}>#</th>
            <th>Item</th>
            {!thermal ? <th className="num">Rate</th> : null}
            {!thermal ? <th className="num">Disc</th> : null}
            {!thermal ? <th className="num">GST</th> : null}
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => {
            const p = it.product || it.phoneUnit?.product
            const specs = p ? specSummary(p) : ''
            const lineTax = n(it.tax)
            const taxable = n(it.lineTotal) - lineTax
            const rate = taxable > 0 ? Math.round((lineTax / taxable) * 100) : 0
            return (
              <tr key={it.id}>
                <td>{i + 1}</td>
                <td>
                  <strong>{[p?.brand, p?.name].filter(Boolean).join(' ') || 'Item'}</strong>
                  {it.qty > 1 ? ` × ${it.qty}` : ''}
                  {specs ? <div>{specs}</div> : null}
                  {it.phoneUnit?.imei ? <div>IMEI: {it.phoneUnit.imei}</div> : null}
                </td>
                {!thermal ? <td className="num">{money(n(it.unitPrice) * it.qty)}</td> : null}
                {!thermal ? <td className="num">{n(it.discount) ? money(it.discount) : '—'}</td> : null}
                {!thermal ? <td className="num">{rate ? `${rate}%` : '—'}</td> : null}
                <td className="num">{money(it.lineTotal)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {s.exchanges?.length ? (
        <p className="doc__note">
          <strong>Exchange received: </strong>
          {s.exchanges
            .map(
              (ex) =>
                `${[ex.brand, ex.model].filter(Boolean).join(' ')}${ex.imei ? ` (IMEI ${ex.imei})` : ''} valued ${money(
                  ex.agreedValue,
                )}`,
            )
            .join('; ')}
        </p>
      ) : null}

      <div className="doc__totals">
        <div>
          <p className="doc__words">{amountInWords(s.grandTotal)}</p>
          {s.financePlan ? (
            <p className="doc__note">
              <strong>Finance: </strong>
              {s.financePlan.financierName} pays {money(financed)} to the shop
              {s.financePlan.approvalRef ? ` · Ref ${s.financePlan.approvalRef}` : ''}
            </p>
          ) : null}
          {payments.length ? (
            <p className="doc__note">
              <strong>Payments: </strong>
              {payments
                .map((p) => `${formatDate(p.paidAt)} ${PAYMENT_MODE_LABEL[p.mode] || p.mode} ${money(p.amount)}`)
                .join(' · ')}
            </p>
          ) : null}
        </div>
        <table>
          <tbody>
            <tr>
              <td>Items total</td>
              <td className="num">{money(linesTotal)}</td>
            </tr>
            {exchangeTotal > 0 ? (
              <tr>
                <td>Less exchange</td>
                <td className="num">− {money(exchangeTotal)}</td>
              </tr>
            ) : null}
            {otherDiscount > 0 ? (
              <tr>
                <td>Less discount</td>
                <td className="num">− {money(otherDiscount)}</td>
              </tr>
            ) : null}
            {tax > 0 ? (
              <>
                <tr>
                  <td>Taxable value</td>
                  <td className="num">{money(s.subtotal)}</td>
                </tr>
                <tr>
                  <td>CGST</td>
                  <td className="num">{money(tax / 2)}</td>
                </tr>
                <tr>
                  <td>SGST</td>
                  <td className="num">{money(tax / 2)}</td>
                </tr>
              </>
            ) : null}
            <tr className="is-grand">
              <td>Net amount</td>
              <td className="num">{money(s.grandTotal)}</td>
            </tr>
            <tr>
              <td>Paid</td>
              <td className="num">{money(s.paidAmount)}</td>
            </tr>
            {financed > 0 ? (
              <tr>
                <td>By finance</td>
                <td className="num">{money(financed)}</td>
              </tr>
            ) : null}
            {due > 0 ? (
              <tr>
                <td>
                  <strong>Balance due</strong>
                </td>
                <td className="num">
                  <strong>{money(due)}</strong>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Terms text={shop.invoiceTerms || DEFAULT_INVOICE_TERMS} />
      <Signatures left="Customer signature" shopName={shop.shopName} />
      <p className="doc__foot">Thank you for shopping with us!</p>
    </DocFrame>
  )
}

/* ---------------- Service job card (booking receipt) ---------------- */

function JobCardCopy({ job, shop, copy }: { job: ServiceJob; shop: AppSettings; copy: string }) {
  const advance = n(job.advanceAmount)
  return (
    <>
      <ShopHead
        shop={shop}
        title="Service job card"
        lines={[
          <>
            Ticket: <strong>{job.ticketNo}</strong>
          </>,
          `Booked: ${formatDateTime(job.createdAt)}`,
          copy,
        ]}
      />
      <div className="doc__parties">
        <PartyBox
          heading="Customer"
          name={job.customer?.name}
          rows={[job.customer?.phone ? `Phone: ${job.customer.phone}` : null]}
        />
        <div className="doc__box">
          <h3>Device</h3>
          <p>
            <strong>{[job.deviceBrand, job.deviceModel].filter(Boolean).join(' ') || '—'}</strong>
          </p>
          {job.imei ? <p>IMEI / Serial: {job.imei}</p> : null}
        </div>
      </div>
      <table>
        <tbody>
          <tr>
            <th style={{ width: '32%' }}>Problem reported</th>
            <td>{job.issue || '—'}</td>
          </tr>
          <tr>
            <th>Accessories received</th>
            <td>{job.accessories || 'Device only'}</td>
          </tr>
          <tr>
            <th>Condition at intake</th>
            <td>{job.conditionNote || '—'}</td>
          </tr>
          <tr>
            <th>Estimate</th>
            <td>{n(job.estimateAmount) ? money(job.estimateAmount) : 'To be informed'}</td>
          </tr>
          <tr>
            <th>Advance paid</th>
            <td>{advance ? money(advance) : 'Nil'}</td>
          </tr>
          <tr>
            <th>Expected ready</th>
            <td>{job.promisedDate ? formatDate(job.promisedDate) : 'Will inform'}</td>
          </tr>
          {job.notes ? (
            <tr>
              <th>Notes</th>
              <td>{job.notes}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  )
}

function JobCardDoc({
  id,
  shop,
  paper,
  onReady,
}: {
  id: string
  shop: AppSettings
  paper: Paper
  onReady: () => void
}) {
  const q = useDoc<ServiceJob>('service', `/services/${id}`, onReady)
  const job = q.data
  if (!job) return <Loading error={q.error} />
  return (
    <DocFrame paper={paper}>
      <JobCardCopy job={job} shop={shop} copy="Customer copy" />
      <Terms text={shop.serviceTerms || DEFAULT_SERVICE_TERMS} />
      <Signatures left="Customer signature" shopName={shop.shopName} />
      <hr className="doc__cut" />
      <JobCardCopy job={job} shop={shop} copy="Shop copy" />
      <Signatures left="Customer signature (device handed over)" shopName={shop.shopName} />
    </DocFrame>
  )
}

/* ---------------- Service bill (delivery invoice) ---------------- */

function ServiceBillDoc({
  id,
  shop,
  paper,
  onReady,
}: {
  id: string
  shop: AppSettings
  paper: Paper
  onReady: () => void
}) {
  const q = useDoc<ServiceJob>('service', `/services/${id}`, onReady)
  const job = q.data
  if (!job) return <Loading error={q.error} />

  const charge = n(job.customerCharge)
  const paid = n(job.paidAmount)
  const due = Math.max(charge - paid, 0)
  const spares = job.spares || []
  const serviceCharge = charge - n(job.spareCost)
  const payments = job.payments || []
  const delivered = job.status === 'DELIVERED'

  return (
    <DocFrame paper={paper}>
      <ShopHead
        shop={shop}
        title="Service bill"
        lines={[
          <>
            Ticket: <strong>{job.ticketNo}</strong>
          </>,
          `Date: ${formatDateTime(job.deliveredAt || job.readyAt || job.createdAt)}`,
          <span key="stamp" className={`doc__stamp ${due > 0 ? 'doc__stamp--due' : 'doc__stamp--paid'}`}>
            {job.status === 'CANCELLED' ? 'Cancelled' : due > 0 ? 'Balance due' : 'Paid'}
          </span>,
        ]}
      />
      <div className="doc__parties">
        <PartyBox
          heading="Customer"
          name={job.customer?.name}
          rows={[job.customer?.phone ? `Phone: ${job.customer.phone}` : null]}
        />
        <div className="doc__box">
          <h3>Device</h3>
          <p>
            <strong>{[job.deviceBrand, job.deviceModel].filter(Boolean).join(' ') || '—'}</strong>
          </p>
          {job.imei ? <p>IMEI / Serial: {job.imei}</p> : null}
          <p>
            {SERVICE_TYPE_LABEL[job.type] || job.type} · {SERVICE_STATUS_LABEL[job.status] || job.status}
          </p>
        </div>
      </div>

      {job.issue ? (
        <p className="doc__note">
          <strong>Problem: </strong>
          {job.issue}
        </p>
      ) : null}

      <table>
        <thead>
          <tr>
            <th style={{ width: 24 }}>#</th>
            <th>Description</th>
            <th className="num">Qty</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {spares.map((s, i) => (
            <tr key={s.id}>
              <td>{i + 1}</td>
              <td>
                {[s.product.brand, s.product.name].filter(Boolean).join(' ')}
                {specSummary(s.product) ? <div>{specSummary(s.product)}</div> : null}
              </td>
              <td className="num">{s.qty}</td>
              <td className="num">{money(s.lineTotal)}</td>
            </tr>
          ))}
          {serviceCharge > 0 ? (
            <tr>
              <td>{spares.length + 1}</td>
              <td>Service / labour charges</td>
              <td className="num">1</td>
              <td className="num">{money(serviceCharge)}</td>
            </tr>
          ) : null}
          {!spares.length && serviceCharge <= 0 ? (
            <tr>
              <td colSpan={4}>No charges recorded</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="doc__totals">
        <div>
          <p className="doc__words">{amountInWords(charge)}</p>
          {payments.length ? (
            <p className="doc__note">
              <strong>Payments: </strong>
              {payments
                .map(
                  (p) =>
                    `${formatDate(p.paidAt)} ${PAYMENT_MODE_LABEL[p.mode] || p.mode} ${money(p.amount)}${
                      p.note ? ` (${p.note})` : ''
                    }`,
                )
                .join(' · ')}
            </p>
          ) : null}
        </div>
        <table>
          <tbody>
            <tr className="is-grand">
              <td>Total</td>
              <td className="num">{money(charge)}</td>
            </tr>
            <tr>
              <td>Paid</td>
              <td className="num">{money(paid)}</td>
            </tr>
            <tr>
              <td>
                <strong>{due > 0 ? 'Balance due' : 'Balance'}</strong>
              </td>
              <td className="num">
                <strong>{money(due)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Terms text={shop.serviceTerms || DEFAULT_SERVICE_TERMS} />
      <Signatures
        left={delivered ? 'Received device in good condition' : 'Customer signature'}
        shopName={shop.shopName}
      />
      <p className="doc__foot">Thank you!</p>
    </DocFrame>
  )
}

/* ---------------- Purchase voucher ---------------- */

function PurchaseDoc({
  id,
  shop,
  paper,
  onReady,
}: {
  id: string
  shop: AppSettings
  paper: Paper
  onReady: () => void
}) {
  const q = useDoc<Purchase>('purchase', `/purchases/${id}`, onReady)
  const p = q.data
  if (!p) return <Loading error={q.error} />

  const fromCustomer = Boolean(p.customer)
  const party = p.customer || p.supplier
  const due = n(p.creditAmount)
  const voucherNo = `PV-${p.id.slice(-6).toUpperCase()}`
  const title = fromCustomer ? 'Purchase voucher' : 'Goods received note'

  return (
    <DocFrame paper={paper}>
      <ShopHead
        shop={shop}
        title={title}
        lines={[
          <>
            No: <strong>{voucherNo}</strong>
          </>,
          `Date: ${formatDateTime(p.purchaseDate)}`,
          p.invoiceNo ? `Ref / bill: ${p.invoiceNo}` : '',
        ]}
      />
      <div className="doc__parties">
        <PartyBox
          heading={fromCustomer ? 'Seller (customer)' : 'Supplier'}
          name={party?.name}
          rows={[
            party?.phone ? `Phone: ${party.phone}` : null,
            party?.address || null,
            party?.gstin ? `GSTIN: ${party.gstin}` : null,
          ]}
        />
        <div className="doc__box">
          <h3>Details</h3>
          <p>
            Type:{' '}
            {p.type === 'USED_PHONE' ? 'Used phone' : p.type === 'SPARES' ? 'Spares / accessories' : 'New mobile'}
          </p>
          <p>Entered by: {p.createdBy?.name || '—'}</p>
          {p.notes ? <p>Note: {p.notes}</p> : null}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: 24 }}>#</th>
            <th>Item</th>
            <th className="num">Qty</th>
            <th className="num">Rate</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {(p.items || []).map((it, i) => {
            const imeis = (it.phoneUnits || []).map((u) => u.imei).filter(Boolean)
            return (
              <tr key={it.id}>
                <td>{i + 1}</td>
                <td>
                  <strong>{[it.product.brand, it.product.name].filter(Boolean).join(' ')}</strong>
                  {specSummary(it.product) ? <div>{specSummary(it.product)}</div> : null}
                  {imeis.length ? <div>IMEI: {imeis.join(', ')}</div> : null}
                </td>
                <td className="num">{it.qty}</td>
                <td className="num">{money(it.unitCost)}</td>
                <td className="num">{money(it.lineTotal)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="doc__totals">
        <div>
          <p className="doc__words">{amountInWords(p.grandTotal)}</p>
        </div>
        <table>
          <tbody>
            {n(p.discount) > 0 ? (
              <tr>
                <td>Discount</td>
                <td className="num">− {money(p.discount)}</td>
              </tr>
            ) : null}
            {n(p.tax) > 0 ? (
              <tr>
                <td>GST included</td>
                <td className="num">{money(p.tax)}</td>
              </tr>
            ) : null}
            <tr className="is-grand">
              <td>Total</td>
              <td className="num">{money(p.grandTotal)}</td>
            </tr>
            <tr>
              <td>{fromCustomer ? 'Paid to seller' : 'Paid'}</td>
              <td className="num">{money(p.paidAmount)}</td>
            </tr>
            {due > 0 ? (
              <tr>
                <td>
                  <strong>Balance payable</strong>
                </td>
                <td className="num">
                  <strong>{money(due)}</strong>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {fromCustomer ? (
        <div className="doc__terms">
          <h3>Seller declaration</h3>
          I, {party?.name || '__________'}, declare that the device(s) listed above are my own lawful
          property, are not stolen, lost, or under any finance / EMI dues, and I have handed them over to{' '}
          {shop.shopName} of my own free will for the amount stated above. I have removed my accounts
          and personal data. I will be responsible for any legal issue arising about the ownership of
          these device(s).
          {'\n\n'}ID proof: ____________________ No: ____________________
        </div>
      ) : null}

      <Signatures left={fromCustomer ? 'Seller signature' : 'Received by'} shopName={shop.shopName} />
    </DocFrame>
  )
}
