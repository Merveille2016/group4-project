import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import universities, { findUniversity } from '../data/universities'
import programmes, { offersField } from '../data/programmes'
import UniversityCard, { UniversityLogo } from '../components/UniversityCard'
import { BuildingIcon, GlobeIcon, PhoneIcon, PinIcon } from '../components/Icons'
import './University.css'

function University() {
  const { slug } = useParams()
  const university = findUniversity(slug)

  useEffect(() => {
    const previousTitle = document.title
    window.scrollTo({ top: 0, behavior: 'instant' })
    document.title = university ? `${university.short} — UniGuide Cameroon` : 'School not found — UniGuide Cameroon'
    return () => { document.title = previousTitle }
  }, [university])

  if (!university) {
    return (
      <main className="not-found">
        <h1>We couldn’t find that school</h1>
        <p>The link may be wrong, or the school isn’t listed yet.</p>
        <Link className="back-button" to="/#universities">← Back to all universities</Link>
      </main>
    )
  }

  const courseCount = university.departments.reduce((n, d) => n + d.courses.length, 0)
  const fields = programmes.filter((p) => offersField(university, p))
  const nearby = universities
    .filter((u) => u.city === university.city && u.slug !== university.slug)
    .slice(0, 3)

  return (
    <main className="school-page">
      <section className="school-hero">
        <div className="school-hero-inner">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span>/</span>
            <Link to="/#universities">Universities</Link>
            <span>/</span>
            <span aria-current="page">{university.short}</span>
          </nav>

          <div className="school-title">
            <UniversityLogo university={university} large />
            <div>
              <div className="card-badges">
                <span className="badge private">Private</span>
                <span className="badge light">{university.city} · {university.region} Region</span>
              </div>
              <h1>{university.name}</h1>
              {university.altName && <p className="alt-name">{university.altName}</p>}
            </div>
          </div>

          <dl className="school-stats">
            <div><dt>{university.departments.length}</dt><dd>Departments</dd></div>
            <div><dt>{courseCount}</dt><dd>Courses</dd></div>
            <div><dt>{fields.length}</dt><dd>Fields of study</dd></div>
          </dl>
        </div>
      </section>

      <div className="school-body">
        <section className="departments" aria-labelledby="departments-title">
          <h2 id="departments-title">Departments &amp; courses</h2>
          {university.departments.map((dept) => (
            <article className="department" key={dept.name}>
              <header>
                <h3>{dept.name}</h3>
                <span>{dept.courses.length} {dept.courses.length === 1 ? 'course' : 'courses'}</span>
              </header>
              <ul>
                {dept.courses.map((course) => <li key={course}>{course}</li>)}
              </ul>
            </article>
          ))}
        </section>

        <aside className="school-sidebar">
          <div className="info-card">
            <h2>School information</h2>
            <dl>
              <div>
                <dt><PinIcon /> Location</dt>
                <dd>{university.location}</dd>
              </div>
              <div>
                <dt><BuildingIcon /> Other campuses</dt>
                <dd>{university.branches || <span className="muted">None listed</span>}</dd>
              </div>
              <div>
                <dt><GlobeIcon /> Website</dt>
                <dd>
                  {university.website
                    ? <a href={university.website} target="_blank" rel="noreferrer">{university.website.replace(/^https?:\/\/(www\.)?/, '')}</a>
                    : <span className="muted">{university.websiteNote}</span>}
                </dd>
              </div>
              <div>
                <dt><PhoneIcon /> Phone</dt>
                <dd>
                  {university.phone
                    ? university.phone.split(' / ').map((num) => (
                        <a key={num} href={`tel:${num.replace(/\([^)]*[a-z][^)]*\)/gi, '').replace(/[^\d+]/g, '')}`}>{num}</a>
                      ))
                    : <span className="muted">Not listed</span>}
                </dd>
              </div>
            </dl>
            {university.website && (
              <a className="visit-button" href={university.website} target="_blank" rel="noreferrer">Visit official website ↗</a>
            )}
          </div>

          <div className="info-card">
            <h2>Fields of study</h2>
            <div className="field-tags">
              {fields.map((f) => (
                <Link key={f.id} to={`/?field=${f.id}#universities`}>{f.title}</Link>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {nearby.length > 0 && (
        <section className="nearby">
          <div className="nearby-inner">
            <h2>Other schools in {university.city}</h2>
            <div className="university-grid">
              {nearby.map((u) => <UniversityCard key={u.slug} university={u} />)}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

export default University
