'use client'
import { useEffect, useState } from 'react'
export default function ThemeToggle() {
  const [t, setT] = useState<'dark' | 'light'>('dark')
  useEffect(() => {
    let v: string | null = null; try { v = localStorage.getItem('theme') } catch {}
    const cur = (v as any) || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    document.documentElement.setAttribute('data-theme', cur); setT(cur)
  }, [])
  const set = (n: 'dark' | 'light') => { document.documentElement.setAttribute('data-theme', n); setT(n); try { localStorage.setItem('theme', n) } catch {} }
  const ic = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, width: 18, height: 18, viewBox: '0 0 24 24' }
  return (<div className="tg" role="group" aria-label="Colour theme">
    <button aria-label="Light drawing" aria-pressed={t === 'light'} className={t === 'light' ? 'on' : ''} onClick={() => set('light')}><svg {...ic}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg></button>
    <button aria-label="Dark blueprint" aria-pressed={t === 'dark'} className={t === 'dark' ? 'on' : ''} onClick={() => set('dark')}><svg {...ic}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg></button>
  </div>)
}
