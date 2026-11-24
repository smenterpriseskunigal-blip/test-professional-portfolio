import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { serializeSession, sweepExpiredEscalations } from '@/lib/chat-hub'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  await sweepExpiredEscalations()

  const [sessions, unanswered] = await Promise.all([
    db.visitorSession.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        unansweredQuestions: { orderBy: { createdAt: 'desc' } },
      },
    }),
    db.unansweredQuestion.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { session: true },
    }),
  ])

  return NextResponse.json(
    {
      sessions: sessions.map(serializeSession),
      unanswered: unanswered.map((q: any) => ({
        ...q,
        createdAt: new Date(q.createdAt).toISOString(),
        updatedAt: new Date(q.updatedAt).toISOString(),
        session: serializeSession(q.session),
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
