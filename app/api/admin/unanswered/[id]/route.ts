import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { originOk, readJson } from '@/lib/security'
import { resolveUnansweredSchema, firstError } from '@/lib/validate'
import { broadcastAdmin } from '@/lib/chat-hub'

export const runtime = 'nodejs'

const no = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdmin(req))) return no('Unauthorized', 401)
  if (!originOk(req)) return no('Forbidden', 403)

  const b = await readJson(req, 32 * 1024)
  if (!b.ok) return no(b.error || 'Bad request', b.status || 400)

  const parsed = resolveUnansweredSchema.safeParse(b.data)
  if (!parsed.success) return no(firstError(parsed.error), 400)

  const existing = await db.unansweredQuestion.findUnique({ where: { id: params.id } })
  if (!existing) return no('Question not found', 404)

  if (parsed.data.action === 'dismiss') {
    const updated = await db.unansweredQuestion.update({
      where: { id: existing.id },
      data: { status: 'DISMISSED' },
    })
    const serialized = {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }
    broadcastAdmin({ type: 'unanswered:updated', question: serialized })
    return NextResponse.json({ ok: true, question: serialized }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const answer = (parsed.data.answer || '').trim()
  if (answer.length < 2) return no('Please provide an answer to save into the Knowledge Base.', 400)

  const kbItem = await db.knowledgeBaseItem.create({
    data: {
      category: parsed.data.category || 'QA',
      title: (parsed.data.title || existing.question).slice(0, 300),
      content: answer,
      tags: parsed.data.tags || 'escalated, faq',
      active: true,
    },
  })

  const updated = await db.unansweredQuestion.update({
    where: { id: existing.id },
    data: {
      status: 'ADDED_TO_KB',
      answer,
      kbItemId: kbItem.id,
    },
  })

  const serializedQ = {
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  }
  const serializedKb = {
    ...kbItem,
    createdAt: kbItem.createdAt.toISOString(),
    updatedAt: kbItem.updatedAt.toISOString(),
  }

  broadcastAdmin({ type: 'unanswered:updated', question: serializedQ })

  return NextResponse.json(
    { ok: true, question: serializedQ, kbItem: serializedKb },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
