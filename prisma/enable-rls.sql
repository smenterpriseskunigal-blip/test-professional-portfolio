-- OPTIONAL, run manually in the Supabase SQL editor after reviewing. Changes NO tables, columns or data.
-- Purpose: Supabase exposes every table in "public" through its public REST API (anon key). Turning on
-- Row Level Security with no policies blocks that API completely. The app is unaffected because Prisma
-- connects with the database owner role (postgres), which bypasses RLS.
ALTER TABLE IF EXISTS "Content"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Message"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "RateLimit"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "VisitorSession"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "OtpVerification"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "ChatMessage"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "KnowledgeBaseItem"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "UnansweredQuestion" ENABLE ROW LEVEL SECURITY;

-- Verify: every row should show rowsecurity = true
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;
