// Edge-safe session helpers (used by middleware.ts AND server routes). No Node-only imports here.
import { SignJWT, jwtVerify } from 'jose'

const prod = process.env.NODE_ENV === 'production'
export const COOKIE = prod ? '__Host-adm' : 'adm'
export const VISITOR_COOKIE = prod ? '__Host-vchat' : 'vchat'
const ISS = 'portfolio', AUD = 'admin'
const V_ISS = 'portfolio-visitor', V_AUD = 'chat'

export const sessionConfigured = () => (process.env.AUTH_SECRET || '').length >= 32

// AUTH_SECRET is mandatory in production. A random per-instance fallback would silently break every session
// on serverless / multi-instance deployments, so we fail instead. The fixed dev value is for `next dev` only.
const secret = () => {
  const s = process.env.AUTH_SECRET || ''
  if (s.length >= 32) return new TextEncoder().encode(s)
  if (prod) throw new Error('AUTH_SECRET is missing or shorter than 32 characters')
  return new TextEncoder().encode('dev-only-secret-not-for-production-use-0123456789')
}

export async function signSession() {
  return new SignJWT({ a: 1 })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISS)
    .setAudience(AUD)
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret())
}

export async function verifySession(token?: string) {
  if (!token) return false
  try {
    await jwtVerify(token, secret(), { algorithms: ['HS256'], issuer: ISS, audience: AUD })
    return true
  } catch {
    return false
  }
}

export async function signVisitorSession(sessionId: string) {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(V_ISS)
    .setAudience(V_AUD)
    .setSubject(sessionId)
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret())
}

export async function verifyVisitorSession(token?: string): Promise<string | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'], issuer: V_ISS, audience: V_AUD })
    return typeof payload.sub === 'string' && payload.sub ? payload.sub : null
  } catch {
    return null
  }
}
