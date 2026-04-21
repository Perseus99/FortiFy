import { NextRequest, NextResponse } from 'next/server'
import { chat, chatWithPDF } from '@/lib/claude'

export const maxDuration = 120

const SYSTEM_PROMPT = `You are a bank statement parser. Extract all transactions from the provided bank statement PDF.
Return ONLY a valid JSON array with no markdown, no explanation, no code blocks. Each transaction object must have:
- merchant: string
- amount: number (always positive)
- category: exactly one of "food" | "subscriptions" | "shopping" | "transport" | "entertainment" | "utilities" | "income" | "other"
- flagged: boolean (true for: subscriptions worth reviewing, delivery food markups, recurring charges, unusually large purchases, or repeat splurges)
- flag_reason: string | null (short reason if flagged, null otherwise)

Income (salary, paycheck, direct deposit) → category "income", flagged false.
Return ONLY the JSON array starting with [ and ending with ].`

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const period = formData.get('period') as string | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!['week1', 'week1half', 'week2'].includes(period ?? ''))
      return NextResponse.json({ error: 'Invalid period' }, { status: 400 })

    const isText = file.type === 'text/plain' || file.name.endsWith('.txt')
    let raw: string

    if (isText) {
      const text = await file.text()
      raw = await chat(
        SYSTEM_PROMPT,
        `Extract all transactions from this bank statement:\n\n${text}`
      )
    } else {
      const buffer = Buffer.from(await file.arrayBuffer())
      const base64 = buffer.toString('base64')
      raw = await chatWithPDF(
        SYSTEM_PROMPT,
        base64,
        'Extract all transactions from this bank statement. Return only the JSON array.'
      )
    }

    const jsonMatch = raw.trim().match(/\[[\s\S]*\]/)
    if (!jsonMatch) return NextResponse.json({ error: 'Could not parse transactions from statement' }, { status: 422 })

    const transactions = JSON.parse(jsonMatch[0])
    const totalSpend  = transactions.filter((t: any) => t.category !== 'income').reduce((s: number, t: any) => s + t.amount, 0)
    const totalIncome = transactions.filter((t: any) => t.category === 'income').reduce((s: number, t: any) => s + t.amount, 0)

    return NextResponse.json({ transactions, period, totalSpend, totalIncome, count: transactions.length })
  } catch (err: any) {
    console.error('[upload-statement]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
