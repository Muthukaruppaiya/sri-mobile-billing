export type Product = {
  id: string
  name: string
  brand: string
  category: 'Phone' | 'Accessory' | 'Spare'
  sku: string
  price: number
  mrp: number
  stock: number
  lowAt: number
  location: string
  lastIn: string
}

export type Customer = {
  id: string
  name: string
  phone: string
  city: string
  visits: number
  lastVisit: string
}

export type BillRow = {
  id: string
  no: string
  type: 'Sale' | 'Service'
  customer: string
  phone: string
  amount: number
  paid: number
  time: string
  date: string
  payment: string
  status: 'Paid' | 'Pending' | 'Part'
}

export type ServiceJob = {
  id: string
  ticket: string
  customer: string
  phone: string
  device: string
  brand: string
  imei: string
  issue: string
  status: 'Received' | 'In progress' | 'Waiting parts' | 'Ready' | 'Delivered'
  eta: string
  deliveryDue: 'Today' | 'Tomorrow' | 'Later'
  estimate: number
  advance: number
  billStatus: 'Not billed' | 'Advance only' | 'Final pending' | 'Billed'
}

export const staffNames = ['Counter 1', 'Counter 2', 'Owner']

export const paymentModes = ['Cash', 'UPI', 'Card', 'Bank transfer', 'Part payment']

export const customers: Customer[] = [
  { id: 'c1', name: 'Arun Kumar', phone: '98765 43210', city: 'Coimbatore', visits: 8, lastVisit: 'Today' },
  { id: 'c2', name: 'Priya M', phone: '98430 11223', city: 'Tiruppur', visits: 3, lastVisit: 'Yesterday' },
  { id: 'c3', name: 'Karthik S', phone: '90030 55667', city: 'Coimbatore', visits: 5, lastVisit: '2 days ago' },
  { id: 'c4', name: 'Nisha R', phone: '97880 22114', city: 'Erode', visits: 2, lastVisit: 'Today' },
  { id: 'c5', name: 'Walk-in', phone: '—', city: '—', visits: 0, lastVisit: '—' },
]

export const products: Product[] = [
  { id: 'p1', name: 'Redmi Note 13', brand: 'Xiaomi', category: 'Phone', sku: 'PH-XN13', price: 14999, mrp: 15999, stock: 12, lowAt: 5, location: 'Rack A1', lastIn: '12 Sep' },
  { id: 'p2', name: 'Samsung A15', brand: 'Samsung', category: 'Phone', sku: 'PH-SA15', price: 16999, mrp: 17999, stock: 8, lowAt: 4, location: 'Rack A2', lastIn: '10 Sep' },
  { id: 'p3', name: 'iPhone 13', brand: 'Apple', category: 'Phone', sku: 'PH-IP13', price: 42999, mrp: 44999, stock: 3, lowAt: 2, location: 'Safe shelf', lastIn: '05 Sep' },
  { id: 'p4', name: 'Realme Narzo 70', brand: 'Realme', category: 'Phone', sku: 'PH-RN70', price: 13499, mrp: 14499, stock: 15, lowAt: 5, location: 'Rack A3', lastIn: '14 Sep' },
  { id: 'p5', name: 'Type-C Cable 1m', brand: 'Boat', category: 'Accessory', sku: 'AC-TC01', price: 299, mrp: 399, stock: 48, lowAt: 15, location: 'Drawer B1', lastIn: '16 Sep' },
  { id: 'p6', name: '20W Fast Charger', brand: 'Ambrane', category: 'Accessory', sku: 'AC-CH20', price: 699, mrp: 899, stock: 22, lowAt: 8, location: 'Drawer B2', lastIn: '15 Sep' },
  { id: 'p7', name: 'Tempered Glass', brand: 'Generic', category: 'Accessory', sku: 'AC-TG01', price: 149, mrp: 199, stock: 90, lowAt: 20, location: 'Drawer B3', lastIn: '17 Sep' },
  { id: 'p8', name: 'Back Cover Soft', brand: 'Generic', category: 'Accessory', sku: 'AC-BC01', price: 199, mrp: 249, stock: 64, lowAt: 15, location: 'Drawer B4', lastIn: '11 Sep' },
  { id: 'p9', name: 'Battery — Note 10', brand: 'OEM', category: 'Spare', sku: 'SP-BN10', price: 899, mrp: 999, stock: 6, lowAt: 4, location: 'Parts bin', lastIn: '08 Sep' },
  { id: 'p10', name: 'Display — A14', brand: 'OEM', category: 'Spare', sku: 'SP-DA14', price: 2499, mrp: 2799, stock: 2, lowAt: 2, location: 'Parts bin', lastIn: '03 Sep' },
]

export const suppliers = ['Raja Traders', 'Mobile Hub Distributors', 'City Spares', 'Local purchase']

export const stockLocations = ['Rack A1', 'Rack A2', 'Rack A3', 'Safe shelf', 'Drawer B1', 'Drawer B2', 'Drawer B3', 'Drawer B4', 'Parts bin']

