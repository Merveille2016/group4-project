import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import universities from '../data/universities'
import programmes, { offersField, searchUniversities } from '../data/programmes'
import UniversityCard from '../components/UniversityCard'
import { GraduationCap, SearchIcon } from '../components/Icons'

const PREVIEW_COUNT = 6

const regionFilters = [
  { id: 'all', label: 'All schools' },
  { id: 'yaounde', label: 'Yaoundé' },
  { id: 'other', label: 'Other regions' },
]

const quickLinks = [
  { title: 'Explore universities', text: `Browse ${universities.length} private universities and institutes.`, icon: '⌂', to: 'universities' },
  { title: 'Discover programmes', text: 'See which schools teach the field you want.', icon: '▤', to: 'programmes' },
  { title: 'Compare departments', text: 'Every school page lists its departments and courses.', icon: '✓', to: 'universities' },
  { title: 'Official links', text: 'Websites and phone numbers, straight from the source.', icon: '↗', to: 'universities' },
]

const totalDepartments = universities.reduce((n, u) => n + u.departments.length, 0)
const totalCities = new Set(universities.map((u) => u.city)).size

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

function Home() {
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') || ''
  const fieldId = params.get('field') || ''
  const region = params.get('region') || 'all'

  const [draft, setDraft] = useState(query)
  const [lastQuery, setLastQuery] = useState(query)
  const [showAll, setShowAll] = useState(false)

  // Keep the input in sync when the query changes from a link (footer, popular searches)
  if (query !== lastQuery) {
    setLastQuery(query)
    setDraft(query)
  }

  // Hash links (/#programmes etc.) can come from another page, so handle them after render.
  // Filter changes pass state.filter and do their own scrolling.
  useEffect(() => {
    if (location.state?.filter) return
    if (location.hash) {
      scrollToSection(location.hash.slice(1))
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [location.key, location.hash, location.state])

  function updateFilters(changes) {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([key, value]) => {
      if (value && value !== 'all') next.set(key, value)
      else next.delete(key)
    })
    setParams(next, { replace: true, state: { filter: true } })
    scrollToSection('universities')
  }

  function handleSearch(event) {
    event.preventDefault()
    updateFilters({ q: draft.trim() })
  }

  const field = programmes.find((p) => p.id === fieldId)

  let results = searchUniversities(universities, query)
  if (field) results = results.filter((u) => offersField(u, field))
  if (region === 'yaounde') results = results.filter((u) => u.city === 'Yaoundé')
  if (region === 'other') results = results.filter((u) => u.city !== 'Yaoundé')

  const filtering = query || field || region !== 'all'
  const visible = filtering || showAll ? results : results.slice(0, PREVIEW_COUNT)

  return (
    <main>
      <section className="hero" id="home">
        <div className="hero-overlay" />
        <div className="hero-content">
          <p className="eyebrow light">Your future starts here</p>
          <h1>Find Your University<br /><span>in Cameroon</span></h1>
          <p className="hero-description">Explore private universities, their departments, courses and official contacts, all in one place.</p>
          <form className="search-bar" onSubmit={handleSearch}>
            <SearchIcon />
            <input
              aria-label="Search universities"
              placeholder="Search for a university, course or town..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit">Search</button>
          </form>
          <p className="search-hint">
            Popular searches:
            {['Nursing', 'Software Engineering', 'Buea'].map((term) => (
              <button type="button" key={term} onClick={() => updateFilters({ q: term })}>{term}</button>
            ))}
          </p>
          <dl className="hero-stats">
            <div><dt>{universities.length}</dt><dd>Schools</dd></div>
            <div><dt>{totalDepartments}</dt><dd>Departments</dd></div>
            <div><dt>{totalCities}</dt><dd>Towns</dd></div>
          </dl>
        </div>
      </section>

      <section className="quick-access">
        <div className="section-intro">
          <p className="eyebrow">Start exploring</p>
          <h2>Everything you need<br /><span>to make the right choice.</span></h2>
        </div>
        <div className="feature-grid">
          {quickLinks.map((item) => (
            <a
              className="feature-card"
              href={`#${item.to}`}
              key={item.title}
              onClick={(e) => { e.preventDefault(); scrollToSection(item.to) }}
            >
              <span className="feature-icon">{item.icon}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <span className="card-arrow">→</span>
            </a>
          ))}
        </div>
      </section>

      <section className="universities-section" id="universities">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Discover your options</p>
            <h2>Universities &amp; institutes</h2>
          </div>
          <form className="inline-search" onSubmit={handleSearch}>
            <SearchIcon />
            <input
              aria-label="Filter universities"
              placeholder="Filter by name, course or town"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </form>
        </div>

        <div className="filter-bar">
          <div className="filter-tabs">
            {regionFilters.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={region === r.id}
                className={region === r.id ? 'selected' : undefined}
                onClick={() => updateFilters({ region: r.id })}
              >
                {r.label}
              </button>
            ))}
          </div>
          {(query || field) && (
            <div className="active-filters">
              {query && <span className="chip">“{query}” <button type="button" aria-label="Clear search" onClick={() => updateFilters({ q: '' })}>×</button></span>}
              {field && <span className="chip">{field.title} <button type="button" aria-label="Clear programme" onClick={() => updateFilters({ field: '' })}>×</button></span>}
            </div>
          )}
        </div>

        <p className="results-count">
          {filtering ? `${results.length} of ${universities.length} schools match` : `Showing ${visible.length} of ${universities.length} schools`}
        </p>

        {results.length > 0 ? (
          <div className="university-grid">
            {visible.map((u) => <UniversityCard key={u.slug} university={u} />)}
          </div>
        ) : (
          <div className="empty-state">
            <p>No school matches your search yet.</p>
            <button type="button" onClick={() => updateFilters({ q: '', field: '', region: 'all' })}>Clear filters</button>
          </div>
        )}

        {!filtering && results.length > PREVIEW_COUNT && (
          <button className="show-more" type="button" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Show fewer' : `Show all ${universities.length} schools`}
          </button>
        )}
      </section>

      <section className="programmes-section" id="programmes">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Fields of study</p>
            <h2>Find schools by programme</h2>
          </div>
          <p className="section-note">Pick a field to see every school that teaches it.</p>
        </div>
        <div className="programme-grid">
          {programmes.map((p) => (
            <button
              type="button"
              key={p.id}
              className={`programme-card ${fieldId === p.id ? 'selected' : ''}`}
              onClick={() => updateFilters({ field: fieldId === p.id ? '' : p.id })}
            >
              <span className="programme-icon">{p.icon}</span>
              <span className="programme-title">{p.title}</span>
              <span className="programme-count">{p.schools.length} schools</span>
              <span className="programme-schools">
                {p.schools.slice(0, 4).map((s) => s.short).join(' · ')}
                {p.schools.length > 4 && ` +${p.schools.length - 4}`}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="about-section" id="about">
        <div className="about-illustration">
          <div className="circle circle-back" />
          <div className="circle circle-front"><GraduationCap /></div>
          <span className="pill pill-top">{universities.length} schools listed</span>
          <span className="pill pill-bottom">Official contacts</span>
        </div>
        <div className="about-copy">
          <p className="eyebrow">Why UniGuide?</p>
          <h2>Your journey to higher education, <span>made simpler.</span></h2>
          <p>We bring university information together so you can make confident decisions about your future. See where each school is, what it teaches and how to reach it, then take your next step.</p>
          <a className="outline-button" href="#universities" onClick={(e) => { e.preventDefault(); scrollToSection('universities') }}>
            Start exploring <span>→</span>
          </a>
        </div>
      </section>
    </main>
  )
}

export default Home
