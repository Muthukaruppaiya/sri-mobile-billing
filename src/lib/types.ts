export type Supplier = {
  id: string
  name: string
  phone?: string | null
  gstin?: string | null
  address?: string | null
  creditBalance: string | number
}

export type Customer = {
  id: string
  name: string
  phone?: string | null
  altPhone?: string | null
  address?: string | null
  city?: string | null
  gstin?: string | null
  /** Customer owes the shop */
  creditBalance: string | number
  /** Shop owes the customer (used phone buy-in) */
  payableBalance?: string | number
  notes?: string | null
  active?: boolean
  createdAt?: string
  updatedAt?: string
}

export type Product = {
  id: string
  sku: string
  name: string
  brand: string
  model?: string | null
  category: 'NEW_PHONE' | 'USED_PHONE' | 'SPARE' | 'ACCESSORY'
  taxPercent: string | number
  mrp?: string | number | null
  sellPrice?: string | number | null
  stockQty: number
  reorderLevel: number
  location?: string | null
  ram?: string | null
  rom?: string | null
  color?: string | null
  network?: string | null
  processor?: string | null
  spareType?: string | null
  spareGrade?: string | null
  specNote?: string | null
}

export type PurchaseType = 'NEW_MOBILE' | 'SPARES' | 'USED_PHONE'

export type PhoneUnit = {
  id: string
  imei: string
  cost: string | number
  suggestedSellPrice?: string | number | null
  status: string
  color?: string | null
  purchasedAt: string
  product: Product
}

export type PurchasePayment = {
  id: string
  amount: string | number
  mode: string
  paidAt: string
  note?: string | null
}

export type Purchase = {
  id: string
  type: PurchaseType
  supplierId?: string | null
  customerId?: string | null
  invoiceNo?: string | null
  purchaseDate: string
  subtotal: string | number
  discount: string | number
  tax: string | number
  grandTotal: string | number
  paidAmount: string | number
  creditAmount: string | number
  paymentStatus: string
  notes?: string | null
  supplier?: Supplier | null
  customer?: Customer | null
  createdBy?: { id: string; name: string }
  items?: Array<{
    id: string
    qty: number
    unitCost: string | number
    lineTotal: string | number
    product: Product
    phoneUnits?: Array<PhoneUnit | { imei: string }>
  }>
  payments?: PurchasePayment[]
}

export type Sale = {
  id: string
  type: 'NEW_MOBILE' | 'USED_PHONE'
  invoiceNo?: string | null
  saleDate: string
  subtotal: string | number
  discount: string | number
  tax: string | number
  grandTotal: string | number
  paidAmount: string | number
  creditAmount: string | number
  paymentStatus: string
  hasExchange: boolean
  hasFinance: boolean
  notes?: string | null
  customer?: Customer | null
  createdBy?: { id: string; name: string }
  items?: Array<{
    id: string
    qty: number
    unitPrice: string | number
    discount?: string | number
    tax?: string | number
    lineTotal: string | number
    product?: Product | null
    phoneUnit?: PhoneUnit | null
  }>
  exchanges?: Array<{
    id: string
    brand?: string | null
    model?: string | null
    imei?: string | null
    agreedValue: string | number
    conditionNote?: string | null
  }>
  financePlan?: {
    id: string
    financierName: string
    advanceAmount: string | number
    financedAmount: string | number
    approvalRef?: string | null
    notes?: string | null
  } | null
  payments?: PurchasePayment[]
}

export type ServiceStatus =
  | 'BOOKED'
  | 'RECEIVED'
  | 'IN_PROGRESS'
  | 'AT_SUBCONTRACT'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELLED'

export type ServiceJob = {
  id: string
  ticketNo: string
  type: 'SELF_WITH_SPARES' | 'SELF_LABOUR' | 'SUBCONTRACT'
  status: ServiceStatus
  deviceBrand?: string | null
  deviceModel?: string | null
  imei?: string | null
  issue?: string | null
  accessories?: string | null
  conditionNote?: string | null
  notes?: string | null
  labourCharge: number | string
  spareCost: number | string
  subcontractCost: number | string
  customerCharge: number | string
  estimateAmount?: number | string
  advanceAmount: number | string
  paidAmount: number | string
  margin: number | string
  timeMinutes?: number | null
  subcontractorName?: string | null
  promisedDate?: string | null
  readyAt?: string | null
  deliveredAt?: string | null
  cancelledAt?: string | null
  cancelReason?: string | null
  createdAt: string
  customer?: Customer | null
  createdBy?: { id: string; name: string }
  spares?: Array<{
    id: string
    qty: number
    unitCost: number | string
    lineTotal: number | string
    product: Product
  }>
  payments?: PurchasePayment[]
}

export function partyName(p: Pick<Purchase, 'supplier' | 'customer'>) {
  return p.supplier?.name || p.customer?.name || '—'
}

export const formatINR = (n: number | string) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0)
