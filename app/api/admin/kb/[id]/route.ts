import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { originOk, readJson } from '@/lib/security'
import { kbItemSchema, firstError } from '@/lib/validate'

export const runtime = 'nodejs'

const no = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdmin(req))) return no('Unauthorized', 401)
  if (!originOk(req)) return no('Forbidden', 403)

  const b = await readJson(req, 32 * 1024)
  if (!b.ok) return no(b.error || 'Bad request', b.status || 400)

  const parsed = kbItemSchema.safeParse(b.data)
  if (!parsed.success) return no(firstError(parsed.error), 400)

  try {
    const item = await db.knowledgeBaseItem.update({
      where: { id: params.id },
      data: {
        category: parsed.data.category,
        title: parsed.data.title,
        content: parsed.data.content,
        tags: parsed.data.tags,
        active: parsed.data.active,
      },
    })
    return NextResponse.json(
      {
        ok: true,
        item: {
          ...item,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return no('Knowledge Base entry not found', 404)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdmin(req))) return no('Unauthorized', 401)
  if (!originOk(req)) return no('Forbidden', 403)

  try {
    await db.knowledgeBaseItem.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return no('Knowledge Base entry not found', 404)
  }
}
