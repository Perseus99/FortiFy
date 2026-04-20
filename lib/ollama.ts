import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001'

// Single-turn: used by analyst agent
export async function chat(systemPrompt: string, userMessage: string): Promise<string> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
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
