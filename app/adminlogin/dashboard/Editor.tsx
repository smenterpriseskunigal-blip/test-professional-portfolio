'use client'
import { useRef, useState } from 'react'
import { SECTIONS } from '@/lib/schema'
const Field = ({ f, v, on }: any) => {
  const ref = useRef<HTMLTextAreaElement>(null)
  const wrap = (m: string) => { const el = ref.current; if (!el) return; const s = el.selectionStart, e = el.selectionEnd; if (s === e) return; const t = v ?? ''; on(t.slice(0, s) + m + t.slice(s, e) + m + t.slice(e)); setTimeout(() => { el.focus(); el.setSelectionRange(s, e + 2 * m.length) }, 0) }
  const heading = () => { const el = ref.current; if (!el) return; const t = v ?? '', s = el.selectionStart, ls = t.lastIndexOf('\n', s - 1) + 1; if (t.slice(ls, ls + 2) === '# ') return; on(t.slice(0, ls) + '# ' + t.slice(ls)); setTimeout(() => el.focus(), 0) }
  return <label>{f.l}{f.area ? <>
    <span className="tbar"><button type="button" onMouseDown={e => e.preventDefault()} onClick={() => wrap('==')}>Highlight</button><button type="button" onMouseDown={e => e.preventDefault()} onClick={() => wrap('**')}>Bold</button>{f.k === 'summary' && <button type="button" onMouseDown={e => e.preventDefault()} onClick={heading}>Card title</button>}<small>{f.k === 'summary' ? 'First paragraph = intro. Put the cursor on a line and click Card title to turn the paragraph after it into a titled card. ' : ''}Select text, then Highlight or Bold.</small></span>
    <textarea ref={ref} rows={f.k === 'summary' || f.k === 'bullets' ? 9 : 4} value={v ?? ''} onChange={e => on(e.target.value)} /></>
    : <input value={v ?? ''} onChange={e => on(e.target.value)} />}</label>
}
export default function Editor({ initial, messages }: { initial: Record<string, any>; messages: any[] }) {
  const [data, setData] = useState(initial), [tab, setTab] = useState('profile'), [status, setStatus] = useState(''), [jd, setJd] = useState(''), [ats, setAts] = useState<any>(null)
  const sec = SECTIONS[tab], items = data[tab]
  const set = (v: any) => setData({ ...data, [tab]: v })
  const save = async () => { setStatus('Saving…'); const r = await fetch('/api/admin/content', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: tab, data: data[tab] }) }); setStatus(r.ok ? 'Saved. The site is updated.' : 'Save failed: ' + ((await r.json().catch(() => ({}))).error || r.status)) }
  const reset = async () => { if (!confirm('Delete your saved ' + sec.label + ' and restore the sample data?')) return; await fetch('/api/admin/content', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: tab }) }); location.reload() }
  const move = (i: number, d: number) => { const a = [...items], j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set(a) }
  const importFile = async (file?: File) => {
    if (!file) return
    try { const j = JSON.parse(await file.text()); if (!confirm('Import this file? It replaces the matching sections on your site.')) return
      const r = await fetch('/api/admin/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(j) })
      if (r.ok) location.reload(); else setStatus('Import failed: ' + ((await r.json().catch(() => ({}))).error || 'invalid file')) } catch { setStatus('Import failed: not a valid JSON file.') }
  }
  return (<main style={{ maxWidth: 1000, margin: 'auto', padding: '1.5rem 1rem 4rem' }}>
    <div className="row" style={{ justifyContent: 'space-between' }}><h2 style={{ border: 0, margin: 0 }}>Admin</h2>
      <div className="row"><a className="btn main" href="/admin/chats">Live Chats &amp; KB</a><a className="btn" href="/" target="_blank">View site</a><a className="btn" href="/api/admin/backup">Export JSON</a>
        <label className="btn" style={{ margin: 0, cursor: 'pointer' }}>Import JSON<input type="file" accept="application/json" style={{ display: 'none' }} onChange={e => importFile(e.target.files?.[0])} /></label>
        <button onClick={async () => { await fetch('/api/admin/logout', { method: 'POST' }); location.href = '/adminlogin' }}>Sign out</button></div></div>
    <div className="tabs" role="tablist">{[...Object.keys(SECTIONS), 'ats', 'messages'].map(k => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setStatus('') }}>{SECTIONS[k]?.label || (k === 'ats' ? 'Resume and ATS' : 'Messages')}</button>)}</div>
    {sec && <>
      {sec.single ? <div className="card">{sec.fields.map(f => <Field key={f.k} f={f} v={items[f.k]} on={(v: string) => set({ ...items, [f.k]: v })} />)}</div>
        : <>{items.map((it: any, i: number) => <div className="card" key={i} style={{ marginBottom: '1rem', opacity: it.hidden ? .55 : 1 }}>
            {sec.fields.map(f => <Field key={f.k} f={f} v={it[f.k]} on={(v: string) => set(items.map((x: any, j: number) => j === i ? { ...x, [f.k]: v } : x))} />)}
            <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}><input type="checkbox" style={{ width: 'auto', minHeight: 0 }} checked={!!it.hidden} onChange={e => set(items.map((x: any, j: number) => j === i ? { ...x, hidden: e.target.checked } : x))} />Hide from website and resume</label>
            <div className="row"><button onClick={() => move(i, -1)}>Move up</button><button onClick={() => move(i, 1)}>Move down</button><button className="danger" onClick={() => confirm('Delete this entry?') && set(items.filter((_: any, j: number) => j !== i))}>Delete entry</button></div></div>)}
          <button onClick={() => set([...items, Object.fromEntries(sec.fields.map(f => [f.k, '']))])}>Add entry</button></>}
      <div className="row"><button className="btn main" onClick={save}>Save {sec.label}</button><button className="danger" onClick={reset}>Restore sample data</button><span role="status">{status}</span></div></>}
    {tab === 'ats' && <div className="card"><h3>Resume and ATS check</h3>
      <p className="note">Hidden entries are left out. Save your changes first, then preview or download. The score is an internal estimate; real ATS products differ.</p>
      <div className="row"><a className="btn" href="/api/resume?view=1" target="_blank">Preview resume</a><a className="btn" href="/api/resume" download>Download resume PDF</a></div>
      <label>Job description (optional)<textarea rows={6} value={jd} onChange={e => setJd(e.target.value)} /></label>
      <div className="row"><button className="btn main" onClick={async () => setAts(await (await fetch('/api/admin/ats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jd }) })).json())}>Check score</button></div>
      {ats && <><h3 style={{ marginTop: '1rem' }}>Score: {ats.score} / 100 {ats.score >= 90 ? '(target met)' : '(target is 90)'}</h3>
        <ul>{ats.parts.map((p: any) => <li key={p.name}>{p.name}: {p.got} / {p.max}</li>)}</ul>
        {ats.fixes.length > 0 && <><b>Fix these:</b><ul>{ats.fixes.map((f: string) => <li key={f}>{f}</li>)}</ul></>}</>}</div>}
    {tab === 'messages' && (messages.length ? messages.map(m => <div className="card" key={m.id} style={{ marginBottom: '1rem' }}><h3>{m.name}</h3><p className="mono">{m.email} · {new Date(m.createdAt).toLocaleString()}</p><p style={{ whiteSpace: 'pre-wrap' }}>{m.body}</p></div>) : <p className="note">No messages yet.</p>)}
  </main>)
}
