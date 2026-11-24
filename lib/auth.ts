import { cookies, headers } from 'next/headers'
import { COOKIE, VISITOR_COOKIE, verifySession, verifyVisitorSession } from './session'

export const isAdmin = async (req?: Request) => {
  const authHeader = req?.headers.get('authorization') || headers().get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    if (await verifySession(authHeader.slice(7).trim())) return true
  }
  return verifySession(cookies().get(COOKIE)?.value)
}

export const getVisitorSessionId = async (req?: Request): Promise<string | null> => {
  const authHeader = req?.headers.get('authorization') || headers().get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const sid = await verifyVisitorSession(authHeader.slice(7).trim())
    if (sid) return sid
  }
  if (req) {
    try {
      const urlToken = new URL(req.url).searchParams.get('token')
      if (urlToken) {
        const sid = await verifyVisitorSession(urlToken)
        if (sid) return sid
      }
    } catch {}
  }
  return verifyVisitorSession(cookies().get(VISITOR_COOKIE)?.value)
}
