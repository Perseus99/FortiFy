import { createCustomer, createAccount, createPurchase, getAccounts } from './nessie'

const BASE_URL = process.env.NESSIE_BASE_URL || 'http://api.nessieisreal.com'
const API_KEY  = process.env.NESSIE_API_KEY!

async function createDeposit(accountId: string, amount: number, date: string, description: string) {
  const res = await fetch(`${BASE_URL}/accounts/${accountId}/deposits?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ medium: 'balance', transaction_date: date, status: 'completed', amount, description }),
  })
  return res.json()
}

// Real Nessie sandbox merchant IDs — spread across categories so keyword
// categorizer produces a realistic multi-category breakdown
const MERCHANTS = [
  // Food (~40% weight)
  { id: '57cf75cea73e494d8675ec4d', name: 'Ithaca Bakery & Cafe',    weight: 5, min: 8,  max: 18  },
  { id: '57cf75cea73e494d8675ec56', name: 'Starbucks Coffee',         weight: 4, min: 4,  max: 8   },
  { id: '57cf75cea73e494d8675ec55', name: 'Chipotle Restaurant',      weight: 3, min: 11, max: 22  },
  { id: '57cf75cea73e494d8675ec50', name: 'Local Grill & Bistro',     weight: 2, min: 10, max: 20  },
  // Shopping (~20% weight)
  { id: '57cf75cea73e494d8675ec52', name: 'Target Store',             weight: 3, min: 15, max: 45  },
  { id: '57cf75cea73e494d8675ec51', name: 'Amazon Marketplace',       weight: 2, min: 18, max: 60  },
  // Subscriptions (~15% weight)
  { id: '57cf75cea73e494d8675ec49', name: 'Netflix Subscription',     weight: 1, min: 15, max: 18  },
  { id: '57cf75cea73e494d8675ec58', name: 'Spotify Subscription',     weight: 1, min: 9,  max: 10  },
  { id: '57cf75cea73e494d8675ec53', name: 'Adobe Subscription',       weight: 1, min: 54, max: 55  },
  // Utilities (~10% weight)
  { id: '57cf75cea73e494d8675ec54', name: 'Verizon Phone Bill',       weight: 1, min: 65, max: 75  },
  // Entertainment (~10% weight)
  { id: '57cf75cea73e494d8675ec5a', name: 'Cinema Movie Tickets',     weight: 1, min: 14, max: 28  },
  { id: '57cf75cea73e494d8675ec5b', name: 'Steam Game Store',         weight: 1, min: 10, max: 30  },
]

// Build weighted merchant pool
const MERCHANT_POOL = MERCHANTS.flatMap(m => Array(m.weight).fill(m))

function rand(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

export async function seedNessieAccount(firstName: string, lastName: string) {
  const customerRes = await createCustomer(firstName, lastName)
  const customerId = customerRes.objectCreated._id

  const accountRes = await createAccount(customerId, 3000)
  const accountId = accountRes.objectCreated._id

  // Weekly income deposits (4 weeks) — ~$6000 total
  const depositPromises = [0, 7, 14, 21].map(daysBack =>
    createDeposit(accountId, rand(1450, 1600), daysAgo(daysBack), 'Paycheck')
  )

  // Daily purchases (28 days, 1-2 per day) — targets ~$3100-3300 total spend
  const purchasePromises: Promise<any>[] = []
  for (let day = 27; day >= 0; day--) {
    const date = daysAgo(day)
    const count = Math.random() < 0.4 ? 1 : 2   // 40% chance of 1 purchase, 60% chance of 2
    for (let i = 0; i < count; i++) {
      const m = MERCHANT_POOL[Math.floor(Math.random() * MERCHANT_POOL.length)]
      purchasePromises.push(createPurchase(accountId, m.id, m.name, rand(m.min, m.max), date))
    }
  }

  await Promise.all([...depositPromises, ...purchasePromises])
  return { customerId, accountId }
}
