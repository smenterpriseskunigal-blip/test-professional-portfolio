import { ImageResponse } from 'next/og'
export const alt = 'Yashwanth Gowda M – DevOps, Cloud and Kubernetes Engineer'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export default function Image() {
  return new ImageResponse(
    (<div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: '#0b1220', color: '#e6edf7' }}>
      <div style={{ fontSize: 28, color: '#4cc9f0', letterSpacing: 4 }}>&gt;// MY_PORTFOLIO</div>
      <div style={{ fontSize: 84, fontWeight: 700, marginTop: 24 }}>Yashwanth Gowda M</div>
      <div style={{ fontSize: 40, marginTop: 20, color: '#9fb3c8' }}>DevOps · Cloud · Kubernetes Engineer</div>
      <div style={{ fontSize: 28, marginTop: 48, color: '#4cc9f0' }}>yashwanthgowdam.in</div>
    </div>), size)
}
