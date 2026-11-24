import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clientIp, originOk, readJson, rateLimit, hashIp, hmacToken, safeEq } from '@/lib/security'
import { otpVerifySchema, firstError } from '@/lib/validate'
import { VISITOR_COOKIE, signVisitorSession } from '@/lib/session'
import { cookieOpts } from '@/lib/cookies'
import { broadcastAdmin, serializeSession } from '@/lib/chat-hub'
import { sendAdminVisitorVerifiedEmail } from '@/lib/notify'

export const runtime = 'nodejs'

const err = (error: string, status: number, extra: Record<string, string> = {}) =>
  NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store', ...extra } })

const MAX_ATTEMPTS = 5

export async function POST(req: NextRequest) {
  if (!originOk(req)) return err('Forbidden', 403)
  const ip = clientIp(req)
  const rl = await rateLimit('otp_verify', ip, 10, 15 * 60_000)
  if (rl.blocked) return err('Too many verification attempts. Try again later.', 429, { 'Retry-After': String(rl.retryAfter) })

  const b = await readJson(req, 8 * 1024)
  if (!b.ok) return err(b.error || 'Bad request', b.status || 400)
  const parsed = otpVerifySchema.safeParse(b.data)
  if (!parsed.success) return err(firstError(parsed.error), 400)

  const { fullName, roleType, source, countryCode, mobile, email, otp } = parsed.data

  try {
    // The database row is the single source of truth for the code.
    const record = await db.otpVerification.findFirst({
      where: { email, verifiedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    if (!record) return err('No active verification code found. Please request a new OTP.', 400)
    if (new Date(record.expiresAt).getTime() < Date.now()) return err('This verification code has expired. Please request a new OTP.', 400)
    if (record.attempts >= MAX_ATTEMPTS) return err('Too many incorrect attempts. Please request a new OTP.', 429)

    if (!safeEq(record.codeHash, hmacToken(`${email}:${otp}`))) {
      await db.otpVerification.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } })
      return err('Incorrect verification code. Please check and try again.', 400)
    }

    // Atomic one-time use: only one concurrent request can flip verifiedAt from null.
    const claimed = await db.otpVerification.updateMany({ where: { id: record.id, verifiedAt: null }, data: { verifiedAt: new Date() } })
    if (claimed.count !== 1) return err('This verification code has already been used. Please request a new OTP.', 400)

    const session = await db.visitorSession.create({
      data: {
        fullName, roleType, source, countryCode, mobile, email,
        emailVerified: true,
        status: 'AI_ACTIVE',
        ipHash: hashIp(ip),
        userAgent: (req.headers.get('user-agent') || '').slice(0, 250),
      },
    })
    const welcome = await db.chatMessage.create({
      data: {
        sessionId: session.id,
        sender: 'AI',
        body: `Hi ${fullName}! Your email is verified. I'm Yashwanth's AI assistant—ask me anything about his work experience, Kubernetes/DevOps skills, projects, or location preferences.`,
      },
    })

    const token = await signVisitorSession(session.id)
    const serializedSession = serializeSession(session)
    const serializedWelcome = { ...welcome, createdAt: new Date(welcome.createdAt).toISOString() }
    broadcastAdmin({ type: 'session:verified', session: { ...serializedSession, messages: [serializedWelcome] } })

    const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').split(',')[0].trim()
    const proto = (req.headers.get('x-forwarded-proto') || 'https').split(',')[0].trim()
    sendAdminVisitorVerifiedEmail({
      fullName, roleType, source, countryCode, mobile, email,
      adminUrl: host ? `${proto}://${host}/admin/chats` : undefined,
    }).catch(e => console.error('Admin visitor alert email error:', (e as Error)?.message))

    const res = NextResponse.json(
      { ok: true, token, session: serializedSession, messages: [serializedWelcome] },
      { headers: { 'Cache-Control': 'no-store' } }
    )
    res.cookies.set(VISITOR_COOKIE, token, cookieOpts(24 * 3600))
    return res
  } catch (e) {
    console.error('OTP verify error:', (e as Error)?.message)
    return err('Could not verify the code right now. Please try again.', 500)
  }
}
