import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { isAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { getContent } from '@/lib/data'
import { SECTIONS } from '@/lib/schema'
import { sectionSchema, firstError } from '@/lib/validate'
import { originOk, readJson } from '@/lib/security'
export const runtime = 'nodejs'
const no = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
export async function GET() {
  if (!(await isAdmin())) return no('Unauthorized', 401)
  const content = await getContent(true)
  return new Response(JSON.stringify({ version: 1, content }, null, 2), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="portfolio-backup.json"', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return no('Unauthorized', 401)
  if (!originOk(req)) return no('Forbidden', 403)
  const b = await readJson(req, 1024 * 1024); if (!b.ok) return no(b.error, b.status)
  const c = b.data?.content
  if (!c || typeof c !== 'object' || Array.isArray(c)) return no('Invalid backup file', 400)
  const writes: { key: string; data: any }[] = []
  for (const key of Object.keys(SECTIONS)) {                       // validate EVERYTHING first, write only if all sections are valid
    if (c[key] === undefined) continue
    const p: any = sectionSchema(key).safeParse(c[key])
    if (!p.success) return no(`${SECTIONS[key].label} - ${firstError(p.error)}`, 400)
    writes.push({ key, data: p.data })
  }
  await db.$transaction(writes.map(w => db.content.upsert({ where: { key: w.key }, create: w, update: { data: w.data } })))
  revalidatePath('/'); return NextResponse.json({ ok: true, imported: writes.length })
}
