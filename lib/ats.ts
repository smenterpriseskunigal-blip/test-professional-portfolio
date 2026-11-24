import { lines, csv, stripMarks } from './data'
const VERBS = /^(built|led|designed|implemented|upgraded|automated|migrated|reduced|improved|deployed|managed|created|developed|configured|optimized|operated|launched|delivered|owned|secured|integrated)/i
export function atsScore(raw: Record<string, any>, jd = '') {
  const c = stripMarks(raw)
  const p = c.profile || {}, parts: { name: string; got: number; max: number }[] = [], fixes: string[] = []
  parts.push({ name: 'Parsability (single column, real text)', got: 25, max: 25 })
  const need = ['summary', 'skills', 'experience', 'education', 'projects']
  const have = need.filter(k => (k === 'summary' ? p.summary : (c[k] || []).length))
  need.filter(k => !have.includes(k)).forEach(k => fixes.push(`Add content for "${k}"`))
  parts.push({ name: 'Standard headings', got: Math.round(15 * have.length / need.length), max: 15 })
  const ct = ['name', 'email', 'phone', 'location', 'linkedin'].filter(k => p[k])
  ;['name', 'email', 'phone', 'location', 'linkedin'].filter(k => !p[k]).forEach(k => fixes.push(`Fill profile ${k}`))
  parts.push({ name: 'Contact details', got: ct.length * 2, max: 10 })
  const text = JSON.stringify(c).toLowerCase(); let kw: number
  if (jd.trim()) {
    const words = [...new Set(jd.toLowerCase().match(/[a-z][a-z0-9+#.\/-]{2,}/g) || [])].filter(w => !STOP.has(w))
    const miss = words.filter(w => !text.includes(w)); kw = Math.round(30 * (1 - miss.length / Math.max(words.length, 1)))
    if (miss.length) fixes.push('Missing keywords: ' + miss.slice(0, 15).join(', '))
  } else { const n = (c.skills || []).flatMap((s: any) => csv(s.items)).length; kw = Math.min(30, n * 3); if (n < 10) fixes.push('List at least 10 skills (or paste a job description to check keywords)') }
  parts.push({ name: 'Keyword coverage', got: kw, max: 30 })
  const b = (c.experience || []).flatMap((e: any) => lines(e.bullets))
  const v = b.filter((x: string) => VERBS.test(x)).length, q = b.filter((x: string) => /\d/.test(x)).length
  if (b.length && v < b.length) fixes.push('Start every achievement with an action verb')
  if (b.length && q < b.length / 2) fixes.push('Add numbers to at least half of your achievements')
  parts.push({ name: 'Action verbs and numbers', got: b.length ? Math.round(5 * v / b.length + 5 * Math.min(1, q / (b.length / 2))) : 0, max: 10 })
  const ds = (c.experience || []).map((e: any) => e.dates || ''), okd = ds.filter((d: string) => /^[A-Z][a-z]{2} \d{4} – ([A-Z][a-z]{2} \d{4}|Present)$/.test(d)).length
  if (ds.length && okd < ds.length) fixes.push('Use the date format "Mon YYYY – Mon YYYY" or "– Present"')
  parts.push({ name: 'Dates and formatting', got: ds.length ? Math.round(10 * okd / ds.length) : 0, max: 10 })
  return { score: parts.reduce((a, x) => a + x.got, 0), parts, fixes, note: 'Internal estimate. Real ATS products differ.' }
}
const STOP = new Set('the and for with you our are will have has from that this your who all can not but any use using work years year experience ability strong team role job'.split(' '))
