import { db } from './db'
// Fallback text shown ONLY for sections that have no row in the "Content" table yet. Real data always wins.
export const DEFAULTS: Record<string, any> = {
  profile: { name: 'Yashwanth Gowda M', headline: 'DevOps / Cloud / Kubernetes Engineer', tagline: 'Automating, Scaling and Operating Reliable Applications on the Cloud.', stats: '5+|Years Experience\n40+|Projects\n25+|Tech & Tools\n100%|Cloud-Native Focus', photo: '', availability: '', summary: 'Placeholder: DevOps engineer building and operating Kubernetes platforms on AWS, with CI/CD, Helm and disaster-recovery-first delivery.', email: '', phone: '', location: '', linkedin: '', github: '' },
  experience: [{ role: 'DevOps Engineer', company: 'Company (placeholder)', dates: 'Jan 2023 – Present', bullets: 'Upgraded Amazon EKS clusters across 3 Kubernetes minor versions with zero downtime\nBuilt CI/CD pipelines with GitHub Actions and Helm', tech: 'Amazon EKS, Kubernetes, Helm, GitHub Actions, Terraform' }],
  skills: [{ category: 'Cloud', items: 'AWS, Amazon EKS, EC2, VPC, IAM' }, { category: 'Kubernetes', items: 'Kubernetes, Helm, Docker' }, { category: 'CI/CD', items: 'GitHub Actions, CI/CD, Trivy' }],
  projects: [
    { name: 'EKS upgrade runbook', summary: 'Backup and upgrade of my-eks-cluster from Kubernetes 1.34 to 1.36 on us-east-1.', tech: 'Amazon EKS, Kubernetes', link: '' },
    { name: 'MyURLs dashboard', summary: 'URL dashboard deployed with Docker and GitHub Actions to a personal VM, with a Trivy security gate.', tech: 'Docker, GitHub Actions, Trivy', link: '' },
    { name: 'GemFire on Kubernetes', summary: 'Tanzu GemFire platform with Helm and a disaster-recovery-first CI/CD flow.', tech: 'GemFire, Helm, Kubernetes', link: '' }],
  education: [{ degree: 'Degree (placeholder)', school: 'Institution', years: 'YYYY – YYYY' }],
  certifications: [], achievements: [], volunteering: [],
}
export async function getContent(includeHidden = false): Promise<Record<string, any>> {
  const out = { ...DEFAULTS }
  try {
    for (const r of await db.content.findMany()) out[r.key] = r.data
  } catch (e) {
    console.error('getContent: reading "Content" from the database failed:', (e as Error)?.message)
    // Admin views must never show fallback text as if it were real data (saving it would overwrite the real rows).
    if (includeHidden) throw e
    // Public pages stay up, but the error above is always logged.
  }
  if (!includeHidden) for (const k of Object.keys(out)) if (Array.isArray(out[k])) out[k] = out[k].filter((x: any) => !x?.hidden)
  return out
}
export const stripMarks = (o: any): any => typeof o === 'string' ? o.replace(/==|\*\*/g, '').replace(/^#\s+/gm, '') : Array.isArray(o) ? o.map(stripMarks) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, stripMarks(v)])) : o
export const lines = (s = '') => s.split('\n').map(x => x.trim()).filter(Boolean)
export const csv = (s = '') => s.split(',').map(x => x.trim()).filter(Boolean)
