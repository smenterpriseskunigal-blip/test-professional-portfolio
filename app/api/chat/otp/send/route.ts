import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { db } from '@/lib/db'
import { clientIp, originOk, readJson, rateLimit, hmacToken } from '@/lib/security'
import { otpSendSchema, firstError } from '@/lib/validate'
import { OtpDeliveryError, sendOtpEmail } from '@/lib/notify'

export const runtime = 'nodejs'

const err = (error: string, status: number, extra: Record<string, string> = {}) =>
  NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store', ...extra } })

const RESEND_COOLDOWN_MS = 30_000
const OTP_TTL_MS = 10 * 60_000

export async function POST(req: NextRequest) {
  if (!originOk(req)) return err('Forbidden', 403)
  const ip = clientIp(req)
  const rl = await rateLimit('otp_send', ip, 6, 15 * 60_000)
  if (rl.blocked) return err('Too many OTP requests. Please try again later.', 429, { 'Retry-After': String(rl.retryAfter) })

  const b = await readJson(req, 8 * 1024)
  if (!b.ok) return err(b.error || 'Bad request', b.status || 400)

  const parsed = otpSendSchema.safeParse(b.data)
  if (!parsed.success) return err(firstError(parsed.error), 400)
  const { email, fullName } = parsed.data

  let createdId: string | null = null
  try {
    const latest = await db.otpVerification.findFirst({
      where: { email, verifiedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    if (latest) {
      const elapsed = Date.now() - new Date(latest.lastSentAt).getTime()
      if (elapsed < RESEND_COOLDOWN_MS) {
        const wait = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)
        return err(`Please wait ${wait}s before requesting another code.`, 429, { 'Retry-After': String(wait) })
      }
    }

    const otp = String(randomInt(100000, 1000000))
    const created = await db.otpVerification.create({
      data: {
        email,
        codeHash: hmacToken(`${email}:${otp}`),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        lastSentAt: new Date(),
      },
    })
    createdId = created.id

    await sendOtpEmail({ email, fullName, otp })

    // Housekeeping: drop OTP rows older than a day (best effort, never blocks the response).
    db.otpVerification.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 3600_000) } } }).catch(() => {})

    return NextResponse.json({ ok: true, resendAfter: RESEND_COOLDOWN_MS / 1000 }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    if (createdId) await db.otpVerification.delete({ where: { id: createdId } }).catch(() => {})
    console.error('OTP send error:', (e as Error)?.message)
    if (e instanceof OtpDeliveryError) return err(e.message, e.status)
    return err('Could not send the verification email. Please try again.', 500)
  }
}
