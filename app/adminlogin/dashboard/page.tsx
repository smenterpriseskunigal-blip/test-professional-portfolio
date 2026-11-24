import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/auth'
import { getContent } from '@/lib/data'
import { db } from '@/lib/db'
import Editor from './Editor'
export const dynamic = 'force-dynamic'
export default async function Dashboard() {
  if (!(await isAdmin())) redirect('/adminlogin')
  const content = await getContent(true)
  const rows = await db.message.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
  const messages = rows.map(m => ({ ...m, createdAt: m.createdAt.toISOString() }))
  return <Editor initial={content} messages={messages} />
}