export const recentBills: BillRow[] = [
  { id: 'b1', no: 'SM-1042', type: 'Sale', customer: 'Arun Kumar', phone: '98765 43210', amount: 15298, paid: 15298, time: '10:24 AM', date: '17 Sep 2026', payment: 'UPI', status: 'Paid' },
  { id: 'b2', no: 'SV-0311', type: 'Service', customer: 'Priya M', phone: '98430 11223', amount: 1499, paid: 1499, time: '11:05 AM', date: '17 Sep 2026', payment: 'Cash', status: 'Paid' },
  { id: 'b3', no: 'SM-1043', type: 'Sale', customer: 'Walk-in', phone: '—', amount: 448, paid: 448, time: '12:18 PM', date: '17 Sep 2026', payment: 'Cash', status: 'Paid' },
  { id: 'b4', no: 'SV-0312', type: 'Service', customer: 'Karthik S', phone: '90030 55667', amount: 3200, paid: 1000, time: '1:40 PM', date: '17 Sep 2026', payment: 'Part payment', status: 'Pending' },
  { id: 'b5', no: 'SM-1044', type: 'Sale', customer: 'Nisha R', phone: '97880 22114', amount: 16999, paid: 10000, time: '3:02 PM', date: '17 Sep 2026', payment: 'Part payment', status: 'Part' },
  { id: 'b6', no: 'SM-1045', type: 'Sale', customer: 'Arun Kumar', phone: '98765 43210', amount: 699, paid: 699, time: '4:15 PM', date: '17 Sep 2026', payment: 'UPI', status: 'Paid' },
]

export const serviceJobs: ServiceJob[] = [
  {
    id: 's1',
    ticket: 'SV-0313',
    customer: 'Meena V',
    phone: '99520 33445',
    device: 'Redmi Note 10',
    brand: 'Xiaomi',
    imei: '861234567890123',
    issue: 'Display cracked',
    status: 'Ready',
    eta: 'Today evening',
    deliveryDue: 'Today',
    estimate: 2800,
    advance: 500,
    billStatus: 'Final pending',
  },
  {
    id: 's2',
    ticket: 'SV-0312',
    customer: 'Karthik S',
    phone: '90030 55667',
    device: 'iPhone 11',
    brand: 'Apple',
    imei: '359876543210987',
    issue: 'Battery swell',
    status: 'Waiting parts',
    eta: '2 days',
    deliveryDue: 'Later',
    estimate: 4200,
    advance: 1000,
    billStatus: 'Advance only',
  },
  {
    id: 's3',
    ticket: 'SV-0310',
    customer: 'Suresh P',
    phone: '98840 77889',
    device: 'Samsung M14',
    brand: 'Samsung',
    imei: '352468135790246',
    issue: 'Charging port',
    status: 'Ready',
    eta: 'Ready for pickup',
    deliveryDue: 'Today',
    estimate: 1200,
    advance: 1200,
    billStatus: 'Final pending',
  },
  {
    id: 's4',
    ticket: 'SV-0314',
    customer: 'Lakshmi R',
    phone: '97890 44556',
    device: 'Vivo Y22',
    brand: 'Vivo',
    imei: '861112223334445',
    issue: 'Speaker not working',
    status: 'Ready',
    eta: 'Today afternoon',
    deliveryDue: 'Today',
    estimate: 850,
    advance: 200,
    billStatus: 'Final pending',
  },
  {
    id: 's5',
    ticket: 'SV-0315',
    customer: 'Arun Kumar',
    phone: '98765 43210',
    device: 'Realme 8',
    brand: 'Realme',
    imei: '869998887776665',
    issue: 'Software hang',
    status: 'In progress',
    eta: 'Today',
    deliveryDue: 'Today',
    estimate: 499,
    advance: 0,
    billStatus: 'Not billed',
  },
  {
    id: 's6',
    ticket: 'SV-0308',
    customer: 'Priya M',
    phone: '98430 11223',
    device: 'iPhone XR',
    brand: 'Apple',
    imei: '353334445556667',
    issue: 'Back glass',
    status: 'Delivered',
    eta: 'Done',
    deliveryDue: 'Later',
    estimate: 3499,
    advance: 3499,
    billStatus: 'Billed',
  },
]

/** Mobiles promised / ready for delivery today (not yet delivered) */
export const todayDeliveries = serviceJobs.filter(
  (j) => j.deliveryDue === 'Today' && j.status !== 'Delivered',
)

export const todayDeliveryCount = todayDeliveries.length

export const stockLedger = [
  { id: 'l1', item: 'Tempered Glass', type: 'IN', qty: 50, by: 'Owner', note: 'Purchase — Raja Traders', time: '9:10 AM' },
  { id: 'l2', item: 'Redmi Note 13', type: 'OUT', qty: 1, by: 'Counter 1', note: 'Sale SM-1042', time: '10:24 AM' },
  { id: 'l3', item: 'Display — A14', type: 'OUT', qty: 1, by: 'Counter 2', note: 'Service SV-0310', time: '11:40 AM' },
]

export const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
