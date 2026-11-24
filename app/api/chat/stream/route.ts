import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getVisitorSessionId } from '@/lib/auth'
import { serializeSession, subscribeSession, sweepExpiredEscalations } from '@/lib/chat-hub'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sessionId = await getVisitorSessionId(req)
  if (!sessionId) {
    return new Response('Unauthorized', { status: 401 })
  }

  await sweepExpiredEscalations(sessionId)
  const session = await db.visitorSession.findUnique({
    where: { id: sessionId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })
  if (!session) {
    return new Response('Not found', { status: 404 })
  }

  const encoder = new TextEncoder()
  let cleanup = () => {}

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      const serialized = serializeSession(session)
      send('init', { session: serialized, messages: serialized.messages || [] })

      const unsubscribe = subscribeSession(sessionId, ev => {
        send(ev.type, ev)
      })

      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`))
        } catch {}
      }, 15_000)

      cleanup = () => {
        clearInterval(ping)
        unsubscribe()
      }
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
