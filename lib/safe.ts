// Output-side guards: never put an unchecked string into href/src or into a <script> tag.
export const safeUrl = (u?: string) => { // http(s) only (blocks javascript:, data:, vbscript:)
  const s = String(u || '').trim()
  if (!s) return undefined
  try { const x = new URL(s); return x.protocol === 'https:' || x.protocol === 'http:' ? x.toString() : undefined } catch { return undefined }
}
export const safeImg = (u?: string) => { // site-relative path (not //host) or https URL
  const s = String(u || '').trim()
  if (/^\/(?!\/)[\w\-./]*$/.test(s)) return s
  try { return new URL(s).protocol === 'https:' ? s : undefined } catch { return undefined }
}
export const safeEmail = (e?: string) => /^[^\s@<>"',;:?&=]+@[^\s@<>"',;:?&=]+\.[^\s@<>"',;:?&=]+$/.test(String(e || '')) ? String(e) : undefined
// JSON for <script type="application/ld+json">: escape < > & and line separators so "</script>" can never break out.
export const jsonLd = (o: unknown) => JSON.stringify(o).replace(/[<>&\u2028\u2029]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
