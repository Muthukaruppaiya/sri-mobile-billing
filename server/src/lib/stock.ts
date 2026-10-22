import { PhoneStatus, type Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

/** Return `base`, or `base-2`, `base-3`… if the SKU is already used. */
export async function uniqueSku(tx: Tx, base: string) {
  const clean = base.trim() || 'SKU'
  let sku = clean
  for (let i = 2; i < 500; i++) {
    const hit = await tx.product.findUnique({ where: { sku }, select: { id: true } })
    if (!hit) return sku
    sku = `${clean}-${i}`
  }
  return `${clean}-${Date.now().toString(36).toUpperCase()}`
}

/**
 * Put an IMEI into stock. A phone we sold earlier (or transferred out) can come back
 * through exchange or used buy-in, so an existing non-stock unit is re-activated instead
 * of failing on the unique IMEI.
 */
export async function intakePhoneUnit(
  tx: Tx,
  data: {
    imei: string
    productId: string
    cost: number
    suggestedSellPrice?: number | null
    purchaseItemId?: string
    color?: string
    conditionNote?: string
  },
) {
  const imei = data.imei.trim()
  const existing = await tx.phoneUnit.findUnique({ where: { imei } })
  if (existing) {
    if (existing.status === PhoneStatus.IN_STOCK || existing.status === PhoneStatus.IN_SERVICE) {
      throw new Error(`IMEI ${imei} is already in stock`)
    }
    return tx.phoneUnit.update({
      where: { id: existing.id },
      data: {
        productId: data.productId,
        status: PhoneStatus.IN_STOCK,
        cost: data.cost,
        suggestedSellPrice: data.suggestedSellPrice ?? null,
        purchaseItemId: data.purchaseItemId ?? null,
        color: data.color ?? null,
        conditionNote: data.conditionNote ?? null,
        purchasedAt: new Date(),
      },
    })
  }
  return tx.phoneUnit.create({
    data: {
      imei,
      productId: data.productId,
      status: PhoneStatus.IN_STOCK,
      cost: data.cost,
      suggestedSellPrice: data.suggestedSellPrice ?? null,
      purchaseItemId: data.purchaseItemId,
      color: data.color,
      conditionNote: data.conditionNote,
    },
  })
}

/** Decrement product stock only if enough is on hand (safe against double-billing). */
export async function takeStock(tx: Tx, productId: string, qty: number, label: string) {
  const r = await tx.product.updateMany({
    where: { id: productId, stockQty: { gte: qty } },
    data: { stockQty: { decrement: qty } },
  })
  if (r.count === 0) throw new Error(`Insufficient stock for ${label}`)
}
