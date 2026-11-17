import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { GraduationCap } from './Icons'
import useActiveSection from '../hooks/useActiveSection'
import { useAuth } from '../auth/AuthContext'
import { firstName } from '../utils/name'

const links = [
  { id: 'home', label: 'Home' },
  { id: 'universities', label: 'Universities' },
  { id: 'programmes', label: 'Programmes' },
  { id: 'about', label: 'About' },
]
const sectionIds = links.map((l) => l.id)

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname, search } = useLocation()
  const { user, checking, logout } = useAuth()
  const onHome = pathname === '/'
  const scrolled = useActiveSection(sectionIds, onHome)

  // On a university page there are no sections to track, so keep "Universities" lit
  let active = null
  if (onHome) active = scrolled
  else if (pathname.startsWith('/universities')) active = 'universities'
  else if (pathname === '/dashboard') active = 'dashboard'

  // Don't send people back to the auth pages after they sign in
  const onAuthPage = pathname === '/login' || pathname === '/signup'
  const loginState = onAuthPage ? undefined : { from: pathname + search }

  function handleLogout() {
    logout()
    setMenuOpen(false)
  }

  return (
    <header className="navbar">
      <Link className="brand" to="/" aria-label="UniGuide Cameroon home">
        <span className="brand-icon"><GraduationCap /></span>
        <span><strong>UniGuide</strong> <b>Cameroon</b></span>
      </Link>

      <nav className={`nav-links ${menuOpen ? 'open' : ''}`}>
        {links.map((link) => (
          <Link
            key={link.id}
            to={{ pathname: '/', hash: link.id === 'home' ? '' : `#${link.id}` }}
            className={active === link.id ? 'active' : undefined}
            aria-current={active === link.id ? 'page' : undefined}
            onClick={() => setMenuOpen(false)}
          >
            {link.label}
          </Link>
        ))}
        {/* Everyone logged in sees this for now; limit it to admins once the backend has a student role */}
        {user && (
          <Link
            to="/dashboard"
            className={active === 'dashboard' ? 'active' : undefined}
            aria-current={active === 'dashboard' ? 'page' : undefined}
            onClick={() => setMenuOpen(false)}
          >
            Dashboard
          </Link>
        )}
        {checking ? null : user ? (
          <button type="button" className="mobile-login" onClick={handleLogout}>Logout</button>
        ) : (
          <>
            <Link className="mobile-login" to="/login" state={loginState} onClick={() => setMenuOpen(false)}>Login</Link>
            <Link className="mobile-login" to="/signup" state={loginState} onClick={() => setMenuOpen(false)}>Sign up</Link>
          </>
        )}
      </nav>

      {checking ? null : user ? (
        <div className="account">
          <span className="account-email" title={user.name ? `${user.name} (${user.email})` : user.email}>{firstName(user.name) || user.email}</span>
          <button type="button" className="login-button" onClick={handleLogout}>Logout</button>
        </div>
      ) : (
        <div className="account">
          <Link className="signup-link" to="/signup" state={loginState}>Sign up</Link>
          <Link className="login-button" to="/login" state={loginState}>Login <span>→</span></Link>
        </div>
      )}
      <button
        className={`menu-toggle ${menuOpen ? 'open' : ''}`}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle navigation"
        aria-expanded={menuOpen}
      >
        <i /><i /><i />
      </button>
    </header>
  )
}

export default Navbar
