import { db } from './db'
import { sendAdminEscalationEmail } from './notify'

export const ESCALATION_TIMEOUT_MS = 5 * 60 * 1000

export const OUT_OF_KB_MESSAGE =
  "That's outside my current knowledge base. Let me notify Yashwanth about this—please wait for a little while."

export const FALLBACK_AWAY_MESSAGE =
  'It seems Yashwanth is currently away or busy with work. Please use the Contact form on this site to leave a message for him.'

export type HubEvent =
  | { type: 'session:verified'; session: any }
  | { type: 'session:status'; sessionId: string; status: string; escalationExpiresAt?: string | null }
  | { type: 'message:new'; sessionId: string; message: any }
  | { type: 'escalation:triggered'; session: any; question: any }
  | { type: 'unanswered:updated'; question: any }

type Listener = (ev: HubEvent) => void

const g = globalThis as any
const hub = g.__chatHub || (g.__chatHub = {
  adminListeners: new Set<Listener>(),
  sessionListeners: new Map<string, Set<Listener>>(),
  timers: new Map<string, ReturnType<typeof setTimeout>>(),
})

export function subscribeAdmin(fn: Listener): () => void {
  hub.adminListeners.add(fn)
  return () => hub.adminListeners.delete(fn)
}

export function subscribeSession(sessionId: string, fn: Listener): () => void {
  let set = hub.sessionListeners.get(sessionId)
  if (!set) {
    set = new Set<Listener>()
    hub.sessionListeners.set(sessionId, set)
  }
  set.add(fn)
  return () => {
    set?.delete(fn)
    if (set && set.size === 0) hub.sessionListeners.delete(sessionId)
  }
}

export function broadcastAdmin(ev: HubEvent) {
  for (const fn of hub.adminListeners) {
    try { fn(ev) } catch {}
  }
}

export function broadcastSession(sessionId: string, ev: HubEvent) {
  const set = hub.sessionListeners.get(sessionId)
  if (set) {
    for (const fn of set) {
      try { fn(ev) } catch {}
    }
  }
  broadcastAdmin(ev)
}

export function cancelEscalationTimer(sessionId: string) {
  const existing = hub.timers.get(sessionId)
  if (existing) {
    clearTimeout(existing)
    hub.timers.delete(sessionId)
  }
}

export function scheduleEscalationTimer(sessionId: string, expiresAt: Date) {
  cancelEscalationTimer(sessionId)
  const delay = Math.max(1000, expiresAt.getTime() - Date.now())
  const timer = setTimeout(() => {
    hub.timers.delete(sessionId)
    expireEscalation(sessionId).catch(err =>
      console.error('Escalation timeout error:', (err as Error)?.message)
    )
  }, delay)
  if (typeof (timer as any).unref === 'function') (timer as any).unref()
  hub.timers.set(sessionId, timer)
}

export async function expireEscalation(sessionId: string): Promise<boolean> {
  cancelEscalationTimer(sessionId)
  const session = await db.visitorSession.findUnique({ where: { id: sessionId } })
  if (!session || session.status !== 'WAITING_FOR_ADMIN') return false

  const res = await db.visitorSession.updateMany({
    where: { id: sessionId, status: 'WAITING_FOR_ADMIN' },
    data: {
      status: 'AI_ACTIVE',
      escalationStartedAt: null,
      escalationExpiresAt: null,
    },
  })
  if (res.count === 0) return false

  const msg = await db.chatMessage.create({
    data: {
      sessionId,
      sender: 'SYSTEM',
      body: FALLBACK_AWAY_MESSAGE,
      meta: { fallbackContact: true },
    },
  })

  const serializedMsg = { ...msg, createdAt: safeIso(msg.createdAt, true) as string }
  broadcastSession(sessionId, { type: 'message:new', sessionId, message: serializedMsg })
  broadcastSession(sessionId, {
    type: 'session:status',
    sessionId,
    status: 'AI_ACTIVE',
    escalationExpiresAt: null,
  })
  return true
}

export async function sweepExpiredEscalations(sessionId?: string): Promise<void> {
  try {
    const now = new Date()
    const expired = await db.visitorSession.findMany({
      where: {
        ...(sessionId ? { id: sessionId } : {}),
        status: 'WAITING_FOR_ADMIN',
        escalationExpiresAt: { lte: now },
      },
    })
    for (const s of expired) {
      await expireEscalation(s.id)
    }
  } catch (e) {
    console.error('sweepExpiredEscalations error:', (e as Error)?.message)
  }
}

export async function triggerOutOfKbEscalation(params: {
  session: any
  questionText: string
  adminUrl?: string
}) {
  const { session, questionText, adminUrl } = params
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ESCALATION_TIMEOUT_MS)

  const updated = await db.visitorSession.update({
    where: { id: session.id },
    data: {
      status: 'WAITING_FOR_ADMIN',
      escalationStartedAt: now,
      escalationExpiresAt: expiresAt,
    },
  })

  const unanswered = await db.unansweredQuestion.create({
    data: {
      sessionId: session.id,
      question: questionText,
      status: 'PENDING',
    },
  })

  const botMsg = await db.chatMessage.create({
    data: {
      sessionId: session.id,
      sender: 'AI',
      body: OUT_OF_KB_MESSAGE,
      meta: { outOfKb: true, unansweredId: unanswered.id },
    },
  })

  scheduleEscalationTimer(session.id, expiresAt)

  const serializedMsg = { ...botMsg, createdAt: new Date(botMsg.createdAt).toISOString() }
  const serializedSession = serializeSession(updated)
  const serializedUnanswered = {
    ...unanswered,
    createdAt: new Date(unanswered.createdAt).toISOString(),
    updatedAt: new Date(unanswered.updatedAt).toISOString(),
    session: serializedSession,
  }

  broadcastSession(session.id, { type: 'message:new', sessionId: session.id, message: serializedMsg })
  broadcastSession(session.id, {
    type: 'session:status',
    sessionId: session.id,
    status: 'WAITING_FOR_ADMIN',
    escalationExpiresAt: expiresAt.toISOString(),
  })
  broadcastAdmin({
    type: 'escalation:triggered',
    session: serializedSession,
    question: serializedUnanswered,
  })

  try {
    await sendAdminEscalationEmail({
      session: updated,
      questionText,
      adminUrl,
    })
  } catch (e) {
    console.error('Admin escalation email alert error:', (e as Error)?.message)
  }

  return { botMsg: serializedMsg, unanswered: serializedUnanswered, session: serializedSession }
}

function safeIso(v: unknown, fallbackNow = false): string | null {
  if (!v) return fallbackNow ? new Date().toISOString() : null
  const d = v instanceof Date ? v : new Date(String(v))
  if (Number.isNaN(d.getTime())) return fallbackNow ? new Date().toISOString() : null
  return d.toISOString()
}

export function serializeSession(s: any) {
  if (!s) return null
  return {
    ...s,
    escalationStartedAt: safeIso(s.escalationStartedAt, false),
    escalationExpiresAt: safeIso(s.escalationExpiresAt, false),
    createdAt: safeIso(s.createdAt, true) as string,
    updatedAt: safeIso(s.updatedAt, true) as string,
    messages: Array.isArray(s.messages)
      ? s.messages.map((m: any) => ({ ...m, createdAt: safeIso(m.createdAt, true) as string }))
      : undefined,
    unansweredQuestions: Array.isArray(s.unansweredQuestions)
      ? s.unansweredQuestions.map((q: any) => ({
          ...q,
          createdAt: safeIso(q.createdAt, true) as string,
          updatedAt: safeIso(q.updatedAt, true) as string,
        }))
      : undefined,
  }
}
