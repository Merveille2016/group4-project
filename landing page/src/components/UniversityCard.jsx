import { Link } from 'react-router-dom'
import { PinIcon } from './Icons'
import universities from '../data/universities'

const colors = ['blue', 'navy', 'green', 'orange', 'teal', 'purple']

// Based on the position in the full list so a school keeps its colour on every page
function colorFor(university) {
  return colors[universities.indexOf(university) % colors.length]
}

export function UniversityLogo({ university, large }) {
  const long = university.short.length > 5
  return (
    <div className={`university-logo ${colorFor(university)} ${long ? 'long' : ''} ${large ? 'large' : ''}`}>
      {university.short}
    </div>
  )
}

function UniversityCard({ university }) {
  const courseCount = university.departments.reduce((n, d) => n + d.courses.length, 0)

  return (
    <Link className="university-card" to={`/universities/${university.slug}`}>
      <UniversityLogo university={university} />
      <div className="university-info">
        <div className="card-badges">
          <span className="badge private">Private</span>
          <span className="badge region">{university.city}</span>
        </div>
        <h3>{university.name}</h3>
        <p className="card-location"><PinIcon /> {university.location}</p>
        <p className="card-meta">{university.departments.length} departments · {courseCount} courses</p>
        <span className="card-link">View details <span>→</span></span>
      </div>
    </Link>
  )
}

export default UniversityCard
