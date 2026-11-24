'use client'
import { useEffect, useRef, useState } from 'react'
// Counts from 0 to the number inside the value ("4+", "100%", "20+") when it scrolls into view.
export default function CountUp({ value }: { value: string }) {
  const m = String(value).match(/^(\D*)(\d+(?:\.\d+)?)(.*)$/)
  const ref = useRef<HTMLSpanElement>(null)
  const [n, setN] = useState<number | null>(null)
  useEffect(() => {
    if (!m || !ref.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const target = parseFloat(m[2]); setN(0)
    let raf = 0
    const io = new IntersectionObserver(es => {
      if (!es[0].isIntersecting) return
      io.disconnect(); const t0 = performance.now()
      const step = (t: number) => { const k = Math.min(1, (t - t0) / 1400); setN(target * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(step) }
      raf = requestAnimationFrame(step)
    }, { threshold: 0.4 })
    io.observe(ref.current)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [value])
  if (!m) return <span>{value}</span>
  const dec = (m[2].split('.')[1] || '').length
  return <span ref={ref}>{m[1]}{(n === null ? parseFloat(m[2]) : n).toFixed(dec)}{m[3]}</span>
}
