import { getContent, lines, csv } from '@/lib/data'
import Blueprint from '@/components/Blueprint'
import Typed from '@/components/Typed'
import ScrollSpy from '@/components/ScrollSpy'
import ThemeToggle from '@/components/ThemeToggle'
import ContactForm from '@/components/ContactForm'
import CountUp from '@/components/CountUp'
import ProjectCards from '@/components/ProjectCards'
import ChatWidget from '@/components/ChatWidget'
import { Rich } from '@/lib/rich'
import { safeUrl, safeImg, safeEmail, jsonLd } from '@/lib/safe'
export const dynamic = 'force-dynamic'
const Tags = ({ v }: { v: string }) => <div className="tags">{csv(v).map(t => <span key={t}>{t}</span>)}</div>
const NAV = [['home', 'Home'], ['about', 'About'], ['experience', 'Experience'], ['skills', 'Skills'], ['projects', 'Projects'], ['education', 'Education'], ['certifications', 'Certifications'], ['contact', 'Contact']]
const ICONS = ['M3 8h18v11H3zM9 8V6h6v2M3 13h18', 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5', 'M7 18a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.2A3.5 3.5 0 0 1 17 18z', 'M8 8l-5 4 5 4M16 8l5 4-5 4M14 5l-4 14']
const I = {
  mail: 'M3 6h18v12H3zM3 7l9 7 9-7',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  pin: 'M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  li: 'M4 9h4v11H4zM6 4.5v.01M10 9h4v1.5c.8-1.2 2-1.8 3.5-1.8 3 0 3.5 2 3.5 4.5V20h-4v-6c0-1.2-.3-2-1.5-2s-1.5.9-1.5 2v6h-4z',
  gh: 'M9 19c-4 1.3-4-2-6-2.5M15 21v-3.2a2.8 2.8 0 0 0-.8-2.2c2.6-.3 5.3-1.3 5.3-5.8a4.5 4.5 0 0 0-1.2-3.1 4.2 4.2 0 0 0-.1-3.1s-1-.3-3.2 1.2a11 11 0 0 0-5.8 0C7.1 3.4 6.1 3.7 6.1 3.7a4.2 4.2 0 0 0-.1 3.1A4.5 4.5 0 0 0 4.8 9.9c0 4.5 2.7 5.5 5.3 5.8a2.8 2.8 0 0 0-.8 2.2V21',
  cap: 'M2 9l10-5 10 5-10 5zM6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5',
  medal: 'M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM8.5 13.5L7 21l5-3 5 3-1.5-7.5',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
}
const Svg = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>
const sentences = (s = '') => (s.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+(\s|$)/g) || (s.trim() ? [s.trim()] : [])).map(x => x.trim())
type Blk = { title: string; text: string }
const guess = (t: string) => /^my goal|goal is/i.test(t) ? 'My goal' : /expertise|skills|spans/i.test(t.slice(0, 60)) ? 'Expertise' : /beyond|outside|hobb|open-source|practical tools/i.test(t.slice(0, 60)) ? 'Beyond work' : /over the years|worked|experience/i.test(t.slice(0, 40)) ? 'Experience' : 'More about me'
// Summary format: first paragraph = intro. A line "# Title" starts a titled card. Untitled extra paragraphs get a title guessed from their wording.
function parseAbout(summary: string): { intro: string; blocks: Blk[] } {
  const raw = summary.replace(/\r/g, '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean)
  if (raw.length === 1 && !raw[0].startsWith('#')) {
    const sen = sentences(raw[0]), blocks: Blk[] = []
    for (let i = 2; i < sen.length; i += 3) { const t = sen.slice(i, i + 3).join(' '); blocks.push({ title: guess(t), text: t }) }
    return { intro: sen.slice(0, 2).join(' '), blocks }
  }
  let intro = '', cur: Blk | null = null; const blocks: Blk[] = []
  for (const para of raw) {
    const m = para.match(/^#\s+(.+?)\s*(?:\n([\s\S]*))?$/)
    if (m) { cur = { title: m[1].trim(), text: (m[2] || '').trim() }; blocks.push(cur); continue }
    if (cur) { cur.text += (cur.text ? '\n\n' : '') + para; continue }
    if (!intro) { intro = para; continue }
    blocks.push({ title: guess(para), text: para })
  }
  return { intro, blocks }
}
const iconFor = (t: string) => /goal/i.test(t) ? I.star : /expert|skill/i.test(t) ? ICONS[1] : /experience/i.test(t) ? ICONS[0] : /beyond|work|project/i.test(t) ? ICONS[3] : ICONS[2]
export default async function Home() {
  const c = await getContent(), p = c.profile
  const [first, ...rest] = String(p.name || '').split(' ')
  const ini = String(p.name || '').split(' ').filter(Boolean).map((w: string) => w[0].toUpperCase()).join('')
  const stats = lines(p.stats).map(l => l.split('|')).slice(0, 4)
  const date = new Date().toISOString().slice(0, 10)
  const { intro, blocks } = parseAbout(String(p.summary || ''))
  const goalIdx = blocks.findIndex(b => /goal|mission|vision/i.test(b.title)), goal = goalIdx >= 0 ? blocks[goalIdx] : null
  const cards = blocks.filter((_, i) => i !== goalIdx)
  const gl = goal ? goal.text.split('\n') : [], goalLabel = goal ? (gl.length > 1 ? gl[0].replace(/:\s*$/, '') : goal.title) : '', goalText = goal ? (gl.length > 1 ? gl.slice(1).join('\n').trim() : goal.text) : ''
  const nSkills = c.skills.flatMap((s: any) => csv(s.items)).length
  const counters = [[c.experience.length, 'Roles'], [c.projects.length, 'Projects'], [nSkills, 'Tools & technologies'], [c.certifications.length, 'Certifications']].filter(x => (x[0] as number) > 0)
  const Head = ({ n, t }: { n: string; t: string }) => (<div className="sh"><div className="sheet2"><i>///</i>SHEET {n} / <b>{t.toUpperCase()}</b></div><span className="shl" />
    <div className="stb"><span>TITLE : {t.toUpperCase()}</span><span>SHEET NO. : {n}</span><span>REV : A</span><span>DRAWN BY : {ini}</span><span style={{ gridColumn: '1/-1' }}>DATE : {date}</span></div></div>)
  const li = String(p.linkedin || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), gh = String(p.github || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
  const rows: [string, string, string, string?][] = [['mail', 'Email', safeEmail(p.email) || '', safeEmail(p.email) && `mailto:${safeEmail(p.email)}`], ['phone', 'Phone', p.phone, p.phone && `tel:${String(p.phone).replace(/[^\d+]/g, '')}`], ['pin', 'Location', p.location], ['li', 'LinkedIn', safeUrl(p.linkedin) ? li : '', safeUrl(p.linkedin)], ['gh', 'GitHub', safeUrl(p.github) ? gh : '', safeUrl(p.github)]]
  return (<>
    <ScrollSpy />
    <nav aria-label="Main">
      <a className="brand" href="#home"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4l17 9v18l-17 9-17-9V13z" /><path d="M7 13l17 9 17-9M24 22v18M7 22l17 9 17-9" /></svg><span><b>{p.name}</b><small>DevOps &nbsp;|&nbsp; Cloud &nbsp;|&nbsp; Kubernetes</small></span></a>
      <div className="links">{NAV.map(([i, l]) => <a key={i} href={`#${i}`} className={i === 'home' ? 'on' : ''}>{l}</a>)}</div>
      <ThemeToggle />
    </nav>
    <header className="hero" id="home">
      <i className="reg a" /><i className="reg b" /><i className="reg c" /><i className="reg d" />
      <div className="sheet">SHEET 01 / HERO (PORTFOLIO)</div>
      <div className="copy">
        <p className="kick">&gt;// MY_PORTFOLIO</p>
        <h1>{first}<br />{rest.join(' ')}</h1>
        <p className="role">{p.headline}</p>
        <Typed text={p.tagline || ''} />
        <div className="cta">
          <a className="btn main" href="/api/resume" download><svg viewBox="0 0 24 24"><path d="M12 3v12M7 11l5 5 5-5M4 20h16" /></svg>Download Resume</a>
          <a className="btn" href="#contact"><svg viewBox="0 0 24 24"><path d="M21 3L3 11l7 3 3 7zM10 14l11-11" /></svg>Contact</a>
        </div>
        {stats.length > 0 && <div className="stats">{stats.map(([v, l], i) => <div className="stat" key={i}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[i % 4]} /></svg><b><CountUp value={v} /></b><span>{l}</span></div>)}</div>}
      </div>
      <Blueprint />
      <div className="scale">SCALE &nbsp; 1 : 100<div className="ruler"><span>0</span><span>25</span><span>50</span><span>75</span><span>100 m</span></div></div>
      <div className="tblock">
        <div><small>Project</small>Personal Portfolio – EKS Architecture</div><div><small>Sheet No.</small>01 / 09</div><div><small>Rev.</small>A</div>
        <div><small>Title</small>Hero – Cloud Native Infrastructure</div><div><small>Drawn by</small>{p.name}</div><div><small>Date</small>{date}</div>
      </div>
    </header>

    <section id="about"><Head n="02" t="About" />
      <div className="about">
        <div className="photo" role="img" aria-label={`Portrait of ${p.name}`}><div className="pi">{safeImg(p.photo) ? <img src={safeImg(p.photo)} alt="" width={330} height={412} /> : <span className="mono-g">{ini.slice(0, 2)}</span>}</div></div>
        <div>
          <p className="kick2">— About Me —</p>
          <h2 className="nm">{p.name}</h2>
          <p className="rl">{p.headline}</p>
          <p className="lead"><Rich text={intro} /></p>
          <div className="chips">
            {p.location && <span className="chip"><svg viewBox="0 0 24 24"><path d={I.pin} /></svg>{p.location}</span>}
            {p.availability && <span className="chip"><i />{p.availability}</span>}
          </div>
          {counters.length > 0 && <div className="astats">{counters.map(([n, l], i) => <div className="as" key={i}><b><CountUp value={String(n)} /></b><span>{l}</span></div>)}</div>}
        </div>
      </div>
      {(cards.length > 0 || goal) && <div className="abgrid" style={{ ['--n' as any]: Math.min(cards.length || 1, 3) }}>
        {cards.map((b, i) => <article className="abcard" key={i}><div className="ico"><Svg d={iconFor(b.title)} /></div><h3>{b.title}</h3><p className="pre"><Rich text={b.text} /></p></article>)}
        {goal && <figure className="abquote"><span className="qm" aria-hidden="true">“</span><div><small>{goalLabel}</small><blockquote><Rich text={goalText} /></blockquote></div></figure>}
      </div>}</section>

    <section id="experience"><Head n="03" t="Experience" /><h2>Work experience</h2><div className="xl">
      {c.experience.map((e: any, i: number) => <div className="xrow" key={i}><div className="pill">{e.dates}</div><div className="xd"><i /></div>
        <div className="xcard">{/present|current/i.test(e.dates || '') && <span className="cur">Current</span>}<h3>{e.role}</h3><div className="mono">{e.company}</div><ul>{lines(e.bullets).map(b => <li key={b}><Rich text={b} /></li>)}</ul><Tags v={e.tech} /></div></div>)}</div></section>

    <section id="skills"><Head n="04" t="Technical expertise" /><h2>Technical expertise</h2><div className="grid">
      {c.skills.map((s: any, i: number) => <div className="card" key={i}><h3>{s.category}</h3><Tags v={s.items} /></div>)}</div></section>

    <section id="projects"><Head n="05" t="Projects" /><h2>Projects</h2><ProjectCards items={c.projects} /></section>

    {c.education.length > 0 && <section id="education"><Head n="06" t="Education" /><h2>Education</h2><div className="ec">
      {c.education.map((e: any, i: number) => <div className="ecard" key={i}><div className="ico"><Svg d={I.cap} /></div><div><h3>{e.degree}</h3><p>{e.school}</p><p className="mono dim">{e.years}</p></div></div>)}</div></section>}

    {c.certifications.length > 0 && <section id="certifications"><Head n="07" t="Certifications" /><h2>Certifications</h2><div className="ec">
      {c.certifications.map((e: any, i: number) => <div className="ecard" key={i}><div className="ico"><Svg d={I.medal} /></div><div><h3>{e.name}</h3><p>{e.issuer}</p><p className="mono dim">{e.date}</p>{safeUrl(e.url) && <a className="verify" href={safeUrl(e.url)} target="_blank" rel="noopener noreferrer">Verify credential ↗</a>}</div></div>)}</div></section>}

    {(c.achievements.length > 0 || c.volunteering.length > 0) && <section id="impact"><Head n="08" t="Achievements" /><h2>Achievements and volunteering</h2><div className="ec">
      {c.achievements.map((e: any, i: number) => <div className="ecard" key={'a' + i}><div className="ico"><Svg d={I.star} /></div><div><h3>{e.title}</h3><p className="pre"><Rich text={e.detail} /></p></div></div>)}
      {c.volunteering.map((e: any, i: number) => <div className="ecard" key={'v' + i}><div className="ico"><Svg d={I.heart} /></div><div><h3>{e.org}</h3><p className="mono dim">{e.role}</p><p className="pre"><Rich text={e.detail} /></p></div></div>)}</div></section>}

    <section id="contact"><Head n="09" t="Contact" />
      <div className="ct"><div className="cinfo">
        <h3 className="big">Get in touch</h3>
        <p className="note">Have a role, a project or a question? Send a message or reach out directly.</p>
        {p.availability && <span className="avail"><i />{p.availability}</span>}
        <ul className="rows">{rows.filter(r => r[2]).map(([k, l, v, href]) => <li key={k}>{href
          ? <a href={href} target={k === 'li' || k === 'gh' ? '_blank' : undefined} rel="noopener noreferrer"><span className="ico"><Svg d={(I as any)[k]} /></span><span><small>{l}</small>{v}</span></a>
          : <div className="r"><span className="ico"><Svg d={(I as any)[k]} /></span><span><small>{l}</small>{v}</span></div>}</li>)}</ul>
        <a className="btn main" href="/api/resume" download>Download resume</a>
      </div><ContactForm /></div></section>

    <footer><span className="mono">Drawn by {p.name} · Rev A</span><span className="mono">yashwanthgowdam.in</span></footer>
    <ChatWidget />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ '@context': 'https://schema.org', '@type': 'Person', name: p.name, jobTitle: p.headline, description: String(p.summary || '').split(/\n\s*\n/)[0].replace(/==|\*\*/g, '').slice(0, 300), url: 'https://yashwanthgowdam.in', image: safeImg(p.photo)?.startsWith('/') ? 'https://yashwanthgowdam.in' + safeImg(p.photo) : safeImg(p.photo), sameAs: [safeUrl(p.linkedin), safeUrl(p.github)].filter(Boolean), knowsAbout: ['DevOps', 'Kubernetes', 'Amazon EKS', 'CI/CD', 'AWS'] }) }} />
  </>)
}
