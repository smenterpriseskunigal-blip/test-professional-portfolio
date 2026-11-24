// READ-ONLY database check. Runs SELECT queries only: it never inserts, updates, deletes or alters anything.
//   npm run db:check
import { PrismaClient } from '@prisma/client'

const EXPECTED = {
  Content: 'content', Message: 'message', RateLimit: 'rateLimit', VisitorSession: 'visitorSession',
  OtpVerification: 'otpVerification', ChatMessage: 'chatMessage', KnowledgeBaseItem: 'knowledgeBaseItem', UnansweredQuestion: 'unansweredQuestion',
}
const url = process.env.DATABASE_URL || ''
if (!url) { console.error('DATABASE_URL is not set (put it in .env).'); process.exit(1) }

const u = (() => { try { return new URL(url) } catch { return null } })()
console.log('— Connection settings')
if (!u) console.log('  ✗ DATABASE_URL is not a valid URL (special characters in the password must be URL-encoded)')
else {
  console.log(`  host: ${u.hostname}  port: ${u.port || '5432'}  user: ${u.username}`)
  if (/^db\.[a-z0-9]+\.supabase\.co$/.test(u.hostname)) console.log('  ✗ Direct host db.<ref>.supabase.co is IPv6-only and fails on most hosts. Use the pooler host (…pooler.supabase.com).')
  if (u.port === '6543' && u.searchParams.get('pgbouncer') !== 'true') console.log('  ✗ Port 6543 (transaction pooler) needs ?pgbouncer=true&connection_limit=1')
  if (u.port === '6543' && !u.username.includes('.')) console.log('  ✗ Pooler user must be postgres.<project-ref>, not plain "postgres"')
}

const db = new PrismaClient({ log: ['error'] })
try {
  await db.$queryRaw`SELECT 1`
  console.log('\n— Connected ✓')

  const rows = await db.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1`
  const present = rows.map(r => r.table_name)
  console.log('\n— Tables in schema "public"')
  for (const t of present) console.log(`  ${Object.keys(EXPECTED).includes(t) ? '✓ used by app ' : '? NOT used   '} ${t}`)
  const missing = Object.keys(EXPECTED).filter(t => !present.includes(t))
  if (missing.length) console.log(`  ✗ missing (the app expects them): ${missing.join(', ')}`)

  console.log('\n— Row counts & column check (SELECT only)')
  for (const [table, model] of Object.entries(EXPECTED)) {
    if (!present.includes(table)) continue
    try {
      await db[model].findFirst()
      const [{ n }] = await db.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${table}"`)
      console.log(`  ✓ ${table}: ${n} rows`)
    } catch (e) {
      console.log(`  ✗ ${table}: ${String(e.message).split('\n').filter(Boolean).pop()}`)
    }
  }
  if (present.includes('Content')) {
    const keys = await db.content.findMany({ select: { key: true } })
    console.log(`\n— "Content" keys found: ${keys.map(k => k.key).join(', ') || '(none)'}`)
  }
} catch (e) {
  console.log('\n— Connection FAILED ✗')
  console.log(' ', String(e.message).split('\n').filter(Boolean).slice(-3).join('\n  '))
  process.exitCode = 1
} finally {
  await db.$disconnect()
}
