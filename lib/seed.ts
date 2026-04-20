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

// Real Nessie sandbox merchant IDs
// Weighted toward food/daily spend so total ~$3100–3400 over 28 days
// Goal is $3000 → slight overage → score ~65–72 (medium wave, winnable)
const MERCHANTS = [
  { id: '57cf75cea73e494d8675ec4d', name: 'Ithaca Bakery',          weight: 5, min: 8,  max: 18  },
  { id: '57cf75cea73e494d8675ec56', name: 'Ithaca Coffee Company',   weight: 5, min: 4,  max: 8   },
  { id: '57cf75cea73e494d8675ec55', name: 'Saigon Kitchen',          weight: 4, min: 11, max: 22  },
  { id: '57cf75cea73e494d8675ec50', name: 'Terra Rosa',              weight: 3, min: 10, max: 20  },
  { id: '57cf75cea73e494d8675ec52', name: 'Dollar Tree',             weight: 3, min: 12, max: 30  },
  { id: '57cf75cea73e494d8675ec58', name: 'The Bookery',             weight: 2, min: 12, max: 28  },
  { id: '57cf75cea73e494d8675ec49', name: 'Apple',                   weight: 1, min: 9,  max: 15  },
  { id: '57cf75cea73e494d8675ec53', name: 'AT&T',                    weight: 1, min: 55, max: 70  },
  { id: '57cf75cea73e494d8675ec54', name: 'Six Mile Creek Vineyard', weight: 1, min: 22, max: 40  },
  { id: '57cf75cea73e494d8675ec51', name: 'shworldofgifts',          weight: 1, min: 18, max: 45  },
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
