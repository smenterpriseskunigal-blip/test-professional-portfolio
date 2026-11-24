'use client'
import { useEffect, useRef, useState } from 'react'
const ROWS = [
  { y: 178, ty: 186, az: 'AZ-1', z: 'us-east-1a', c: '10.0.1.0/24' },
  { y: 318, ty: 326, az: 'AZ-2', z: 'us-east-1b', c: '10.0.2.0/24' },
  { y: 456, ty: 464, az: 'AZ-3', z: 'us-east-1c', c: '10.0.3.0/24' },
]
const TX = [492, 613]
function Cube({ tx, ty, s = 56, cls = 'n', style, children }: any) {
  const w = s * 0.866, q = s / 2, h = s
  return (<g className={cls} style={style}>
    <polygon className="fl" points={`${tx - w},${ty} ${tx},${ty + q} ${tx},${ty + q + h} ${tx - w},${ty + h}`} />
    <polygon className="fr" points={`${tx},${ty + q} ${tx + w},${ty} ${tx + w},${ty + h} ${tx},${ty + q + h}`} />
    <polygon className="ft" points={`${tx},${ty - q} ${tx + w},${ty} ${tx},${ty + q} ${tx - w},${ty}`} />
    {children}</g>)
}
const K8s = ({ x, y }: any) => (<g className="k8" transform={`translate(${x} ${y})`}><circle r="8.5" /><circle r="2.2" />
  {[0, 1, 2, 3, 4, 5, 6].map(i => { const a = i * 2 * Math.PI / 7; return <line key={i} x1={2.2 * Math.cos(a)} y1={2.2 * Math.sin(a)} x2={8.5 * Math.cos(a)} y2={8.5 * Math.sin(a)} /> })}</g>)
