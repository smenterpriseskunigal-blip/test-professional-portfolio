// /adminlogin is deliberately NOT listed here (listing it would advertise the path). It is protected by login and sent with "X-Robots-Tag: noindex".
export default function robots() { return { rules: { userAgent: '*', allow: '/', disallow: ['/api/'] }, sitemap: 'https://yashwanthgowdam.in/sitemap.xml', host: 'https://yashwanthgowdam.in' } }
