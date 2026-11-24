import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { originOk, readJson } from '@/lib/security'
import { adminChatActionSchema, adminReplySchema, firstError } from '@/lib/validate'
import { broadcastSession, cancelEscalationTimer, serializeSession } from '@/lib/chat-hub'

export const runtime = 'nodejs'

const no = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdmin(req))) return no('Unauthorized', 401)
  if (!originOk(req)) return no('Forbidden', 403)

  const b = await readJson(req, 4 * 1024)
  if (!b.ok) return no(b.error || 'Bad request', b.status || 400)

  const parsed = adminChatActionSchema.safeParse(b.data)
  if (!parsed.success) return no(firstError(parsed.error), 400)

  const session = await db.visitorSession.findUnique({ where: { id: params.id } })
  if (!session) return no('Session not found', 404)

  const action = parsed.data.action
  cancelEscalationTimer(session.id)

  const nextStatus =
    action === 'takeover' ? 'ADMIN_TAKEOVER' : action === 'handback' ? 'AI_ACTIVE' : 'CLOSED'

  const systemText =
    action === 'takeover'
      ? 'Yashwanth has joined the chat and taken over from the AI assistant.'
      : action === 'handback'
        ? 'Yashwanth handed the conversation back to the AI assistant.'
        : 'Chat session closed by Yashwanth.'

  const updated = await db.visitorSession.update({
    where: { id: session.id },
    data: {
      status: nextStatus,
      escalationStartedAt: null,
      escalationExpiresAt: null,
    },
  })

  const sysMsg = await db.chatMessage.create({
    data: {
      sessionId: session.id,
      sender: 'SYSTEM',
      body: systemText,
    },
  })

  const serializedMsg = { ...sysMsg, createdAt: sysMsg.createdAt.toISOString() }
  broadcastSession(session.id, { type: 'message:new', sessionId: session.id, message: serializedMsg })
  broadcastSession(session.id, {
    type: 'session:status',
    sessionId: session.id,
    status: nextStatus,
    escalationExpiresAt: null,
  })

  return NextResponse.json(
    { ok: true, session: serializeSession(updated), message: serializedMsg },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdmin(req))) return no('Unauthorized', 401)
  if (!originOk(req)) return no('Forbidden', 403)

  const b = await readJson(req, 16 * 1024)
  if (!b.ok) return no(b.error || 'Bad request', b.status || 400)

  const parsed = adminReplySchema.safeParse(b.data)
  if (!parsed.success) return no(firstError(parsed.error), 400)

  const session = await db.visitorSession.findUnique({ where: { id: params.id } })
  if (!session) return no('Session not found', 404)
  if (session.status === 'CLOSED') return no('Session is closed', 409)

  // Ensure admin reply automatically claims takeover & cancels any 5-min timer
  cancelEscalationTimer(session.id)
  if (session.status !== 'ADMIN_TAKEOVER') {
    await db.visitorSession.update({
      where: { id: session.id },
      data: {
        status: 'ADMIN_TAKEOVER',
        escalationStartedAt: null,
        escalationExpiresAt: null,
      },
    })
    broadcastSession(session.id, {
      type: 'session:status',
      sessionId: session.id,
      status: 'ADMIN_TAKEOVER',
      escalationExpiresAt: null,
    })
  }

  const msg = await db.chatMessage.create({
    data: {
      sessionId: session.id,
      sender: 'ADMIN',
      body: parsed.data.message,
    },
  })

  const serializedMsg = { ...msg, createdAt: msg.createdAt.toISOString() }
  broadcastSession(session.id, { type: 'message:new', sessionId: session.id, message: serializedMsg })

  return NextResponse.json({ ok: true, message: serializedMsg }, { headers: { 'Cache-Control': 'no-store' } })
}
