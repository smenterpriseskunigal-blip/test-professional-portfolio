# Yashwanth Gowda M – Portfolio

Next.js 14 (App Router) · Prisma · existing Supabase PostgreSQL · Resend Email OTP · Gemini-powered chat assistant.
Public site `/`, admin `/adminlogin`, live chat monitor `/admin/chats`, PDF resume `/api/resume`.

## Setup
1. `npm install`
2. `cp .env.example .env` and fill it in (see comments inside). `AUTH_SECRET`: `openssl rand -base64 32`. Admin hash: `npm run hash -- "password"` (escape each `$` as `\$`). Admin username: `admin`.
3. Check the database connection **without changing anything**: `npm run db:check`
4. `npm run dev`

## Database rules
- The app uses the **existing** Supabase database. There is no `db push`, seed or migration script. The app never creates or alters tables.
- `DATABASE_URL` = Supabase pooler, port 6543, with `?pgbouncer=true&connection_limit=1`. `DIRECT_URL` = pooler session mode, port 5432 (Prisma CLI only).
- Never use `db.<ref>.supabase.co`: it is IPv6-only and fails on Vercel and most VMs.
- `npm run db:check` lists tables, flags any not used by the app, and counts rows (SELECT only).
- `npm run db:diff` prints (does not run) the SQL that would make the DB match `prisma/schema.prisma`. Empty output means they already match.
- Optional hardening: review and run `prisma/enable-rls.sql` once in the Supabase SQL editor.

## Deploy
Set the same variables from `.env.example` on the host. `output: 'standalone'` is enabled (Docker / VM friendly).
Live chat updates use in-process Server-Sent Events, so run **one long-lived instance** (VM / Docker / `next start`). On multi-instance serverless hosting, updates may arrive late (the 5-minute escalation fallback is re-checked on every request).
