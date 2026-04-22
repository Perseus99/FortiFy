import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001'
const PDF_MODEL = 'claude-sonnet-4-6'

// Single-turn: used by analyst agent and statement parser
export async function chat(systemPrompt: string, userMessage: string, maxTokens = 1024): Promise<string> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })
  return (msg.content[0] as { text: string }).text
}

// PDF document: used by upload-statement route
export async function chatWithPDF(systemPrompt: string, pdfBase64: string, userMessage: string, maxTokens = 2048): Promise<string> {
  const msg = await client.messages.create({
    model: PDF_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } } as any,
        { type: 'text', text: userMessage },
      ],
    }],
  })
  return (msg.content[0] as { text: string }).text
}

// Multi-turn: used by NPC agent
export async function chatWithHistory(
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: systemPrompt,
    messages: messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })) as Anthropic.MessageParam[],
  })
  return (msg.content[0] as { text: string }).text
}
