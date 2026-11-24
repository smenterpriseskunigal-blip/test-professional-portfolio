import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getVisitorSessionId } from '@/lib/auth'
import { VISITOR_COOKIE } from '@/lib/session'
import { cookieOpts } from '@/lib/cookies'
import { originOk } from '@/lib/security'
import { broadcastSession, cancelEscalationTimer, serializeSession, sweepExpiredEscalations } from '@/lib/chat-hub'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const sessionId = await getVisitorSessionId(req)
  if (!sessionId) {
    return NextResponse.json({ session: null, messages: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    await sweepExpiredEscalations(sessionId)
    const session = await db.visitorSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    if (!session) {
      return NextResponse.json({ session: null, messages: [] }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const serialized = serializeSession(session)
    return NextResponse.json(
      { session: serialized, messages: serialized.messages || [] },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    console.error('Chat session GET error:', (e as Error)?.message)
    return NextResponse.json({ session: null, messages: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function DELETE(req: NextRequest) {
  if (!originOk(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const sessionId = await getVisitorSessionId(req)
  if (sessionId) {
    cancelEscalationTimer(sessionId)
    try {
      await db.visitorSession.update({
        where: { id: sessionId },
        data: { status: 'CLOSED', escalationStartedAt: null, escalationExpiresAt: null },
      })
      broadcastSession(sessionId, { type: 'session:status', sessionId, status: 'CLOSED', escalationExpiresAt: null })
    } catch {}
  }
  const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  res.cookies.set(VISITOR_COOKIE, '', cookieOpts(0))
  return res
}
