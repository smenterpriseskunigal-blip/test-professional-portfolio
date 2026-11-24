import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { getContent, lines, csv, stripMarks } from '@/lib/data'
import { clientIp, rateLimit } from '@/lib/security'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const s = StyleSheet.create({ page: { padding: 50, fontFamily: 'Helvetica', fontSize: 10.5, lineHeight: 1.35 }, name: { fontSize: 18, fontFamily: 'Helvetica-Bold' }, h: { fontSize: 12.5, fontFamily: 'Helvetica-Bold', marginTop: 12, marginBottom: 3 }, b: { fontFamily: 'Helvetica-Bold' }, gap: { marginBottom: 5 } })
const H = ({ t }: { t: string }) => <Text style={s.h}>{t}</Text>
export async function GET(req: Request) {
  const rl = await rateLimit('resume', clientIp(req), 10, 15 * 60_000) // PDF rendering is CPU-heavy: 10 / 15 min / IP
  if (rl.blocked) return Response.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })
  const view = new URL(req.url).searchParams.get('view')
  const c = stripMarks(await getContent()), p = c.profile
  const first = String(p.summary || '').split(/\n\s*\n/)[0].trim(), sen = first.match(/[^.!?]+[.!?]+(\s|$)/g)
  const summary = first.length > 450 && sen ? sen.slice(0, 3).join('').trim() : first
  const contact = [p.email, p.phone, p.location, p.linkedin, p.github].filter(Boolean).join(' | ')
  const doc = (<Document title={`${p.name} – Resume`} author={p.name} language="en-US"><Page size="A4" style={s.page}>
    <Text style={s.name}>{p.name}</Text><Text>{p.headline}</Text><Text>{contact}</Text>
    {summary ? <><H t="Summary" /><Text>{summary}</Text></> : null}
    {c.skills.length ? <><H t="Skills" />{c.skills.map((k: any, i: number) => <Text key={i}>{k.category}: {csv(k.items).join(', ')}</Text>)}</> : null}
    {c.experience.length ? <><H t="Work Experience" />{c.experience.map((e: any, i: number) => <View key={i} style={s.gap}><Text style={s.b}>{e.role}, {e.company}</Text><Text>{e.dates}</Text>{lines(e.bullets).map((b, j) => <Text key={j}>- {b}</Text>)}{e.tech ? <Text>Technologies: {csv(e.tech).join(', ')}</Text> : null}</View>)}</> : null}
    {c.projects.length ? <><H t="Projects" />{c.projects.map((x: any, i: number) => <View key={i} style={s.gap}><Text style={s.b}>{x.name}</Text><Text>{x.summary}{x.tech ? ` Technologies: ${csv(x.tech).join(', ')}.` : ''}</Text></View>)}</> : null}
    {c.education.length ? <><H t="Education" />{c.education.map((e: any, i: number) => <Text key={i}>{e.degree}, {e.school}, {e.years}</Text>)}</> : null}
    {c.certifications.length ? <><H t="Certifications" />{c.certifications.map((e: any, i: number) => <Text key={i}>{e.name}, {e.issuer}, {e.date}</Text>)}</> : null}
    {c.achievements.length ? <><H t="Achievements" />{c.achievements.map((e: any, i: number) => <Text key={i}>- {e.title}: {e.detail}</Text>)}</> : null}
    {c.volunteering.length ? <><H t="Volunteering" />{c.volunteering.map((e: any, i: number) => <Text key={i}>- {e.role}, {e.org}: {e.detail}</Text>)}</> : null}
  </Page></Document>)
  const buf = await renderToBuffer(doc)
  return new Response(buf as any, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `${view ? 'inline' : 'attachment'}; filename="Yashwanth_Gowda_M_Resume.pdf"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' } })
}
