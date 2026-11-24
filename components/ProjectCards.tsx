'use client'
import { useRef, useState } from 'react'
import { Rich } from '@/lib/rich'
import { safeUrl } from '@/lib/safe'
type P = { name: string; summary: string; tech: string; link: string }
const tags = (s = '') => s.split(',').map(x => x.trim()).filter(Boolean)
export default function ProjectCards({ items }: { items: P[] }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState<P | null>(null)
  const show = (p: P) => { setOpen(p); ref.current?.showModal() }
  return (<>
    <div className="pgrid">{items.map((p, i) => { const t = tags(p.tech); return (
      <article className="pcard" key={i}>
        <h3>{p.name}</h3>
        <p className="clamp"><Rich text={p.summary} /></p>
        <div className="ptags">{t.slice(0, 3).map(x => <span key={x}>{x}</span>)}{t.length > 3 && <span className="more">+{t.length - 3}</span>}</div>
        <div className="prow"><button type="button" className="btn" onClick={() => show(p)}>View details</button>
          {safeUrl(p.link) && <a className="btn" href={safeUrl(p.link)} target="_blank" rel="noopener noreferrer">Open ↗</a>}</div>
      </article>) })}</div>
    <dialog ref={ref} className="pd" aria-label={open?.name} onClose={() => setOpen(null)} onClick={e => { if (e.target === e.currentTarget) e.currentTarget.close() }}>
      {open && <div><h3>{open.name}</h3><p className="pre"><Rich text={open.summary} /></p>
        <div className="tags">{tags(open.tech).map(x => <span key={x}>{x}</span>)}</div>
        <div className="prow">{safeUrl(open.link) && <a className="btn main" href={safeUrl(open.link)} target="_blank" rel="noopener noreferrer">Open project ↗</a>}
          <button type="button" className="btn" onClick={() => ref.current?.close()}>Close</button></div></div>}
    </dialog></>)
}
