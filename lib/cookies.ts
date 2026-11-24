// Shared cookie options. SameSite=Lax is correct for a same-origin site (the old "none" was only needed for an iframe preview).
export const cookieOpts = (maxAgeSeconds: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: maxAgeSeconds,
})
