'use client'
import { useState } from 'react'

export default function Login() {
  const [err, setErr] = useState('')

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErr('')
    const f = Object.fromEntries(new FormData(e.currentTarget))
    const r = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(f),
    })
    if (r.ok) {
      const next = new URLSearchParams(window.location.search).get('next')
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/adminlogin/dashboard'
      window.location.href = safeNext
    } else {
      const d = await r.json().catch(() => ({}))
      setErr(d.error || 'Sign in failed')
    }
  }

  return (
    <main style={{ maxWidth: 440, margin: '10vh auto', padding: '0 1rem' }}>
      <form className="card" onSubmit={onSubmit}>
        <p className="mono" style={{ marginBottom: '.4rem', color: 'var(--amber)' }}>
          PROTECTED AREA
        </p>
        <h2 style={{ fontSize: '1.8rem' }}>Admin login</h2>
        <label>
          Username
          <input name="user" autoComplete="username" required maxLength={100} />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required maxLength={128} />
        </label>
        <div className="row">
          <button className="btn main" type="submit">
            Sign in
          </button>
        </div>
        {err && (
          <p role="alert" style={{ color: '#ff9a9a', marginTop: '.8rem' }}>
            {err}
          </p>
        )}
      </form>
    </main>
  )
}
