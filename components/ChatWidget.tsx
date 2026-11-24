'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageSquare, Send, ShieldCheck, X, RefreshCw, Clock } from 'lucide-react'
import { ROLE_TYPES, PROFILE_SOURCES } from '@/lib/validate'

type ChatMsg = {
  id: string
  sessionId: string
  sender: 'VISITOR' | 'AI' | 'ADMIN' | 'SYSTEM' | string
  body: string
  meta?: {
    outOfKb?: boolean
    fallbackContact?: boolean
  } | null
  createdAt: string
}

type SessionInfo = {
  id: string
  fullName: string
  roleType: string
  source: string
  countryCode: string
  mobile: string
  email: string
  status: 'AI_ACTIVE' | 'WAITING_FOR_ADMIN' | 'ADMIN_TAKEOVER' | 'CLOSED'
  escalationExpiresAt?: string | null
}

const COUNTRY_CODES = [
  { code: '+91', label: '+91 (IN)' },
  { code: '+1', label: '+1 (US/CA)' },
  { code: '+44', label: '+44 (UK)' },
  { code: '+65', label: '+65 (SG)' },
  { code: '+971', label: '+971 (AE)' },
  { code: '+61', label: '+61 (AU)' },
  { code: '+49', label: '+49 (DE)' },
  { code: '+81', label: '+81 (JP)' },
  { code: '+31', label: '+31 (NL)' },
  { code: '+33', label: '+33 (FR)' },
]

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'form' | 'otp' | 'chat'>('form')

  const [fullName, setFullName] = useState('')
  const [roleType, setRoleType] = useState<string>(ROLE_TYPES[0])
  const [source, setSource] = useState<string>(PROFILE_SOURCES[3])
  const [countryCode, setCountryCode] = useState('+91')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [resendWait, setResendWait] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const [token, setToken] = useState<string | null>(null)
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const listRef = useRef<HTMLDivElement>(null)

  const appendUniqueMessage = (msg: ChatMsg) => {
    setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]))
  }

  useEffect(() => {
    let storedToken: string | null = null
    try {
      storedToken = sessionStorage.getItem('cw_visitor_token')
    } catch {}
    if (storedToken) setToken(storedToken)

    const headers: Record<string, string> = {}
    if (storedToken) headers.Authorization = `Bearer ${storedToken}`

    fetch('/api/chat/session', { headers })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.session && d.session.status !== 'CLOSED') {
          setSession(d.session)
          setMessages(d.messages || [])
          setStep('chat')
        } else if (storedToken) {
          try {
            sessionStorage.removeItem('cw_visitor_token')
          } catch {}
          setToken(null)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (resendWait <= 0 && session?.status !== 'WAITING_FOR_ADMIN') return
    const id = setInterval(() => {
      setNowMs(Date.now())
      setResendWait(w => (w > 0 ? w - 1 : 0))
    }, 1000)
    return () => clearInterval(id)
  }, [resendWait, session?.status])

  useEffect(() => {
    if (step !== 'chat' || !session?.id) return
    const url = token ? `/api/chat/stream?token=${encodeURIComponent(token)}` : '/api/chat/stream'
    const es = new EventSource(url)

    es.addEventListener('init', (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data)
        if (d.session) setSession(d.session)
        if (Array.isArray(d.messages)) setMessages(d.messages)
      } catch {}
    })

    es.addEventListener('message:new', (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data)
        if (d.message) appendUniqueMessage(d.message)
      } catch {}
    })

    es.addEventListener('session:status', (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data)
        setSession(prev =>
          prev
            ? {
                ...prev,
                status: d.status,
                escalationExpiresAt: d.escalationExpiresAt ?? null,
              }
            : prev
        )
      } catch {}
    })

    return () => es.close()
  }, [step, session?.id, token])

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [open, messages.length, step, sending, err])

  const waitCountdown = useMemo(() => {
    if (session?.status !== 'WAITING_FOR_ADMIN' || !session.escalationExpiresAt) return null
    const remaining = Math.max(0, Math.ceil((new Date(session.escalationExpiresAt).getTime() - nowMs) / 1000))
    const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
    const ss = String(remaining % 60).padStart(2, '0')
    return `${mm}:${ss}`
  }, [session?.status, session?.escalationExpiresAt, nowMs])

  const sendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const r = await fetch('/api/chat/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, roleType, source, countryCode, mobile, email }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErr(d.error || 'Could not send OTP')
        return
      }
      setResendWait(d.resendAfter || 30)
      setStep('otp')
    } catch {
      setErr('Network error while sending verification code.')
    } finally {
      setBusy(false)
    }
  }

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const r = await fetch('/api/chat/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, roleType, source, countryCode, mobile, email, otp }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErr(d.error || 'OTP verification failed')
        return
      }
      setToken(d.token || null)
      if (d.token) {
        try {
          sessionStorage.setItem('cw_visitor_token', d.token)
        } catch {}
      }
      setSession(d.session)
      setMessages(d.messages || [])
      setOtp('')
      setStep('chat')
    } catch {
      setErr('Network error during verification.')
    } finally {
      setBusy(false)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text || sending || session?.status === 'CLOSED') return
    setErr('')
    setSending(true)
    setDraft('')
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const r = await fetch('/api/chat/message', {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: text }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErr(d.error || 'Message failed')
        setDraft(text)
        return
      }
      if (d.visitorMessage) appendUniqueMessage(d.visitorMessage)
      if (d.replyMessage) appendUniqueMessage(d.replyMessage)
      if (d.mode) {
        setSession(prev =>
          prev
            ? {
                ...prev,
                status: d.mode,
                escalationExpiresAt: d.escalationExpiresAt ?? prev.escalationExpiresAt,
              }
            : prev
        )
      }
    } catch {
      setErr('Network error sending message.')
      setDraft(text)
    } finally {
      setSending(false)
    }
  }

  const endChat = async () => {
    try {
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Bearer ${token}`
      await fetch('/api/chat/session', { method: 'DELETE', headers })
    } catch {}
    try {
      sessionStorage.removeItem('cw_visitor_token')
    } catch {}
    setToken(null)
    setSession(null)
    setMessages([])
    setErr('')
    setStep('form')
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          className="cw-launcher"
          onClick={() => setOpen(true)}
          aria-label="Open Yashwanth AI Assistant"
        >
          <span className="cw-dot" aria-hidden="true" />
          <MessageSquare size={18} />
          <span>Ask Yashwanth&apos;s AI</span>
        </button>
      )}

      {open && (
        <aside className="cw-panel" aria-label="AI Portfolio Assistant">
          <div className="cw-head">
            <div className="cw-head-title">
              <strong>Yashwanth&apos;s AI Assistant</strong>
              <span>
                {step === 'chat' && session
                  ? `${session.fullName} · ${session.roleType}`
                  : 'Verified Career & Profile Chat'}
              </span>
            </div>
            <div className="cw-head-actions">
              {step === 'chat' && (
                <button type="button" className="cw-icon-btn" onClick={endChat} title="Start a new session">
                  New
                </button>
              )}
              <button
                type="button"
                className="cw-icon-btn"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {step === 'chat' && session && (
            <div className="cw-status-bar">
              <span
                className={`cw-badge ${
                  session.status === 'WAITING_FOR_ADMIN'
                    ? 'wait'
                    : session.status === 'ADMIN_TAKEOVER'
                      ? 'live'
                      : session.status === 'CLOSED'
                        ? 'closed'
                        : ''
                }`}
              >
                {session.status === 'AI_ACTIVE' && 'AI Grounded'}
                {session.status === 'WAITING_FOR_ADMIN' && (
                  <>
                    <Clock size={12} /> Notifying Yashwanth {waitCountdown ? `(${waitCountdown})` : ''}
                  </>
                )}
                {session.status === 'ADMIN_TAKEOVER' && 'Yashwanth Live'}
                {session.status === 'CLOSED' && 'Session Closed'}
              </span>
              <span style={{ color: 'var(--dim)' }}>KB-Grounded</span>
            </div>
          )}

          <div className="cw-body" ref={listRef}>
            {step === 'form' && (
              <form className="cw-gate" onSubmit={sendOtp}>
                <h3>Identity Verification</h3>
                <p>Complete this quick verification before chatting with Yashwanth&apos;s AI assistant.</p>

                <label>
                  Full Name *
                  <input
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </label>

                <label>
                  Who are you? *
                  <select value={roleType} onChange={e => setRoleType(e.target.value)}>
                    {ROLE_TYPES.map(r => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  How did you get my profile? *
                  <select value={source} onChange={e => setSource(e.target.value)}>
                    {PROFILE_SOURCES.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Mobile Number *
                  <div className="cw-phone-row">
                    <select
                      aria-label="Country code"
                      value={countryCode}
                      onChange={e => setCountryCode(e.target.value)}
                    >
                      {COUNTRY_CODES.map(c => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={mobile}
                      onChange={e => setMobile(e.target.value)}
                      placeholder="9876543210"
                      required
                      maxLength={15}
                    />
                  </div>
                </label>

                <label>
                  Company Mail Address *
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                    maxLength={150}
                  />
                </label>

                {err && (
                  <p role="alert" className="cw-err">
                    {err}
                  </p>
                )}

                <div className="row" style={{ marginTop: '.7rem' }}>
                  <button type="submit" className="btn main" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>
                    {busy ? 'Sending Code…' : 'Send Email OTP'}
                  </button>
                </div>
              </form>
            )}

            {step === 'otp' && (
              <form className="cw-gate" onSubmit={verifyOtp}>
                <h3>Verify Company Email</h3>
                <p>
                  Enter the 6-digit verification code sent via email to <strong>{email}</strong>.
                </p>

                <label>
                  6-Digit OTP *
                  <input
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    placeholder="123456"
                    required
                    minLength={6}
                    maxLength={6}
                    style={{ letterSpacing: '.35em', fontFamily: "'JetBrains Mono', monospace", fontSize: '1.1rem' }}
                  />
                </label>

                {err && (
                  <p role="alert" className="cw-err">
                    {err}
                  </p>
                )}

                <div className="row" style={{ marginTop: '.75rem' }}>
                  <button type="submit" className="btn main" style={{ flex: 1, justifyContent: 'center' }} disabled={busy}>
                    <ShieldCheck size={16} style={{ marginRight: '.4rem' }} />
                    {busy ? 'Verifying…' : 'Verify & Chat'}
                  </button>
                </div>

                <div className="row" style={{ justifyContent: 'space-between', marginTop: '.5rem' }}>
                  <button
                    type="button"
                    className="cw-icon-btn"
                    onClick={() => sendOtp()}
                    disabled={busy || resendWait > 0}
                  >
                    <RefreshCw size={13} />
                    {resendWait > 0 ? `Resend in ${resendWait}s` : 'Resend OTP'}
                  </button>
                  <button
                    type="button"
                    className="cw-icon-btn"
                    onClick={() => {
                      setStep('form')
                      setErr('')
                    }}
                  >
                    Edit details
                  </button>
                </div>
              </form>
            )}

            {step === 'chat' && (
              <>
                {messages.map(m => {
                  const cls =
                    m.sender === 'VISITOR'
                      ? 'visitor'
                      : m.sender === 'ADMIN'
                        ? 'admin'
                        : m.sender === 'SYSTEM'
                          ? 'system'
                          : 'ai'
                  const label =
                    m.sender === 'VISITOR'
                      ? 'You'
                      : m.sender === 'ADMIN'
                        ? 'Yashwanth (Live)'
                        : m.sender === 'SYSTEM'
                          ? 'System Notice'
                          : 'AI Assistant'

                  return (
                    <div key={m.id} className={`cw-msg ${cls}`}>
                      <div className="cw-msg-meta">
                        <span>{label}</span>
                        <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div>{m.body}</div>
                      {m.meta?.fallbackContact && (
                        <div className="cw-fallback-links">
                          <a href="#contact" onClick={() => setOpen(false)}>
                            Go to Contact Form
                          </a>
                        </div>
                      )}
                    </div>
                  )
                })}
                {sending && (
                  <div className="cw-msg ai">
                    <div className="cw-msg-meta">
                      <span>AI Assistant</span>
                    </div>
                    <span className="mono">Checking Knowledge Base…</span>
                  </div>
                )}
                {err && (
                  <p role="alert" className="cw-err">
                    {err}
                  </p>
                )}
              </>
            )}
          </div>

          {step === 'chat' && (
            <form className="cw-foot" onSubmit={sendMessage}>
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder={
                  session?.status === 'CLOSED'
                    ? 'Session closed'
                    : session?.status === 'ADMIN_TAKEOVER'
                      ? 'Reply directly to Yashwanth…'
                      : 'Ask about skills, experience, location…'
                }
                disabled={session?.status === 'CLOSED'}
                maxLength={2000}
              />
              <button
                type="submit"
                className="btn main"
                disabled={sending || !draft.trim() || session?.status === 'CLOSED'}
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </form>
          )}
        </aside>
      )}
    </>
  )
}
