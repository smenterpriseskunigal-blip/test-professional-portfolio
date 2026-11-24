import { NextRequest, NextResponse } from 'next/server'
import { COOKIE, verifySession } from '@/lib/session'

// Defence in depth: the JWT is validated at the edge before any admin page / API runs.
// Every handler also re-checks via isAdmin(). If AUTH_SECRET is missing, verification fails and access is denied (fail closed).
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname === '/api/admin/login' || pathname === '/api/admin/logout') return NextResponse.next()
  if (await verifySession(req.cookies.get(COOKIE)?.value)) return NextResponse.next()
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  const loginUrl = new URL('/adminlogin', req.url)
  loginUrl.searchParams.set('next', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/admin/:path*', '/adminlogin/dashboard/:path*', '/api/admin/:path*'],
}
