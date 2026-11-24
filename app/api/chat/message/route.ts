import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getVisitorSessionId } from '@/lib/auth'
import { clientIp, originOk, readJson, rateLimit } from '@/lib/security'
import { visitorMessageSchema, firstError } from '@/lib/validate'
import { getKbContextForAi } from '@/lib/kb'
import { generateGroundedResponse } from '@/lib/gemini'
import {
  broadcastSession,
  sweepExpiredEscalations,
  triggerOutOfKbEscalation,
} from '@/lib/chat-hub'

export const runtime = 'nodejs'

const err = (error: string, status: number, extra: Record<string, string> = {}) =>
  NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store', ...extra } })

export async function POST(req: NextRequest) {
  if (!originOk(req)) return err('Forbidden', 403)
  const sessionId = await getVisitorSessionId(req)
  if (!sessionId) return err('Verification required before chatting.', 401)

  const ip = clientIp(req)
  const rl = await rateLimit('chat_msg', `${ip}:${sessionId}`, 25, 5 * 60_000)
  if (rl.blocked) return err('Please slow down and try again shortly.', 429, { 'Retry-After': String(rl.retryAfter) })

  const b = await readJson(req, 8 * 1024)
  if (!b.ok) return err(b.error || 'Bad request', b.status || 400)

  const parsed = visitorMessageSchema.safeParse(b.data)
  if (!parsed.success) return err(firstError(parsed.error), 400)

  let session: any
  let serializedVisitorMsg: any
  try {
    await sweepExpiredEscalations(sessionId)

    session = await db.visitorSession.findUnique({ where: { id: sessionId } })
    if (!session || !session.emailVerified) return err('Verified session not found.', 401)
    if (session.status === 'CLOSED') return err('This chat session is closed. Start a new chat to continue.', 409)

    const visitorMsg = await db.chatMessage.create({
      data: {
        sessionId,
        sender: 'VISITOR',
        body: parsed.data.message,
      },
    })
    serializedVisitorMsg = { ...visitorMsg, createdAt: new Date(visitorMsg.createdAt).toISOString() }
    broadcastSession(sessionId, { type: 'message:new', sessionId, message: serializedVisitorMsg })

    // If Yashwanth has taken over or is currently being alerted, AI stays muted
    if (session.status === 'ADMIN_TAKEOVER' || session.status === 'WAITING_FOR_ADMIN') {
      return NextResponse.json(
        { ok: true, mode: session.status, visitorMessage: serializedVisitorMsg, replyMessage: null },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }
  } catch (e) {
    console.error('Chat message DB error:', (e as Error)?.message)
    return err('Could not save your message. Please try again.', 500)
  }

  // AI_ACTIVE: query Gemini strictly grounded on KnowledgeBaseItem
  try {
    const [{ kbContext, customInstructions }, history] = await Promise.all([
      getKbContextForAi(),
      db.chatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        take: 30,
      }),
    ])

    const grounded = await generateGroundedResponse({
      kbContext,
      customInstructions,
      history: history.slice(0, -1).map(m => ({ sender: m.sender, body: m.body })),
      question: parsed.data.message,
      visitorName: session.fullName,
      visitorRole: session.roleType,
    })

    if (grounded.canAnswer) {
      const botMsg = await db.chatMessage.create({
        data: {
          sessionId,
          sender: 'AI',
          body: grounded.answer,
        },
      })
      const serializedBotMsg = { ...botMsg, createdAt: new Date(botMsg.createdAt || Date.now()).toISOString() }
      broadcastSession(sessionId, { type: 'message:new', sessionId, message: serializedBotMsg })
      return NextResponse.json(
        { ok: true, mode: 'AI_ACTIVE', visitorMessage: serializedVisitorMsg, replyMessage: serializedBotMsg },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // Out-of-KB escalation + 5-minute timer
    const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').split(',')[0].trim()
    const proto = (req.headers.get('x-forwarded-proto') || 'https').split(',')[0].trim()
    const adminUrl = host ? `${proto}://${host}/admin/chats` : undefined

    const escalated = await triggerOutOfKbEscalation({
      session,
      questionText: parsed.data.message,
      adminUrl,
    })

    return NextResponse.json(
      {
        ok: true,
        mode: 'WAITING_FOR_ADMIN',
        visitorMessage: serializedVisitorMsg,
        replyMessage: escalated.botMsg,
        escalationExpiresAt: escalated.session.escalationExpiresAt,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    const msg = (e as Error)?.message || ''
    console.error('Chat AI error:', msg)
    if (msg.includes('GEMINI_API_KEY')) {
      return err('AI assistant is not configured yet (missing GEMINI_API_KEY).', 503)
    }
    if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || msg.includes('403')) {
      return err('AI assistant API key was rejected. Please check the GEMINI_API_KEY environment variable.', 502)
    }
    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
      return err('AI assistant quota exceeded. Please try again shortly.', 429)
    }
    if (msg.includes('timed out')) {
      return err('AI assistant timed out while responding. Please try again.', 504)
    }
    return err('AI assistant failed to respond. Please try again in a moment.', 502)
  }
}
