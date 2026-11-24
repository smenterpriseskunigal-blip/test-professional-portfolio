import { getContent } from './data'
import { safeEmail } from './safe'

export type OtpDeliveryResult = {
  delivered: boolean
  provider: 'resend'
}

export class OtpDeliveryError extends Error {
  status: number
  constructor(message: string, status = 500) {
    super(message)
    this.status = status
  }
}

async function sendResendEmail(params: {
  to: string[]
  subject: string
  text: string
  replyTo?: string
}): Promise<void> {
  const resendKey = (process.env.RESEND_API_KEY || '').trim()
  if (!resendKey) {
    throw new OtpDeliveryError('Email OTP service is not configured (RESEND_API_KEY missing).', 503)
  }

  const from = (process.env.OTP_FROM_EMAIL || '').trim()
  if (!from) {
    throw new OtpDeliveryError('Email sender is not configured (OTP_FROM_EMAIL missing).', 503)
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      ...(params.replyTo ? { reply_to: params.replyTo } : {}),
    }),
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    let detail = ''
    try {
      const parsed = JSON.parse(errBody)
      if (typeof parsed?.message === 'string') detail = parsed.message
    } catch {
      detail = errBody.slice(0, 160)
    }
    throw new OtpDeliveryError(
      detail ? `Email delivery failed: ${detail}` : `Email delivery failed (HTTP ${res.status}).`,
      res.status >= 400 && res.status < 500 ? 502 : 500
    )
  }
}

export async function resolveAdminAlertEmail(): Promise<string | null> {
  const envEmail = safeEmail((process.env.ADMIN_ALERT_EMAIL || '').trim())
  if (envEmail) return envEmail

  try {
    const content = await getContent(true)
    const profileEmail = safeEmail(String(content?.profile?.email || '').trim())
    if (profileEmail) return profileEmail
  } catch {}

  return null
}

export async function sendOtpEmail(params: {
  email: string
  fullName: string
  otp: string
}): Promise<OtpDeliveryResult> {
  await sendResendEmail({
    to: [params.email],
    subject: 'Your Verification Code – Yashwanth Gowda M Portfolio',
    text: `Hi ${params.fullName},\n\nYour 6-digit verification code to start chatting with Yashwanth's AI assistant is: ${params.otp}\n\nThis code expires in 10 minutes.\n`,
  })

  return { delivered: true, provider: 'resend' }
}

export async function sendAdminVisitorVerifiedEmail(params: {
  fullName: string
  roleType: string
  source: string
  countryCode: string
  mobile: string
  email: string
  adminUrl?: string
}): Promise<boolean> {
  const adminEmail = await resolveAdminAlertEmail()
  if (!adminEmail) {
    console.warn('Admin alert skipped: set ADMIN_ALERT_EMAIL or profile.email in portfolio content.')
    return false
  }

  const lines = [
    'A new visitor completed Email OTP verification and started chatting with your AI assistant.',
    '',
    `Name: ${params.fullName}`,
    `Role: ${params.roleType}`,
    `Source: ${params.source}`,
    `Mobile: ${params.countryCode} ${params.mobile}`,
    `Company Email: ${params.email}`,
    params.adminUrl ? `\nMonitor or Take Over Chat: ${params.adminUrl}` : '\nOpen /admin/chats on your site to monitor or take over the chat.',
  ]

  await sendResendEmail({
    to: [adminEmail],
    replyTo: params.email,
    subject: `New Verified Chat Visitor: ${params.fullName} (${params.roleType})`,
    text: lines.join('\n'),
  })
  return true
}

export async function sendAdminEscalationEmail(params: {
  session: {
    fullName: string
    roleType: string
    source: string
    countryCode: string
    mobile: string
    email: string
  }
  questionText: string
  adminUrl?: string
}): Promise<boolean> {
  const adminEmail = await resolveAdminAlertEmail()
  if (!adminEmail) {
    console.warn('Escalation email skipped: set ADMIN_ALERT_EMAIL or profile.email in portfolio content.')
    return false
  }

  const s = params.session
  const lines = [
    'HIGH-PRIORITY ALERT: A visitor asked a question outside your Knowledge Base.',
    'A 5-minute live takeover timer has started. Take over the chat within 5 minutes to reply live before the fallback away notice is shown.',
    '',
    `Question: "${params.questionText}"`,
    '',
    `Visitor: ${s.fullName} (${s.roleType})`,
    `Source: ${s.source}`,
    `Mobile: ${s.countryCode} ${s.mobile}`,
    `Email: ${s.email}`,
    params.adminUrl ? `\nTake Over Chat Now: ${params.adminUrl}` : '\nOpen /admin/chats immediately to click "Take Over Chat".',
  ]

  await sendResendEmail({
    to: [adminEmail],
    replyTo: s.email,
    subject: `[URGENT · 5m Wait] Unanswered Question from ${s.fullName} (${s.roleType})`,
    text: lines.join('\n'),
  })
  return true
}
