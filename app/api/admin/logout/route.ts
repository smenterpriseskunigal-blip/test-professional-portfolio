import { NextResponse } from 'next/server'
import { COOKIE } from '@/lib/session'
import { cookieOpts } from '@/lib/cookies'

export async function POST() {
  const r = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  r.cookies.set(COOKIE, '', cookieOpts(0))
  return r
}
