import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

/** Indian mobile numbers: drop spaces/dashes and a leading +91 / 0 so lookups match. */
export function normalizePhone(raw: string | null | undefined) {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return ''
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  return digits || trimmed
}

export async function findCustomerByPhone(tx: Tx, phone: string) {
  const p = normalizePhone(phone)
  if (!p) return null
  return tx.customer.findFirst({
    where: { active: true, OR: [{ phone: p }, { altPhone: p }] },
  })
}

/**
 * Resolve the customer for a bill: an existing id, or find-by-phone / create from a draft.
 * Returns undefined when neither is given.
 */
export async function resolveCustomer(
  tx: Tx,
  input: {
    customerId?: string
    createCustomer?: { name: string; phone?: string; notes?: string }
  },
  opts: { renameExisting?: boolean } = {},
) {
  if (input.createCustomer) {
    const name = input.createCustomer.name.trim()
    const phone = normalizePhone(input.createCustomer.phone)
    const existing = phone ? await findCustomerByPhone(tx, phone) : null
    if (existing) {
      if (opts.renameExisting && name && name !== existing.name) {
        await tx.customer.update({ where: { id: existing.id }, data: { name } })
      }
      return existing.id
    }
    const created = await tx.customer.create({
      data: {
        name,
        phone: phone || undefined,
        notes: input.createCustomer.notes,
      },
    })
    return created.id
  }
  if (input.customerId) {
    const c = await tx.customer.findUnique({ where: { id: input.customerId } })
    if (!c) throw new Error('Customer not found')
    return c.id
  }
  return undefined
}
