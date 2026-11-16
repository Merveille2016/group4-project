import universities from './universities'

// A school counts for a field if a department name or course has a word starting
// with one of the keywords. `exclude` removes phrases that would give false matches
// (e.g. "software engineering" shouldn't make a school count as Engineering).
// Keep everything lowercase and accent-free.
const fields = [
  { id: 'computing', title: 'Computing & ICT', icon: '⌨', keywords: ['computer', 'software', 'ict', 'information technology', 'information system', 'network', 'cyber', 'data', 'web', 'telecom', 'computing'] },
  { id: 'engineering', title: 'Engineering', icon: '⚙', keywords: ['engineering', 'polytechnic', 'electrotechnics', 'mechatronics', 'architecture', 'public works', 'mining', 'maintenance'], exclude: ['software engineering'] },
  { id: 'health', title: 'Health Sciences', icon: '✚', keywords: ['health', 'nursing', 'midwifery', 'medical', 'medicine', 'pharmac', 'laboratory', 'physiotherapy', 'paramedical', 'clinical', 'dental'], exclude: ['health informatics'] },
  { id: 'business', title: 'Business & Management', icon: '▲', keywords: ['business', 'management', 'accounting', 'accountancy', 'banking', 'finance', 'marketing', 'commerce', 'mba', 'logistics', 'insurance', 'trade'] },
  { id: 'law', title: 'Law & Political Science', icon: '§', keywords: ['law', 'legal', 'political', 'international relations', 'customs'] },
  { id: 'education', title: 'Education', icon: '✎', keywords: ['education', 'pedagogy', 'psychopedagogy', 'teaching'] },
  { id: 'agriculture', title: 'Agriculture & Food', icon: '❀', keywords: ['agricult', 'agro', 'food science', 'food technology', 'food processing', 'food industry', 'livestock', 'animal production', 'aquaculture', 'veterinary', 'forestry'] },
  { id: 'communication', title: 'Communication & Media', icon: '◉', keywords: ['communication', 'journalism', 'media', 'advertising', 'audiovisual', 'public relations'], exclude: ['data communication', 'information and communication'] },
  { id: 'theology', title: 'Theology & Philosophy', icon: '✦', keywords: ['theology', 'philosophy', 'religious', 'biblical', 'canon law'] },
  { id: 'hospitality', title: 'Tourism, Arts & Hospitality', icon: '✧', keywords: ['tourism', 'hotel', 'hospitality', 'arts', 'fashion', 'culinary', 'home economics'] },
]

export function normalize(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function schoolText(u) {
  return normalize(u.departments.flatMap((d) => [d.name, ...d.courses]).join(' | '))
}

export function offersField(university, field) {
  let text = schoolText(university)
  for (const phrase of field.exclude || []) text = text.replaceAll(phrase, '')
  return field.keywords.some((k) => new RegExp(`\\b${k}`).test(text))
}

export function searchUniversities(list, query) {
  const q = normalize(query.trim())
  if (!q) return list

  return list.filter((u) => {
    const haystack = normalize([u.name, u.altName, u.short, u.city, u.region, u.location, u.branches].filter(Boolean).join(' '))
    return haystack.includes(q) || schoolText(u).includes(q)
  })
}

const programmes = fields.map((field) => ({
  ...field,
  schools: universities.filter((u) => offersField(u, field)),
}))

export default programmes
