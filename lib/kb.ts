import { db } from './db'

export const KB_CATEGORIES = ['QA', 'BIODATA', 'EXPERIENCE', 'LOCATION', 'INSTRUCTIONS'] as const
export type KbCategory = (typeof KB_CATEGORIES)[number]

export async function getKbContextForAi(): Promise<{ kbContext: string; customInstructions: string; itemCount: number }> {
  const items = await db.knowledgeBaseItem.findMany({
    where: { active: true },
    orderBy: [{ category: 'asc' }, { updatedAt: 'desc' }],
  })
  const instructions: string[] = []
  const facts: string[] = []
  for (const item of items) {
    if (item.category === 'INSTRUCTIONS') {
      instructions.push(`- ${item.title}: ${item.content}`)
    } else {
      facts.push(`[${item.category}] ${item.title}\n${item.content}${item.tags ? `\nTags: ${item.tags}` : ''}`)
    }
  }
  return {
    kbContext: facts.join('\n\n---\n\n'),
    customInstructions: instructions.join('\n'),
    itemCount: items.length,
  }
}
