import './globals.css'
import './hero.css'
import './sections.css'
import './chat.css'
import type { Metadata, Viewport } from 'next'
const SITE = 'https://yashwanthgowdam.in'
const TITLE = 'Yashwanth Gowda M – DevOps, Cloud and Kubernetes Engineer'
const DESC = 'Portfolio of Yashwanth Gowda M, a DevOps, cloud and Kubernetes engineer building and operating Amazon EKS platforms, CI/CD pipelines and cloud-native infrastructure on AWS.'
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: '%s | Yashwanth Gowda M' },
  description: DESC,
  applicationName: 'Yashwanth Gowda M – Portfolio',
  authors: [{ name: 'Yashwanth Gowda M', url: SITE }],
  keywords: ['DevOps engineer', 'Kubernetes engineer', 'Amazon EKS', 'AWS', 'CI/CD', 'Terraform', 'Helm', 'Docker', 'Yashwanth Gowda M', 'portfolio'],
  alternates: { canonical: '/' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  openGraph: { type: 'website', url: SITE, siteName: 'Yashwanth Gowda M', title: TITLE, description: DESC, locale: 'en_IN' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet" />
  </head><body>{children}</body></html>)
}
