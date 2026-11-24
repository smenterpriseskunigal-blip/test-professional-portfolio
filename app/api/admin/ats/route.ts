import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { getContent } from '@/lib/data'
import { atsScore } from '@/lib/ats'
import { originOk, readJson } from '@/lib/security'
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!originOk(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await readJson(req, 32 * 1024); if (!b.ok) return NextResponse.json({ error: b.error }, { status: b.status })
  return NextResponse.json(atsScore(await getContent(), String(b.data?.jd || '').slice(0, 10000)), { headers: { 'Cache-Control': 'no-store' } })
}
