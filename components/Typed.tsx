'use client'
import { useEffect, useState } from 'react'
export default function Typed({ text }: { text: string }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(text.length); return }
    setN(0); const t = setInterval(() => setN(x => (x < text.length ? x + 1 : x)), 45); return () => clearInterval(t)
  }, [text])
  return <p className="type" aria-label={text}>{text.slice(0, n)}<span className="caret" aria-hidden="true" /></p>
}
