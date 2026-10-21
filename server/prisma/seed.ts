import bcrypt from 'bcryptjs'
import { PrismaClient, ProductCategory, Role } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10)
  const empHash = await bcrypt.hash('emp123', 10)

  const admin = await prisma.employee.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      name: 'Shop Admin',
      phone: '9000000001',
      username: 'admin',
      passwordHash,
      role: Role.ADMIN,
    },
  })

  await prisma.employee.upsert({
    where: { username: 'counter1' },
    update: {},
    create: {
      name: 'Counter Staff 1',
      phone: '9000000002',
      username: 'counter1',
      passwordHash: empHash,
      role: Role.EMPLOYEE,
    },
  })

  await prisma.employee.upsert({
    where: { username: 'counter2' },
    update: {},
    create: {
      name: 'Counter Staff 2',
      phone: '9000000003',
      username: 'counter2',
      passwordHash: empHash,
      role: Role.EMPLOYEE,
    },
  })

  // Catalog only — no demo suppliers or purchases
  const products = [
    {
      sku: 'PH-XN13',
      name: 'Redmi Note 13',
      brand: 'Xiaomi',
      model: 'Note 13',
      category: ProductCategory.NEW_PHONE,
      sellPrice: 14999,
      mrp: 15999,
      reorderLevel: 3,
      location: 'Rack A1',
      ram: '8 GB',
      rom: '128 GB',
      color: 'Midnight Black',
      network: '4G / 5G',
      processor: 'Snapdragon 685',
    },
    {
      sku: 'PH-SA15',
      name: 'Samsung A15',
      brand: 'Samsung',
      model: 'A15',
      category: ProductCategory.NEW_PHONE,
      sellPrice: 16999,
      mrp: 17999,
      reorderLevel: 2,
      location: 'Rack A2',
      ram: '6 GB',
      rom: '128 GB',
      color: 'Blue Black',
      network: '4G / 5G',
    },
    {
      sku: 'UP-GEN',
      name: 'Used Phone (Generic)',
      brand: 'Various',
      model: 'Used',
      category: ProductCategory.USED_PHONE,
      sellPrice: 0,
      reorderLevel: 0,
      location: 'Used shelf',
    },
    {
      sku: 'SP-BN10',
      name: 'Battery — Note 10',
      brand: 'OEM',
      model: 'Note 10',
      category: ProductCategory.SPARE,
      sellPrice: 899,
      mrp: 999,
      reorderLevel: 4,
      location: 'Parts bin',
      spareType: 'BATTERY',
    },
    {
      sku: 'SP-DA14',
      name: 'Display — A14',
      brand: 'OEM',
      model: 'A14',
      category: ProductCategory.SPARE,
      sellPrice: 2499,
      mrp: 2799,
      reorderLevel: 2,
      location: 'Parts bin',
      spareType: 'DISPLAY',
      spareGrade: 'Incell',
    },
    {
      sku: 'AC-TG01',
      name: 'Tempered Glass D',
      brand: 'Generic',
      model: 'Universal',
      category: ProductCategory.ACCESSORY,
      sellPrice: 149,
      mrp: 199,
      reorderLevel: 20,
      location: 'Drawer B3',
      spareType: 'TEMPERED_GLASS',
      spareGrade: 'D',
    },
    {
      sku: 'AC-TG-DP',
      name: 'Tempered Glass D+',
      brand: 'Generic',
      model: 'Universal',
      category: ProductCategory.ACCESSORY,
      sellPrice: 199,
      mrp: 249,
      reorderLevel: 20,
      location: 'Drawer B3',
      spareType: 'TEMPERED_GLASS',
      spareGrade: 'D+',
    },
  ]

  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: p,
      create: p,
    })
  }

  console.log('Seeded login:', admin.username, '/ admin123')
  console.log('Staff: counter1, counter2 / emp123')
  console.log('Catalog SKUs only — no demo suppliers or purchases')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
