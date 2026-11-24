'use client'
import { useState } from 'react'

export default function ContactForm() {
  const [s, setS] = useState('')
  return (
    <form
      className="card cform"
      onSubmit={async e => {
        e.preventDefault()
        const form = e.currentTarget
        setS('Sending…')
        try {
          const r = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(new FormData(form))),
          })
          setS(
            r.ok
              ? 'Message sent. Thank you!'
              : r.status === 429
                ? 'Too many messages. Please try again later.'
                : 'Could not send. Check the fields and try again.'
          )
          if (r.ok) form.reset()
        } catch {
          setS('Network error. Please try again.')
        }
      }}
    >
      <h3 className="big">Send a message</h3>
      <label>
        Name
        <input name="name" required maxLength={100} autoComplete="name" />
      </label>
      <label>
        Email
        <input name="email" type="email" required maxLength={150} autoComplete="email" />
      </label>
      <label className="grow">
        Message
        <textarea name="body" required minLength={2} maxLength={2000} />
      </label>
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px' }}
      />
      <div className="row">
        <button className="btn main" type="submit">
          Send message
        </button>
        <span role="status">{s}</span>
      </div>
    </form>
  )
}
