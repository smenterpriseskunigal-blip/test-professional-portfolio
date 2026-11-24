import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { serializeSession, sweepExpiredEscalations } from '@/lib/chat-hub'
import AdminChatsMonitor from '@/components/AdminChatsMonitor'

export const dynamic = 'force-dynamic'

export default async function AdminChatsPage() {
  if (!(await isAdmin())) redirect('/adminlogin?next=/admin/chats')

  await sweepExpiredEscalations()
  const [sessions, unanswered, kbItems] = await Promise.all([
    db.visitorSession.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    }),
    db.unansweredQuestion.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { session: true },
    }),
    db.knowledgeBaseItem.findMany({
      orderBy: [{ category: 'asc' }, { updatedAt: 'desc' }],
    }),
  ])

  return (
    <AdminChatsMonitor
      initialSessions={sessions.map(serializeSession)}
      initialUnanswered={unanswered.map((q: any) => ({
        ...q,
        createdAt: new Date(q.createdAt).toISOString(),
        updatedAt: new Date(q.updatedAt).toISOString(),
        session: serializeSession(q.session),
      }))}
      initialKb={kbItems.map((k: any) => ({
        ...k,
        createdAt: new Date(k.createdAt).toISOString(),
        updatedAt: new Date(k.updatedAt).toISOString(),
      }))}
    />
  )
}
