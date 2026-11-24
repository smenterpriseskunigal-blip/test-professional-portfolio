import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { COOKIE, signSession, sessionConfigured } from '@/lib/session'
import { cookieOpts } from '@/lib/cookies'
import { clientIp, originOk, readJson, rateLimit, rateLimitReset, safeEq } from '@/lib/security'

export const runtime = 'nodejs'

const DUMMY = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO5pJ7yH0yWq1Qn4VtGq9nWm0cQ8lBqFa'
const no = (error: string, status: number, h: Record<string, string> = {}) =>
  NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store', ...h } })

export async function POST(req: NextRequest) {
  if (!originOk(req)) return no('Forbidden', 403)
  const ip = clientIp(req)
  const rl = await rateLimit('login', ip, 10, 15 * 60_000)
  if (rl.blocked) return no('Too many attempts. Try again in 15 minutes.', 429, { 'Retry-After': String(rl.retryAfter) })

  const b = await readJson(req, 2 * 1024)
  if (!b.ok) return no(b.error || 'Bad request', b.status || 400)
  const { user, password } = b.data || {}

  const rawHash = (process.env.ADMIN_PASSWORD_HASH || '').trim().replace(/\\\$/g, '$')
  const allowedUsers = ['admin', 'yashwanthgowdam.in']
  if (!rawHash || !sessionConfigured() || !/^\$2[aby]\$\d\d\$.{53}$/.test(rawHash)) {
    console.error('Admin login is misconfigured: AUTH_SECRET (>=32 chars) and valid ADMIN_PASSWORD_HASH are required.')
    return no('Login is unavailable.', 500)
  }

  const normalizedUser = typeof user === 'string' ? user.trim().toLowerCase() : ''
  const okInput =
    typeof user === 'string' &&
    typeof password === 'string' &&
    normalizedUser.length > 0 &&
    normalizedUser.length <= 100 &&
    password.length > 0 &&
    password.length <= 128

  const userMatches = okInput && allowedUsers.some(candidate => safeEq(normalizedUser, candidate))
  const passOk = await bcrypt.compare(okInput ? password : 'x', userMatches ? rawHash : DUMMY)
  if (!(okInput && passOk && userMatches)) {
    return no('Wrong username or password.', 401)
  }

  await rateLimitReset('login', ip)
  const token = await signSession()
  const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  res.cookies.set(COOKIE, token, cookieOpts(8 * 3600))
  return res
}
