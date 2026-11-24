const dev = process.env.NODE_ENV !== 'production'
// Content-Security-Policy. 'unsafe-inline' is needed because Next.js statically rendered pages use inline bootstrap scripts
// (a per-request nonce would force every page to be dynamic). 'unsafe-eval' is dev-only.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(dev ? [] : ['upgrade-insecure-requests']),
].join('; ')
const sec = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
]
module.exports = {
  output: 'standalone',
  poweredByHeader: false,
  experimental: { serverComponentsExternalPackages: ['@react-pdf/renderer'] },
  async headers() {
    return [
      { source: '/(.*)', headers: sec },
      { source: '/adminlogin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'no-store' }] },
      { source: '/api/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ]
  },
}
