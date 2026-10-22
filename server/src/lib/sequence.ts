import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

const SETTINGS_ID = 'default'

/** Atomically reserve the next sale invoice number, e.g. INV-0001. */
export async function nextInvoiceNo(tx: Tx) {
  const s = await tx.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, invoiceSeq: 1 },
    update: { invoiceSeq: { increment: 1 } },
  })
  const prefix = (s.invoicePrefix || 'INV').trim() || 'INV'
  return `${prefix}-${String(s.invoiceSeq).padStart(4, '0')}`
}

/** Atomically reserve the next service ticket number, e.g. SV-0001. */
export async function nextTicketNo(tx: Tx) {
  const s = await tx.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, serviceSeq: 1 },
    update: { serviceSeq: { increment: 1 } },
  })
  return `SV-${String(s.serviceSeq).padStart(4, '0')}`
}
