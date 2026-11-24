import { isAdmin } from '@/lib/auth'
import { subscribeAdmin } from '@/lib/chat-hub'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await isAdmin())) {
    return new Response('Unauthorized', { status: 401 })
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

      send('connected', { ok: true, ts: new Date().toISOString() })

      const unsubscribe = subscribeAdmin(ev => {
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
