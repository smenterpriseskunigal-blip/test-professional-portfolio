'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  BookOpen,
  CheckCircle2,
  Clock,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  UserCheck,
  Bot,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react'

type Msg = {
  id: string
  sessionId: string
  sender: string
  body: string
  meta?: any
  createdAt: string
}

type SessionItem = {
  id: string
  fullName: string
  roleType: string
  source: string
  countryCode: string
  mobile: string
  email: string
  emailVerified: boolean
  status: 'AI_ACTIVE' | 'WAITING_FOR_ADMIN' | 'ADMIN_TAKEOVER' | 'CLOSED'
  escalationStartedAt?: string | null
  escalationExpiresAt?: string | null
  createdAt: string
  updatedAt: string
  messages?: Msg[]
}

type UnansweredItem = {
  id: string
  sessionId: string
  question: string
  status: 'PENDING' | 'ADDED_TO_KB' | 'DISMISSED'
  answer?: string | null
  kbItemId?: string | null
  createdAt: string
  session?: SessionItem | null
}

type KbItem = {
  id: string
  category: 'QA' | 'BIODATA' | 'EXPERIENCE' | 'LOCATION' | 'INSTRUCTIONS'
  title: string
  content: string
  tags: string
  active: boolean
  updatedAt: string
}

const KB_CATS: KbItem['category'][] = ['QA', 'BIODATA', 'EXPERIENCE', 'LOCATION', 'INSTRUCTIONS']

function playAlertTone(urgent = false) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = urgent ? 'triangle' : 'sine'
    osc.frequency.setValueAtTime(urgent ? 880 : 660, ctx.currentTime)
    if (urgent) {
      osc.frequency.setValueAtTime(1046, ctx.currentTime + 0.14)
    }
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.36)
  } catch {}
}

