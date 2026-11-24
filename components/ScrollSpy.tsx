'use client'
import { useEffect } from 'react'
export default function ScrollSpy() {
  useEffect(() => {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) document.querySelectorAll('.links a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)) }), { threshold: .4 })
    document.querySelectorAll('header.hero, section[id]').forEach(s => io.observe(s)); return () => io.disconnect()
  }, [])
  return null
}
