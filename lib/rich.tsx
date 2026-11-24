import React from 'react'
// Admin markup: ==highlight==  and  **bold**
export function Rich({ text }: { text?: string }) {
  const parts = String(text || '').split(/(==[^=\n]+?==|\*\*[^*\n]+?\*\*)/g)
  return <>{parts.map((s, i) =>
    s.length > 4 && s.startsWith('==') && s.endsWith('==') ? <mark key={i}>{s.slice(2, -2)}</mark>
    : s.length > 4 && s.startsWith('**') && s.endsWith('**') ? <strong key={i}>{s.slice(2, -2)}</strong>
    : <React.Fragment key={i}>{s}</React.Fragment>)}</>
}
