import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clientIp, originOk, readJson, rateLimit } from '@/lib/security'
import { contactSchema } from '@/lib/validate'

export const runtime = 'nodejs'

const err = (error: string, status: number, extra: Record<string, string> = {}) =>
  NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store', ...extra } })

export async function POST(req: NextRequest) {
  if (!originOk(req)) return err('Forbidden', 403)
  const ip = clientIp(req)
  const rl = await rateLimit('msg', ip, 3, 15 * 60_000)
  if (rl.blocked) return err('Too many messages. Try again later.', 429, { 'Retry-After': String(rl.retryAfter) })

  const body = await readJson(req, 8 * 1024)
  if (!body.ok) return err(body.error || 'Bad request', body.status || 400)

  const p: any = contactSchema.safeParse(body.data)
  if (!p.success) return err('Please check the fields and try again.', 400)
  if (p.data.website) return NextResponse.json({ ok: true })

  try {
    await db.message.create({ data: { name: p.data.name, email: p.data.email, body: p.data.body } })
  } catch (e) {
    console.error('contact insert failed', (e as Error)?.message)
    return err('Could not save your message.', 500)
  }

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