const Box = ({ x, y, w, h, amber }: any) => <rect className={'cb' + (amber ? ' am' : '')} x={x} y={y} width={w} height={h} rx="6" />
const Dot = ({ x, y, amber }: any) => <circle className={'dot' + (amber ? ' am' : '')} cx={x} cy={y} r="3.5" />
export default function Blueprint() {
  const wrap = useRef<HTMLDivElement>(null)
  const [small, setSmall] = useState(false), [reduce, setReduce] = useState(false)
  useEffect(() => {
    const a = matchMedia('(max-width: 760px)'), b = matchMedia('(prefers-reduced-motion: reduce)')
    const f = () => { setSmall(a.matches); setReduce(b.matches) }; f()
    a.addEventListener('change', f); b.addEventListener('change', f)
    return () => { a.removeEventListener('change', f); b.removeEventListener('change', f) }
  }, [])
  const move = (e: React.PointerEvent) => {
    if (reduce || e.pointerType === 'touch' || !wrap.current) return
    const r = wrap.current.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5
    wrap.current.style.transform = `perspective(1100px) rotateY(${x * 7}deg) rotateX(${-y * 5}deg)`
  }
  const leave = () => { if (wrap.current) wrap.current.style.transform = '' }
  const paths = ['M221 352H258V228H290', 'M221 352H290', 'M221 352H258V506H290']
  return (<div className="art" onPointerMove={move} onPointerLeave={leave}><div className="tilt" ref={wrap}>
    <svg className={'bp' + (small ? ' sm' : '')} viewBox={small ? '0 40 735 650' : '0 0 900 700'} role="img" aria-label="Isometric blueprint of an Amazon EKS cluster: users reach an application load balancer, which routes traffic to worker nodes and pods in three subnets, one per availability zone, inside one VPC.">
      <defs>
        <pattern id="gr" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0V26" fill="none" style={{ stroke: 'var(--line)', strokeOpacity: .14 }} /></pattern>
        <pattern id="dg" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="14" style={{ stroke: 'var(--line)', strokeOpacity: .13 }} /></pattern>
        <marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" className="mk" /></marker>
      </defs>
      {/* VPC slab */}
      <polygon className="vpcf" points="83,190 504,62 717,140 717,560 328,655 83,565" />
      <polygon className="vpc2" points="83,164 504,36 717,114 717,534 328,629 83,539" />
      {[[83, 190, 83, 164], [504, 62, 504, 36], [717, 140, 717, 114]].map((l, i) => <line key={i} className="vpc2" x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} />)}
      <polygon className="vpc" points="83,190 504,62 717,140 717,560 328,655 83,565" />
      {/* subnets */}
      {ROWS.map((r, i) => (<g key={i}>
        <rect className="sub" x="297" y={r.y} width="389" height="100" rx="14" />
        <g className="lock" transform={`translate(311 ${r.y + 16})`}><rect x="0" y="6" width="11" height="8" rx="1.5" /><path d="M2.5 6V4a3 3 0 0 1 6 0v2" /></g>
        <text x="335" y={r.y + 24} className="s12">Subnet ({r.az})</text>
        <text x="335" y={r.y + 44} className="s14 b">{r.z}</text>
        <text x="335" y={r.y + 64} className="s11 mn dim">{r.c}</text>
      </g>))}
      {/* worker nodes and pods */}
      {ROWS.map((r, i) => TX.map((tx, j) => (
        <Cube key={i + '-' + j} tx={tx} ty={r.ty} style={{ animationDelay: `${(i * 2 + j) * 0.12 + 0.2}s` }}>
          <K8s x={tx + 24} y={r.ty + 42} />
          <Cube tx={tx - 26} ty={r.ty + 52} s={22} cls="pod" />
          <Cube tx={tx + 10} ty={r.ty + 62} s={22} cls={'pod' + (i === 1 && j === 1 ? ' hl' : '')} />
        </Cube>)))}
      {/* users, ALB, flows */}
      <g className="usr"><circle cx="36" cy="332" r="7" /><circle cx="14" cy="339" r="5" /><circle cx="58" cy="339" r="5" />
        <path d="M22 372q0-22 14-22t14 22zM6 370q0-14 8-14M66 370q0-14-8-14" /></g>
      <text x="36" y="396" textAnchor="middle" className="s13">Users</text>
      <path className="flowp" d="M70 352H140" markerEnd="url(#ar)" />
      <polygon className="alb" points={[0, 1, 2, 3, 4, 5].map(i => { const a = (-90 + 60 * i) * Math.PI / 180; return `${183 + 44 * Math.cos(a)},${352 + 44 * Math.sin(a)}` }).join(' ')} />
      <g className="albi"><rect x="175" y="332" width="16" height="12" rx="1.5" /><path d="M183 344v8M165 354h36M165 354v6M183 354v6M201 354v6" />
        <rect x="157" y="360" width="16" height="11" rx="1.5" /><rect x="175" y="360" width="16" height="11" rx="1.5" /><rect x="193" y="360" width="16" height="11" rx="1.5" /></g>
      <text x="183" y="422" textAnchor="middle" className="s14 b">Application</text>
      <text x="183" y="440" textAnchor="middle" className="s14 b">Load Balancer</text>
      <text x="183" y="458" textAnchor="middle" className="s14 b">(ALB)</text>
      {paths.map((d, i) => <path key={i} className="flowp" d={d} markerEnd="url(#ar)" />)}
      {!reduce && paths.map((d, i) => <circle key={i} r="3.5" className="pk"><animateMotion dur="2.8s" begin={`${i * 0.6}s`} repeatCount="indefinite" path={d} /></circle>)}
      {/* EKS badge */}
      <g><polygon className="badge" points={[0, 1, 2, 3, 4, 5].map(i => { const a = (-90 + 60 * i) * Math.PI / 180; return `${140 + 25 * Math.cos(a)},${585 + 25 * Math.sin(a)}` }).join(' ')} />
        <text x="140" y="593" textAnchor="middle" className="s22 b kk">K</text><text x="178" y="593" className="s22 b">Amazon EKS</text></g>
      {!small && <g className="co">
        <Box x="44" y="60" w="192" h="58" /><text x="62" y="100" className="aws">aws</text><text x="122" y="85" className="s16 b">Amazon EKS</text><text x="122" y="105" className="s14">(Kubernetes)</text>
        <path className="lead" d="M236 118L262 160" /><Dot x="262" y="160" />
        <Box x="590" y="15" w="140" h="53" /><path className="cloud" d="M610 52a6 6 0 0 1-.5-12 8 8 0 0 1 15 1.5 5 5 0 0 1 .5 10.5z" />
        <text x="640" y="36" className="s16 b">VPC</text><text x="640" y="55" className="s12 mn dim">10.0.0.0/16</text>
        <path className="lead" d="M600 68L566 104" /><Dot x="566" y="104" />
        <Box x="747" y="98" w="139" h="72" amber /><text x="758" y="120" className="s14 b">Worker Node</text><text x="758" y="138" className="s12 mn">(node group:</text><text x="758" y="155" className="s12 mn">my-worker-node)</text>
        <path className="lead am" d="M747 118L654 206" /><Dot x="654" y="206" amber />
        <Box x="747" y="257" w="144" h="93" amber /><text x="758" y="278" className="s15 b">Pod</text><text x="758" y="295" className="s11 mn">(Assignment Portal)</text>
        <text x="758" y="313" className="s11 mn">• ReplicaSet: 2</text><text x="758" y="331" className="s11 mn">• Auto Scaled (HPA)</text>
        <path className="lead am" d="M747 300L631 396" /><Dot x="631" y="396" amber />
        <Box x="730" y="412" w="162" h="178" /><text x="748" y="434" className="s14 b">Legend</text><line className="lead" x1="748" y1="442" x2="872" y2="442" />
        <rect className="sub lg" x="748" y="457" width="26" height="11" rx="2" /><text x="782" y="467" className="s11">VPC</text>
        <rect className="sub lg" x="748" y="485" width="26" height="11" rx="2" /><text x="782" y="495" className="s11">Subnet (AZ)</text>
        <Cube tx={761} ty={516} s={14} cls="lgc" /><text x="782" y="523" className="s11">Worker Node (EC2)</text>
        <Cube tx={761} ty={545} s={10} cls="pod lgc" /><text x="782" y="551" className="s11">Pod (Container)</text>
        <path className="flowp" d="M748 574H774" markerEnd="url(#ar)" /><text x="782" y="578" className="s11">Traffic Flow</text>
      </g>}
    </svg></div></div>)
}
