import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { isAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { SECTIONS } from '@/lib/schema'
import { sectionSchema, firstError } from '@/lib/validate'
import { originOk, readJson } from '@/lib/security'
export const runtime = 'nodejs'
const no = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
const known = (k: unknown): k is string => typeof k === 'string' && Object.prototype.hasOwnProperty.call(SECTIONS, k)

export async function PUT(req: NextRequest) {
  if (!(await isAdmin())) return no('Unauthorized', 401)
  if (!originOk(req)) return no('Forbidden', 403)
  const b = await readJson(req, 512 * 1024); if (!b.ok) return no(b.error, b.status)
  const { key, data } = b.data || {}
  if (!known(key)) return no('Unknown section', 400)
  const p: any = sectionSchema(key).safeParse(data)
  if (!p.success) return no(firstError(p.error), 400)
  await db.content.upsert({ where: { key }, create: { key, data: p.data as any }, update: { data: p.data as any } })
  revalidatePath('/'); return NextResponse.json({ ok: true })
}
export async function DELETE(req: NextRequest) { // reset a section to the sample data
  if (!(await isAdmin())) return no('Unauthorized', 401)
  if (!originOk(req)) return no('Forbidden', 403)
  const b = await readJson(req, 1024); if (!b.ok) return no(b.error, b.status)
  if (!known(b.data?.key)) return no('Unknown section', 400)
  await db.content.deleteMany({ where: { key: b.data.key } }); revalidatePath('/'); return NextResponse.json({ ok: true })
}
