import { useState } from 'react'
import './App.css'

// These records are rendered into the university cards below.
// Replace this local data with an API response when the platform backend is connected.
const universities = [
  { name: 'University of Buea', location: 'Buea, Southwest Region', type: 'Public', mark: 'UB', color: 'blue' },
  { name: 'University of Yaoundé I', location: 'Yaoundé, Centre Region', type: 'Public', mark: 'UY1', color: 'navy' },
  { name: 'Catholic University of Cameroon', location: 'Bamenda, Northwest Region', type: 'Private', mark: 'CATUC', color: 'green' },
]

// Each quick link points students to the related discovery section on this page.
const quickLinks = [
  { title: 'Explore Universities', text: 'Discover public and private universities.', icon: '⌂' },
  { title: 'Discover Programmes', text: 'Find programmes that match your interests.', icon: '▤' },
  { title: 'Check Admission', text: 'Understand admission requirements.', icon: '✓' },
  { title: 'Official Links', text: 'Access official university portals.', icon: '↗' },
]

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
}

function GraduationCap() {
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="m3 12 13-6 13 6-13 6L3 12Z" /><path d="M8 15v6c4 3 12 3 16 0v-6M29 12v8" /></svg>
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)

  // Temporary action handler for buttons and links that will later connect to real flows.
  const handleAction = (label) => console.log(`${label} clicked`)

  return (
    <div className="app">
      {/* Sticky navigation keeps the core discovery actions available at every scroll position. */}
      <header className="navbar">
        <a className="brand" href="#" aria-label="UniGuide Cameroon home">
          <span className="brand-icon"><GraduationCap /></span>
          <span><strong>UniGuide</strong> <b>Cameroon</b></span>
        </a>
        {/* Hash links connect the navbar directly to the matching section IDs below. */}
        <nav className={`nav-links ${menuOpen ? 'open' : ''}`}>
          <a className="active" href="#home" onClick={() => setMenuOpen(false)}>Home</a>
          <a href="#universities" onClick={() => setMenuOpen(false)}>Universities</a>
          <a href="#programmes" onClick={() => setMenuOpen(false)}>Programmes</a>
          <a href="#about" onClick={() => setMenuOpen(false)}>About</a>
          <a className="mobile-login" href="#" onClick={() => handleAction('Login')}>Login</a>
        </nav>
        <a className="login-button" href="#" onClick={() => handleAction('Login')}>Login <span>→</span></a>
        <button className={`menu-toggle ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation" aria-expanded={menuOpen}><i /><i /><i /></button>
      </header>

      <main>
        {/* The search currently logs its query action; connect this submit handler to search results later. */}
        <section className="hero" id="home">
          <div className="hero-overlay" />
          <div className="hero-content">
            <p className="eyebrow light">Your future starts here</p>
            <h1>Find Your University<br /><span>in Cameroon</span></h1>
            <p className="hero-description">Explore universities, academic programmes, admission requirements and official application links — all in one place.</p>
            <form className="search-bar" onSubmit={(event) => { event.preventDefault(); handleAction('Search') }}>
              <SearchIcon /><input aria-label="Search universities" placeholder="Search for a university, programme or location..." /><button type="submit">Search</button>
            </form>
            <p className="search-hint">Popular searches: <a href="#universities">University of Buea</a> <a href="#programmes">Computer Science</a> <a href="#universities">Yaoundé</a></p>
          </div>
        </section>

        {/* Feature cards link into the university discovery area as the shared next step. */}
        <section className="quick-access" id="programmes">
          <div className="section-intro"><p className="eyebrow">Start exploring</p><h2>Everything you need<br /><span>to make the right choice.</span></h2></div>
          <div className="feature-grid">
            {quickLinks.map((item) => <a className="feature-card" href="#universities" key={item.title}><span className="feature-icon">{item.icon}</span><h3>{item.title}</h3><p>{item.text}</p><span className="card-arrow">→</span></a>)}
          </div>
        </section>

        {/* University cards are generated from the universities array for consistent markup. */}
        <section className="universities-section" id="universities">
          <div className="section-heading"><div><p className="eyebrow">Discover your options</p><h2>Popular Universities</h2></div><a className="view-all" href="#universities">View all universities <span>→</span></a></div>
          <div className="university-grid">
            {universities.map((university) => <article className="university-card" key={university.name}><div className={`university-logo ${university.color}`}>{university.mark}</div><div className="university-info"><span className={`badge ${university.type.toLowerCase()}`}>{university.type}</span><h3>{university.name}</h3><p><span>⌖</span> {university.location}</p><a href="#" onClick={() => handleAction(`View ${university.name}`)}>View Details <span>→</span></a></div></article>)}
          </div>
        </section>

        {/* This section is the destination for the About links in the navbar and footer. */}
        <section className="about-section" id="about">
          <div className="about-illustration"><div className="circle circle-back" /><div className="circle circle-front"><GraduationCap /></div><span className="pill pill-top">10,000+ students</span><span className="pill pill-bottom">Verified information</span></div>
          <div className="about-copy"><p className="eyebrow">Why UniGuide?</p><h2>Your journey to higher education, <span>made simpler.</span></h2><p>We bring trusted, up-to-date university information together so you can make confident decisions about your future. Compare options, discover opportunities, and take your next step.</p><a className="outline-button" href="#" onClick={() => handleAction('Learn more')}>Learn more about us <span>→</span></a></div>
        </section>
      </main>

      {/* Footer links reuse the same section anchors and placeholder actions as the main UI. */}
      <footer className="footer">
        <div className="footer-main"><div className="footer-brand"><a className="brand" href="#"><span className="brand-icon"><GraduationCap /></span><span><strong>UniGuide</strong> <b>Cameroon</b></span></a><p>Helping students find their path<br />to a brighter future.</p><div className="socials"><a href="#" aria-label="Facebook">f</a><a href="#" aria-label="Instagram">◎</a><a href="#" aria-label="LinkedIn">in</a></div></div><div className="footer-column"><h3>Explore</h3><a href="#universities">Universities</a><a href="#programmes">Programmes</a><a href="#about">Admission Guide</a></div><div className="footer-column"><h3>Company</h3><a href="#about">About us</a><a href="#">Contact</a><a href="#">Partner with us</a></div><div className="footer-column contact"><h3>Get in touch</h3><a href="mailto:hello@uniguide.cm">hello@uniguide.cm</a><span>Yaoundé, Cameroon</span></div></div>
        <div className="footer-bottom"><span>© 2026 UniGuide Cameroon. All rights reserved.</span><span><a href="#">Privacy Policy</a> <a href="#">Terms of Use</a></span></div>
      </footer>
    </div>
  )
}

export default App
