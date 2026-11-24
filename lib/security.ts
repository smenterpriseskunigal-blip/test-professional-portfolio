import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { db } from './db'

// ---------- client IP ----------
// On Vercel, x-vercel-forwarded-for / x-real-ip are set by the platform and cannot be spoofed by visitors.
export function clientIp(req: Request) {
  const h = req.headers
  return (h.get('x-vercel-forwarded-for') || h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim().slice(0, 64)
}
// AUTH_SECRET keys every hash below. In production a missing secret is a hard error (never fall back to a public constant).
const hmacKey = () => {
  const s = process.env.AUTH_SECRET || ''
  if (s.length >= 32) return s
  if (process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET is missing or shorter than 32 characters')
  return 'dev-only-secret-not-for-production-use-0123456789'
}
const ipKey = (scope: string, ip: string) => scope + ':' + createHmac('sha256', hmacKey()).update(ip).digest('hex').slice(0, 32) // IPs are stored hashed
export const hashIp = (ip: string) => createHmac('sha256', hmacKey()).update(ip).digest('hex').slice(0, 32)
export const hmacToken = (value: string) => createHmac('sha256', hmacKey()).update('otp:' + value).digest('hex')

// ---------- CORS / origin ----------
// No Access-Control-Allow-* header is ever sent, so browsers block cross-origin reads. This also rejects cross-site POSTs.
export function allowedOrigins() {
  const base = ['https://yashwanthgowdam.in', 'https://www.yashwanthgowdam.in']
  const extra = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean) // e.g. a Vercel preview URL
  if (process.env.NODE_ENV !== 'production') base.push('http://localhost:3000')
  return [...base, ...extra]
}
export const originOk = (req: Request) => {
  const o = req.headers.get('origin')
  if (!o) return false
  if (allowedOrigins().includes(o)) return true
  try {
    const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').split(',')[0].trim()
    return !!host && new URL(o).host === host
  } catch {
    return false
  }
}

// ---------- body size limit (streams, so a huge body is never fully buffered) ----------
export async function readJson(req: Request, maxBytes: number): Promise<{ ok: boolean; data?: any; status?: number; error?: string }> {
  const len = Number(req.headers.get('content-length') || 0)
  if (len > maxBytes) return { ok: false, status: 413, error: 'Payload too large' }
  if (!(req.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return { ok: false, status: 415, error: 'Send JSON' }
  if (!req.body) return { ok: false, status: 400, error: 'Empty body' }
  const reader = req.body.getReader(), chunks: Uint8Array[] = []; let total = 0
  for (;;) {
    const { done, value } = await reader.read(); if (done) break
    total += value.byteLength
    if (total > maxBytes) { try { await reader.cancel() } catch {} return { ok: false, status: 413, error: 'Payload too large' } }
    chunks.push(value)
  }
  try { return { ok: true, data: JSON.parse(Buffer.concat(chunks).toString('utf8')) } } catch { return { ok: false, status: 400, error: 'Invalid JSON' } }
}

// ---------- rate limiting (stored in Postgres so it works across serverless instances) ----------
const mem = new Map<string, { n: number; reset: number }>() // per-instance fallback, used only if the limiter query itself fails
const gSec = globalThis as unknown as { __dbLimiterRetryAt?: number }
function memHit(key: string, windowMs: number) {
  const now = Date.now(), e = mem.get(key)
  if (!e || e.reset < now) { mem.set(key, { n: 1, reset: now + windowMs }); return { n: 1, reset: now + windowMs } }
  e.n++; return e
}
/** Counts this call and returns { blocked, retryAfter(seconds) }. */
export async function rateLimit(scope: string, ip: string, max: number, windowMs: number) {
  const key = ipKey(scope, ip)
  if (Date.now() < (gSec.__dbLimiterRetryAt || 0)) {
    const r = memHit(key, windowMs); return { blocked: r.n > max, retryAfter: Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)) }
  }
  try {
    const reset = new Date(Date.now() + windowMs)
    const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "RateLimit" ("key","count","resetAt") VALUES (${key}, 1, ${reset})
      ON CONFLICT ("key") DO UPDATE SET
        "count"   = CASE WHEN "RateLimit"."resetAt" < now() THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" < now() THEN ${reset} ELSE "RateLimit"."resetAt" END
      RETURNING "count", "resetAt"`
    if (Math.random() < 0.02) db.$executeRaw`DELETE FROM "RateLimit" WHERE "resetAt" < now() - interval '1 day'`.catch(() => {}) // tidy old rows (best effort)
    const r = rows[0]
    return { blocked: Number(r.count) > max, retryAfter: Math.max(1, Math.ceil((new Date(r.resetAt).getTime() - Date.now()) / 1000)) }
  } catch (e) {
    console.error('Rate-limit query failed, using per-instance fallback for 5 minutes:', (e as Error)?.message)
    gSec.__dbLimiterRetryAt = Date.now() + 5 * 60_000
    const r = memHit(key, windowMs); return { blocked: r.n > max, retryAfter: Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)) }
  }
}
export async function rateLimitReset(scope: string, ip: string) {
  const key = ipKey(scope, ip); mem.delete(key)
  if (Date.now() < (gSec.__dbLimiterRetryAt || 0)) return
  try { await db.$executeRaw`DELETE FROM "RateLimit" WHERE "key" = ${key}` } catch (e) { console.error('Rate-limit reset failed:', (e as Error)?.message) }
}

// ---------- text sanitising ----------
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g // control + invisible/bidi chars
export const cleanText = (s: string, multiline = false) => {
  let t = s.normalize('NFC').replace(/\r\n?/g, '\n').replace(CTRL, '')
  if (!multiline) t = t.replace(/\s+/g, ' ')
  return t.trim()
}
/** For PUBLIC input: also removes anything that looks like an HTML tag. */
export const stripTags = (s: string) => s.replace(/<\/?[a-zA-Z!][^>]*>?/g, '').replace(/&#?\w+;/g, ' ').replace(/[<>]/g, '')

// constant-time string compare
export const safeEq = (a: string, b: string) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest())