export default function AdminChatsMonitor({
  initialSessions,
  initialUnanswered,
  initialKb,
}: {
  initialSessions: SessionItem[]
  initialUnanswered: UnansweredItem[]
  initialKb: KbItem[]
}) {
  const [tab, setTab] = useState<'chats' | 'kb'>('chats')
  const [sessions, setSessions] = useState<SessionItem[]>(initialSessions)
  const [unanswered, setUnanswered] = useState<UnansweredItem[]>(initialUnanswered)
  const [kbItems, setKbItems] = useState<KbItem[]>(initialKb)
  const [selectedId, setSelectedId] = useState<string>(initialSessions[0]?.id || '')
  const [reply, setReply] = useState('')
  const [soundOn, setSoundOn] = useState(true)
  const [alertBanner, setAlertBanner] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [statusMsg, setStatusMsg] = useState('')

  // Add-to-KB quick resolution state
  const [resolvingQ, setResolvingQ] = useState<UnansweredItem | null>(null)
  const [resolveCat, setResolveCat] = useState<KbItem['category']>('QA')
  const [resolveTitle, setResolveTitle] = useState('')
  const [resolveAnswer, setResolveAnswer] = useState('')
  const [resolveTags, setResolveTags] = useState('')

  // KB Manager state
  const [kbFilter, setKbFilter] = useState<'ALL' | KbItem['category']>('ALL')
  const [editingKbId, setEditingKbId] = useState<string | null>(null)
  const [kbCat, setKbCat] = useState<KbItem['category']>('QA')
  const [kbTitle, setKbTitle] = useState('')
  const [kbContent, setKbContent] = useState('')
  const [kbTags, setKbTags] = useState('')
  const [kbActive, setKbActive] = useState(true)

  const soundRef = useRef(soundOn)
  soundRef.current = soundOn
  const msgEndRef = useRef<HTMLDivElement>(null)

  const notifyBrowser = (title: string, body: string, urgent = false) => {
    if (soundRef.current) playAlertTone(urgent)
    setAlertBanner(`${title}: ${body}`)
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(title, { body })
      } catch {}
    }
  }

  // Live countdown ticker
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Real-time SSE connection for Admin Live Monitor
  useEffect(() => {
    const es = new EventSource('/api/admin/chats/stream')

    es.addEventListener('session:verified', (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data)
        const s: SessionItem = d.session
        if (!s) return
        setSessions(prev => [s, ...prev.filter(x => x.id !== s.id)])
        setSelectedId(cur => cur || s.id)
        notifyBrowser('New Verified Visitor', `${s.fullName} (${s.roleType}) from ${s.source}`, false)
      } catch {}
    })

    es.addEventListener('message:new', (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data)
        const m: Msg = d.message
        if (!m) return
        setSessions(prev =>
          prev.map(s => {
            if (s.id !== d.sessionId) return s
            const existing = s.messages || []
            if (existing.some(x => x.id === m.id)) return s
            return { ...s, updatedAt: m.createdAt, messages: [...existing, m] }
          })
        )
      } catch {}
    })

    es.addEventListener('session:status', (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data)
        setSessions(prev =>
          prev.map(s =>
            s.id === d.sessionId
              ? { ...s, status: d.status, escalationExpiresAt: d.escalationExpiresAt ?? null }
              : s
          )
        )
      } catch {}
    })

    es.addEventListener('escalation:triggered', (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data)
        if (d.session) {
          setSessions(prev =>
            prev.map(s => (s.id === d.session.id ? { ...s, ...d.session, messages: s.messages } : s))
          )
          setSelectedId(d.session.id)
        }
        if (d.question) {
          setUnanswered(prev => [d.question, ...prev.filter(q => q.id !== d.question.id)])
          notifyBrowser(
            'URGENT Out-of-KB Question (5m Timer)',
            `${d.session?.fullName || 'Visitor'}: "${d.question.question}"`,
            true
          )
        }
      } catch {}
    })

    es.addEventListener('unanswered:updated', (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data)
        if (d.question) {
          setUnanswered(prev => prev.map(q => (q.id === d.question.id ? { ...q, ...d.question } : q)))
        }
      } catch {}
    })

    return () => es.close()
  }, [])

  const sortedSessions = useMemo(() => {
    const rank = (s: SessionItem) =>
      s.status === 'WAITING_FOR_ADMIN' ? 0 : s.status === 'ADMIN_TAKEOVER' ? 1 : s.status === 'AI_ACTIVE' ? 2 : 3
    return [...sessions].sort((a, b) => {
      const dr = rank(a) - rank(b)
      if (dr !== 0) return dr
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }, [sessions])

  const selected = useMemo(
    () => sessions.find(s => s.id === selectedId) || sortedSessions[0] || null,
    [sessions, selectedId, sortedSessions]
  )

  useEffect(() => {
    if (msgEndRef.current) {
      msgEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [selected?.id, selected?.messages?.length])

  const remainingFor = (s: SessionItem) => {
    if (s.status !== 'WAITING_FOR_ADMIN' || !s.escalationExpiresAt) return null
    const sec = Math.max(0, Math.ceil((new Date(s.escalationExpiresAt).getTime() - nowMs) / 1000))
    return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
  }

  const runSessionAction = async (sessionId: string, action: 'takeover' | 'handback' | 'close') => {
    setStatusMsg('')
    const r = await fetch(`/api/admin/chats/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      setStatusMsg(d.error || 'Action failed')
      return
    }
    if (d.session) {
      setSessions(prev =>
        prev.map(s => (s.id === sessionId ? { ...s, ...d.session, messages: s.messages } : s))
      )
    }
  }

  const sendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !reply.trim()) return
    const text = reply.trim()
    setReply('')
    const r = await fetch(`/api/admin/chats/${selected.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    })
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      setStatusMsg(d.error || 'Failed to send reply')
      setReply(text)
    }
  }

  const openResolveModal = (q: UnansweredItem) => {
    setResolvingQ(q)
    setResolveCat('QA')
    setResolveTitle(q.question)
    setResolveAnswer('')
    setResolveTags('visitor-question')
  }

  const submitResolve = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resolvingQ) return
    const r = await fetch(`/api/admin/unanswered/${resolvingQ.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_to_kb',
        category: resolveCat,
        title: resolveTitle,
        answer: resolveAnswer,
        tags: resolveTags,
      }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      setStatusMsg(d.error || 'Could not save to KB')
      return
    }
    if (d.kbItem) setKbItems(prev => [d.kbItem, ...prev])
    if (d.question) setUnanswered(prev => prev.map(x => (x.id === d.question.id ? { ...x, ...d.question } : x)))
    setResolvingQ(null)
    setStatusMsg('Added answer to Knowledge Base.')
  }

  const dismissQuestion = async (id: string) => {
    const r = await fetch(`/api/admin/unanswered/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss' }),
    })
    const d = await r.json().catch(() => ({}))
    if (r.ok && d.question) {
      setUnanswered(prev => prev.map(x => (x.id === id ? { ...x, ...d.question } : x)))
    }
  }

  const saveKbEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatusMsg('')
    const url = editingKbId ? `/api/admin/kb/${editingKbId}` : '/api/admin/kb'
    const method = editingKbId ? 'PUT' : 'POST'
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: kbCat,
        title: kbTitle,
        content: kbContent,
        tags: kbTags,
        active: kbActive,
      }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      setStatusMsg(d.error || 'Could not save KB item')
      return
    }
    if (d.item) {
      setKbItems(prev =>
        editingKbId ? prev.map(x => (x.id === editingKbId ? d.item : x)) : [d.item, ...prev]
      )
    }
    setEditingKbId(null)
    setKbCat('QA')
    setKbTitle('')
    setKbContent('')
    setKbTags('')
    setKbActive(true)
    setStatusMsg('Knowledge Base updated.')
  }

  const deleteKbEntry = async (id: string) => {
    const r = await fetch(`/api/admin/kb/${id}`, { method: 'DELETE' })
    if (r.ok) {
      setKbItems(prev => prev.filter(x => x.id !== id))
      if (editingKbId === id) setEditingKbId(null)
    }
  }

  const startEditKb = (item: KbItem) => {
    setEditingKbId(item.id)
    setKbCat(item.category)
    setKbTitle(item.title)
    setKbContent(item.content)
    setKbTags(item.tags)
    setKbActive(item.active)
  }

  const requestPushPermission = async () => {
    if (typeof Notification === 'undefined') return
    const res = await Notification.requestPermission()
    setStatusMsg(res === 'granted' ? 'Browser notifications enabled.' : 'Browser notifications blocked.')
  }

  const pendingCount = unanswered.filter(q => q.status === 'PENDING').length
  const urgentCount = sessions.filter(s => s.status === 'WAITING_FOR_ADMIN').length
  const filteredKb = kbFilter === 'ALL' ? kbItems : kbItems.filter(k => k.category === kbFilter)

  return (
    <main className="adm-wrap">
      <div className="adm-top">
        <div>
          <p className="mono" style={{ color: 'var(--amber)', marginBottom: '.2rem' }}>
            ADMIN LIVE OPERATIONS
          </p>
          <h2 style={{ border: 0, margin: 0, fontSize: 'clamp(1.5rem,3vw,2.2rem)' }}>
            Visitor Chats &amp; Knowledge Base
          </h2>
        </div>

        <div className="row" style={{ marginTop: 0 }}>
          <button type="button" onClick={() => setSoundOn(s => !s)} title="Toggle audio chime">
            {soundOn ? <Volume2 size={16} style={{ marginRight: '.4rem' }} /> : <VolumeX size={16} style={{ marginRight: '.4rem' }} />}
            Sound {soundOn ? 'On' : 'Off'}
          </button>
          <button type="button" onClick={requestPushPermission}>
            <Bell size={16} style={{ marginRight: '.4rem' }} />
            Enable Push Alerts
          </button>
          <a className="btn" href="/adminlogin/dashboard">
            Portfolio Editor
          </a>
          <a className="btn" href="/" target="_blank" rel="noopener noreferrer">
            View Site
          </a>
          <button
            type="button"
            onClick={async () => {
              await fetch('/api/admin/logout', { method: 'POST' })
              window.location.href = '/adminlogin'
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {alertBanner && (
        <div className="adm-alert-banner" role="alert">
          <span>
            <strong>Alert:</strong> {alertBanner}
          </span>
          <button type="button" className="cw-icon-btn" onClick={() => setAlertBanner(null)}>
            Dismiss
          </button>
        </div>
      )}

      {statusMsg && (
        <p className="mono" style={{ color: 'var(--amber)', marginBottom: '.8rem' }}>
          {statusMsg}
        </p>
      )}

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'chats'}
          className={tab === 'chats' ? 'on' : ''}
          onClick={() => setTab('chats')}
        >
          <MessageSquare size={15} style={{ marginRight: '.4rem' }} />
          Live Chat Monitor ({sessions.length})
          {urgentCount > 0 ? ` · ${urgentCount} Waiting!` : ''}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'kb'}
          className={tab === 'kb' ? 'on' : ''}
          onClick={() => setTab('kb')}
        >
          <BookOpen size={15} style={{ marginRight: '.4rem' }} />
          Knowledge Base ({kbItems.length})
          {pendingCount > 0 ? ` · ${pendingCount} Unanswered` : ''}
        </button>
      </div>

      {tab === 'chats' && (
        <div className="adm-layout">
          {/* Left: Verified Visitor Sessions */}
          <section className="adm-col" style={{ padding: 0, maxWidth: 'none', margin: 0 }}>
            <div className="adm-col-head">
              <h3>Verified Visitors</h3>
              <span className="mono">{sessions.length}</span>
            </div>
            <div className="adm-scroll">
              {sortedSessions.length === 0 && (
                <p className="note" style={{ fontSize: '.9rem' }}>
                  No verified visitor sessions yet. Visitors appear here in real time after completing Email OTP verification.
                </p>
              )}
              {sortedSessions.map(s => {
                const cd = remainingFor(s)
                const lastMsg = s.messages?.[s.messages.length - 1]
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={`adm-session-btn ${selected?.id === s.id ? 'on' : ''} ${
                      s.status === 'WAITING_FOR_ADMIN' ? 'urgent' : ''
                    }`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', width: '100%' }}>
                      <strong>{s.fullName}</strong>
                      <span
                        className={`cw-badge ${
                          s.status === 'WAITING_FOR_ADMIN'
                            ? 'wait'
                            : s.status === 'ADMIN_TAKEOVER'
                              ? 'live'
                              : s.status === 'CLOSED'
                                ? 'closed'
                                : ''
                        }`}
                      >
                        {s.status === 'WAITING_FOR_ADMIN' ? `WAIT ${cd || ''}` : s.status}
                      </span>
                    </div>
                    <span className="mono">
                      {s.roleType} · {s.source}
                    </span>
                    <span className="mono" style={{ fontSize: '.7rem' }}>
                      {s.email} · {s.countryCode} {s.mobile}
                    </span>
                    {lastMsg && (
                      <span
                        style={{
                          fontSize: '.8rem',
                          color: 'var(--dim)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%',
                        }}
                      >
                        {lastMsg.sender}: {lastMsg.body}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Center: Live Chat Transcript + Takeover Controls */}
          <section className="adm-col" style={{ padding: 0, maxWidth: 'none', margin: 0 }}>
            <div className="adm-col-head">
              <div>
                <h3>{selected ? selected.fullName : 'Select a conversation'}</h3>
                {selected && (
                  <span className="mono">
                    {selected.status === 'WAITING_FOR_ADMIN'
                      ? `Waiting for Yashwanth (${remainingFor(selected) || '00:00'} remaining)`
                      : selected.status}
                  </span>
                )}
              </div>
              {selected && (
                <div className="row" style={{ marginTop: 0 }}>
                  {selected.status !== 'ADMIN_TAKEOVER' && selected.status !== 'CLOSED' && (
                    <button
                      type="button"
                      className="btn main"
                      style={{ minHeight: 36, padding: '.35rem .8rem', fontSize: '.84rem' }}
                      onClick={() => runSessionAction(selected.id, 'takeover')}
                    >
                      <UserCheck size={15} style={{ marginRight: '.35rem' }} />
                      Take Over Chat
                    </button>
                  )}
                  {selected.status === 'ADMIN_TAKEOVER' && (
                    <button
                      type="button"
                      style={{ minHeight: 36, padding: '.35rem .8rem', fontSize: '.84rem' }}
                      onClick={() => runSessionAction(selected.id, 'handback')}
                    >
                      <Bot size={15} style={{ marginRight: '.35rem' }} />
                      Hand Back to AI
                    </button>
                  )}
                  {selected.status !== 'CLOSED' && (
                    <button
                      type="button"
                      className="danger"
                      style={{ minHeight: 36, padding: '.35rem .7rem', fontSize: '.84rem' }}
                      onClick={() => runSessionAction(selected.id, 'close')}
                    >
                      Close
                    </button>
                  )}
                </div>
              )}
            </div>

            {selected && (
              <div className="adm-meta-grid">
                <span>Role: {selected.roleType}</span>
                <span>Source: {selected.source}</span>
                <span>Email: {selected.email}</span>
                <span>
                  Mobile: {selected.countryCode} {selected.mobile}
                </span>
              </div>
            )}

            <div className="adm-scroll">
              {selected ? (
                <>
                  {(selected.messages || []).map(m => {
                    const cls =
                      m.sender === 'VISITOR'
                        ? 'visitor'
                        : m.sender === 'ADMIN'
                          ? 'admin'
                          : m.sender === 'SYSTEM'
                            ? 'system'
                            : 'ai'
                    return (
                      <div key={m.id} className={`cw-msg ${cls}`} style={{ maxWidth: '88%' }}>
                        <div className="cw-msg-meta">
                          <span>{m.sender}</span>
                          <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <div>{m.body}</div>
                      </div>
                    )
                  })}
                  <div ref={msgEndRef} />
                </>
              ) : (
                <p className="note">Pick a visitor session on the left to inspect or take over the conversation.</p>
              )}
            </div>

            {selected && selected.status !== 'CLOSED' && (
              <form className="adm-reply-bar" onSubmit={sendAdminReply}>
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder="Reply directly as Yashwanth (auto-takes over chat and pauses AI)…"
                  rows={2}
                />
                <button type="submit" className="btn main" disabled={!reply.trim()}>
                  <Send size={16} />
                </button>
              </form>
            )}
          </section>

          {/* Right: Unanswered Questions Queue */}
          <section className="adm-col" style={{ padding: 0, maxWidth: 'none', margin: 0 }}>
            <div className="adm-col-head">
              <h3>Unanswered Questions</h3>
              <span className="mono">{pendingCount} pending</span>
            </div>
            <div className="adm-scroll">
              {unanswered.length === 0 && (
                <p className="note" style={{ fontSize: '.88rem' }}>
                  Out-of-KB questions triggered by visitors will appear here so you can review and add them to the Knowledge Base.
                </p>
              )}
              {unanswered.map(q => (
                <div key={q.id} className="card" style={{ padding: '.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', marginBottom: '.3rem' }}>
                    <span className="mono" style={{ fontSize: '.7rem' }}>
                      {q.session?.fullName || 'Visitor'} ({q.session?.roleType || 'Unknown'})
                    </span>
                    <span className={`cw-badge ${q.status === 'PENDING' ? 'wait' : 'live'}`}>{q.status}</span>
                  </div>
                  <p style={{ margin: '0 0 .5rem', fontSize: '.92rem' }}>
                    <strong>&ldquo;{q.question}&rdquo;</strong>
                  </p>
                  {q.answer && (
                    <p className="mono" style={{ margin: '0 0 .5rem', color: '#4ade80' }}>
                      Saved answer: {q.answer}
                    </p>
                  )}
                  {q.status === 'PENDING' && (
                    <div className="row" style={{ marginTop: '.4rem' }}>
                      <button
                        type="button"
                        className="btn main"
                        style={{ minHeight: 34, padding: '.3rem .7rem', fontSize: '.8rem' }}
                        onClick={() => openResolveModal(q)}
                      >
                        <Plus size={14} style={{ marginRight: '.3rem' }} />
                        Add to KB
                      </button>
                      <button
                        type="button"
                        style={{ minHeight: 34, padding: '.3rem .7rem', fontSize: '.8rem' }}
                        onClick={() => dismissQuestion(q.id)}
                      >
                        <XCircle size={14} style={{ marginRight: '.3rem' }} />
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === 'kb' && (
        <div className="adm-kb-grid">
          <form className="card" onSubmit={saveKbEntry}>
            <h3 style={{ marginBottom: '.6rem' }}>
              {editingKbId ? 'Edit Knowledge Base Entry' : 'Add Knowledge Base Entry'}
            </h3>
            <label>
              Category
              <select value={kbCat} onChange={e => setKbCat(e.target.value as KbItem['category'])}>
                {KB_CATS.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Question / Topic Title
              <input
                value={kbTitle}
                onChange={e => setKbTitle(e.target.value)}
                placeholder="e.g. Preferred work locations or Notice period"
                required
                minLength={2}
                maxLength={300}
              />
            </label>
            <label>
              Verified Facts / Answer / Custom Instructions
              <textarea
                rows={6}
                value={kbContent}
                onChange={e => setKbContent(e.target.value)}
                placeholder="Exact facts the AI may share with visitors…"
                required
                minLength={2}
                maxLength={6000}
              />
            </label>
            <label>
              Tags (comma separated)
              <input
                value={kbTags}
                onChange={e => setKbTags(e.target.value)}
                placeholder="e.g. bangalore, remote, kubernetes"
                maxLength={300}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginTop: '.8rem' }}>
              <input
                type="checkbox"
                style={{ width: 'auto', minHeight: 0 }}
                checked={kbActive}
                onChange={e => setKbActive(e.target.checked)}
              />
              Active (included in AI grounding context)
            </label>
            <div className="row">
              <button type="submit" className="btn main">
                {editingKbId ? 'Save Changes' : 'Add to Knowledge Base'}
              </button>
              {editingKbId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingKbId(null)
                    setKbTitle('')
                    setKbContent('')
                    setKbTags('')
                    setKbActive(true)
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div>
            <div className="tabs" style={{ marginBottom: '1rem' }}>
              {(['ALL', ...KB_CATS] as const).map(cat => (
                <button
                  key={cat}
                  type="button"
                  className={kbFilter === cat ? 'on' : ''}
                  onClick={() => setKbFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="adm-kb-list">
              {filteredKb.map(item => (
                <div key={item.id} className="card" style={{ opacity: item.active ? 1 : 0.6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <span className="cw-badge" style={{ marginRight: '.5rem' }}>
                        {item.category}
                      </span>
                      {!item.active && <span className="cw-badge closed">INACTIVE</span>}
                      <h3 style={{ marginTop: '.45rem' }}>{item.title}</h3>
                    </div>
                    <div className="row" style={{ marginTop: 0 }}>
                      <button
                        type="button"
                        style={{ minHeight: 34, padding: '.3rem .75rem', fontSize: '.82rem' }}
                        onClick={() => startEditKb(item)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="danger"
                        style={{ minHeight: 34, padding: '.3rem .75rem', fontSize: '.82rem' }}
                        onClick={() => deleteKbEntry(item.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="pre" style={{ marginTop: '.6rem' }}>
                    {item.content}
                  </p>
                  {item.tags && (
                    <div className="tags">
                      {item.tags
                        .split(',')
                        .map(t => t.trim())
                        .filter(Boolean)
                        .map(t => (
                          <span key={t}>{t}</span>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Add-to-KB Modal for Unanswered Questions */}
      {resolvingQ && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(3,12,32,.75)',
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
          }}
        >
          <form className="card" onSubmit={submitResolve} style={{ width: 'min(540px, 100%)', background: 'var(--bg)' }}>
            <h3>
              <CheckCircle2 size={18} style={{ verticalAlign: 'middle', marginRight: '.4rem', color: 'var(--amber)' }} />
              Add Answer to Knowledge Base
            </h3>
            <p className="note" style={{ fontSize: '.86rem' }}>
              Save this answer so future visitors asking this question receive an instant grounded response.
            </p>
            <label>
              Category
              <select value={resolveCat} onChange={e => setResolveCat(e.target.value as KbItem['category'])}>
                {KB_CATS.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Question / Title
              <input value={resolveTitle} onChange={e => setResolveTitle(e.target.value)} required />
            </label>
            <label>
              Answer
              <textarea
                rows={5}
                value={resolveAnswer}
                onChange={e => setResolveAnswer(e.target.value)}
                placeholder="Write the exact answer Yashwanth wants the AI to use…"
                required
              />
            </label>
            <label>
              Tags
              <input value={resolveTags} onChange={e => setResolveTags(e.target.value)} />
            </label>
            <div className="row">
              <button type="submit" className="btn main">
                Save &amp; Mark Resolved
              </button>
              <button type="button" onClick={() => setResolvingQ(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
