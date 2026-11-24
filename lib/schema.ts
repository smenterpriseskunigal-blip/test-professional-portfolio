export type F = { k: string; l: string; area?: boolean; t?: 'url' | 'photo' | 'email' | 'phone' }
export const SECTIONS: Record<string, { label: string; single?: boolean; fields: F[] }> = {
  profile: { label: 'Profile', single: true, fields: [
    { k: 'name', l: 'Full name' }, { k: 'headline', l: 'Role / headline' }, { k: 'tagline', l: 'Hero tagline (typed effect)' }, { k: 'stats', l: 'Hero stats (one per line: value|label)', area: true }, { k: 'summary', l: 'Summary', area: true },
    { k: 'photo', t: 'photo', l: 'Photo URL (e.g. /profile.jpg after adding the file to the public folder)' }, { k: 'availability', l: 'Availability badge (e.g. Available for opportunities)' }, { k: 'email', t: 'email', l: 'Email' }, { k: 'phone', t: 'phone', l: 'Phone' }, { k: 'location', l: 'Location' },
    { k: 'linkedin', t: 'url', l: 'LinkedIn URL' }, { k: 'github', t: 'url', l: 'GitHub URL' }] },
  experience: { label: 'Experience', fields: [
    { k: 'role', l: 'Role' }, { k: 'company', l: 'Company' }, { k: 'dates', l: 'Dates (Mon YYYY – Mon YYYY)' },
    { k: 'bullets', l: 'Achievements (one per line, start with a verb, add numbers)', area: true }, { k: 'tech', l: 'Tech (comma separated)' }] },
  skills: { label: 'Skills', fields: [{ k: 'category', l: 'Category' }, { k: 'items', l: 'Skills (comma separated)' }] },
  projects: { label: 'Projects', fields: [
    { k: 'name', l: 'Name' }, { k: 'summary', l: 'Summary', area: true }, { k: 'tech', l: 'Tech (comma separated)' }, { k: 'link', t: 'url', l: 'Link' }] },
  education: { label: 'Education', fields: [{ k: 'degree', l: 'Degree' }, { k: 'school', l: 'Institution' }, { k: 'years', l: 'Years' }] },
  certifications: { label: 'Certifications', fields: [{ k: 'name', l: 'Name' }, { k: 'issuer', l: 'Issuer' }, { k: 'date', l: 'Date (Mon YYYY)' }, { k: 'url', t: 'url', l: 'Credential URL' }] },
  achievements: { label: 'Achievements', fields: [{ k: 'title', l: 'Title' }, { k: 'detail', l: 'Detail', area: true }] },
  volunteering: { label: 'Volunteering', fields: [{ k: 'org', l: 'Organisation' }, { k: 'role', l: 'Role' }, { k: 'detail', l: 'Impact', area: true }] },
}
