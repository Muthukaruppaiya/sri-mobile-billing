/**
 * Clears demo purchases / suppliers / phone stock. Keeps login users + catalog SKUs.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.phoneEvent.deleteMany()
  await prisma.payment.deleteMany({ where: { refType: 'PURCHASE' } })
  await prisma.phoneUnit.deleteMany()
  await prisma.purchaseItem.deleteMany()
  await prisma.purchase.deleteMany()
  await prisma.supplier.deleteMany()
  await prisma.product.updateMany({ data: { stockQty: 0 } })

  console.log('Cleared demo purchases, suppliers, and phone units. Catalog SKUs kept at qty 0.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
