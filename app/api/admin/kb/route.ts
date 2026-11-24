import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { originOk, readJson } from '@/lib/security'
import { kbItemSchema, firstError } from '@/lib/validate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const no = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })

export async function GET() {
  if (!(await isAdmin())) return no('Unauthorized', 401)
  const items = await db.knowledgeBaseItem.findMany({
    orderBy: [{ category: 'asc' }, { updatedAt: 'desc' }],
  })
  return NextResponse.json(
    {
      items: items.map((x: any) => ({
        ...x,
        createdAt: new Date(x.createdAt).toISOString(),
        updatedAt: new Date(x.updatedAt).toISOString(),
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) return no('Unauthorized', 401)
  if (!originOk(req)) return no('Forbidden', 403)

  const b = await readJson(req, 32 * 1024)
  if (!b.ok) return no(b.error || 'Bad request', b.status || 400)

  const parsed = kbItemSchema.safeParse(b.data)
  if (!parsed.success) return no(firstError(parsed.error), 400)

  const item = await db.knowledgeBaseItem.create({
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
        createdAt: new Date(item.createdAt || Date.now()).toISOString(),
        updatedAt: new Date(item.updatedAt || Date.now()).toISOString(),
      },
    },
    { status: 201, headers: { 'Cache-Control': 'no-store' } }
  )
}
