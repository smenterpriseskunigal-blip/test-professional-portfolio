import { z } from 'zod'
import { SECTIONS, F } from './schema'
import { cleanText, stripTags } from './security'
import { safeUrl, safeImg } from './safe'

const MAX_LINE = 300, MAX_URL = 500, MAX_AREA = 4000, MAX_ITEMS = 100

const field = (f: F) => {
  const max = f.area ? MAX_AREA : f.t === 'url' || f.t === 'photo' ? MAX_URL : MAX_LINE
  let s: z.ZodTypeAny = z.string().max(max, `${f.l}: max ${max} characters`).transform(v => cleanText(v, !!f.area))
  if (f.t === 'url') s = s.refine(v => v === '' || !!safeUrl(v), `${f.l}: must start with https://`)
  if (f.t === 'photo') s = s.refine(v => v === '' || !!safeImg(v), `${f.l}: use /file.jpg or an https:// URL`)
  if (f.t === 'email') s = s.refine(v => v === '' || z.string().email().safeParse(v).success, `${f.l}: not a valid email`)
  if (f.t === 'phone') s = s.refine(v => /^[0-9 +()\-.]{0,30}$/.test(v), `${f.l}: digits, spaces and + ( ) - . only`)
  return s.default('')
}
const shape = (key: string) => Object.fromEntries(SECTIONS[key].fields.map(f => [f.k, field(f)]))
export const sectionSchema = (key: string) => {
  const obj = z.object(shape(key))
  return SECTIONS[key].single ? obj : z.array(obj.extend({ hidden: z.boolean().optional() })).max(MAX_ITEMS, `Max ${MAX_ITEMS} entries`)
}
export const firstError = (e: z.ZodError) => { const i = e.issues[0]; return (i.path.length ? i.path.join(' > ') + ': ' : '') + i.message }

// ---------- public contact form ----------
export const contactSchema = z.object({
  name: z.string().max(100).transform(v => stripTags(cleanText(v))).pipe(z.string().min(1).max(100)),
  email: z.string().max(150).transform(v => cleanText(v)).pipe(z.string().email().max(150)),
  body: z.string().max(2000).transform(v => stripTags(cleanText(v, true))).pipe(z.string().min(2).max(2000)),
  website: z.string().max(200).optional(),                 // honeypot: real people leave it empty
})

// ---------- visitor chat & identity verification ----------
export const ROLE_TYPES = ['HR', 'Consultancy', 'Hiring Manager', 'Visitor', 'Other'] as const
export const PROFILE_SOURCES = ['Social Forward', 'Reference', 'Naukri', 'LinkedIn', 'Other'] as const

export const otpSendSchema = z.object({
  fullName: z.string().max(100).transform(v => stripTags(cleanText(v))).pipe(z.string().min(2, 'Full name is required').max(100)),
  roleType: z.string().max(60).transform(v => stripTags(cleanText(v))).pipe(z.string().min(2, 'Please select who you are').max(60)),
  source: z.string().max(60).transform(v => stripTags(cleanText(v))).pipe(z.string().min(2, 'Please select how you found my profile').max(60)),
  countryCode: z.string().max(8).transform(v => cleanText(v)).pipe(z.string().regex(/^\+\d{1,4}$/, 'Invalid country code')).default('+91'),
  mobile: z.string().max(20).transform(v => cleanText(v).replace(/[\s\-()]/g, '')).pipe(z.string().regex(/^\d{6,15}$/, 'Enter a valid mobile number (6–15 digits)')),
  email: z.string().max(150).transform(v => cleanText(v).toLowerCase()).pipe(z.string().email('Enter a valid company email address').max(150)),
})

export const otpVerifySchema = otpSendSchema.extend({
  otp: z.string().max(10).transform(v => cleanText(v)).pipe(z.string().regex(/^\d{6}$/, 'Enter the 6-digit verification code')),
})

export const visitorMessageSchema = z.object({
  message: z.string().max(2000).transform(v => stripTags(cleanText(v, true))).pipe(z.string().min(1, 'Message cannot be empty').max(2000)),
})

export const adminReplySchema = z.object({
  message: z.string().max(4000).transform(v => cleanText(v, true)).pipe(z.string().min(1, 'Reply cannot be empty').max(4000)),
})

export const adminChatActionSchema = z.object({
  action: z.enum(['takeover', 'handback', 'close']),
})

export const kbItemSchema = z.object({
  category: z.enum(['QA', 'BIODATA', 'EXPERIENCE', 'LOCATION', 'INSTRUCTIONS']),
  title: z.string().max(300).transform(v => cleanText(v)).pipe(z.string().min(2, 'Title is required').max(300)),
  content: z.string().max(6000).transform(v => cleanText(v, true)).pipe(z.string().min(2, 'Content is required').max(6000)),
  tags: z.string().max(300).transform(v => cleanText(v)).default(''),
  active: z.boolean().default(true),
})

export const resolveUnansweredSchema = z.object({
  action: z.enum(['add_to_kb', 'dismiss']),
  category: z.enum(['QA', 'BIODATA', 'EXPERIENCE', 'LOCATION', 'INSTRUCTIONS']).optional(),
  title: z.string().max(300).transform(v => cleanText(v)).optional(),
  answer: z.string().max(6000).transform(v => cleanText(v, true)).optional(),
  tags: z.string().max(300).transform(v => cleanText(v)).optional(),
})

