import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AuthError, dashboardRequest } from '../api'
import DeleteAccount from '../components/DeleteAccount'
import TwoFactorSettings from '../components/TwoFactorSettings'
import universities from '../data/universities'
import programmes from '../data/programmes'
import './Dashboard.css'
import { firstName } from '../utils/name'

const totalDepartments = universities.reduce((n, u) => n + u.departments.length, 0)
const totalCourses = universities.reduce((n, u) => n + u.departments.reduce((m, d) => m + d.courses.length, 0), 0)

function Dashboard() {
  const { user, logout, backupCodesLeft } = useAuth()
  const [status, setStatus] = useState({ loading: true, error: '', message: '' })

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  useEffect(() => {
    let cancelled = false

    dashboardRequest()
      .then((data) => {
        if (!cancelled) setStatus({ loading: false, error: '', message: data.message })
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof AuthError) {
          logout('expired')
        } else {
          setStatus({ loading: false, error: err.message, message: '' })
        }
      })

    return () => { cancelled = true }
  }, [logout])

  return (
    <main className="dashboard">
      <section className="dashboard-hero">
        <p className="eyebrow light">Dashboard</p>
        <h1>Welcome back{user.name ? `, ${firstName(user.name)}` : ''}!</h1>
        <p className="dashboard-sub">Logged in as <strong>{user.email}</strong></p>
      </section>

      <div className="dashboard-body">
        {backupCodesLeft !== undefined && (
          <p className="dashboard-notice" role="status">
            You signed in with a backup code. You have {backupCodesLeft} left.
            {backupCodesLeft < 3 && ' Create new ones below, or turn two factor authentication off and on again if you lost your phone.'}
          </p>
        )}

        <div className="dashboard-grid">
          <section className="panel">
            <h2>Your account</h2>
            <dl className="account-list">
              <div><dt>Name</dt><dd>{user.name || <span className="muted">Not set</span>}</dd></div>
              <div><dt>Email</dt><dd>{user.email}</dd></div>
              <div><dt>Role</dt><dd><span className="role-badge">{user.role}</span></dd></div>
              <div>
                <dt>Server check</dt>
                <dd>
                  {status.loading && <span className="status pending"><span className="dot" /> Checking...</span>}
                  {status.message && <span className="status ok"><span className="dot" /> Session verified</span>}
                  {status.error && <span className="status bad"><span className="dot" /> {status.error}</span>}
                </dd>
              </div>
            </dl>
          </section>

          <section className="panel">
            <h2>Directory at a glance</h2>
            <div className="stat-grid">
              <div><strong>{universities.length}</strong><span>Schools</span></div>
              <div><strong>{totalDepartments}</strong><span>Departments</span></div>
              <div><strong>{totalCourses}</strong><span>Courses</span></div>
              <div><strong>{programmes.length}</strong><span>Fields of study</span></div>
            </div>
          </section>
        </div>

        <section className="panel">
          <div className="panel-heading">
            <h2>All schools</h2>
            <Link to="/#universities">Open on the site →</Link>
          </div>
          <div className="table-wrap">
            <table className="school-table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Town</th>
                  <th>Departments</th>
                  <th>Website</th>
                </tr>
              </thead>
              <tbody>
                {universities.map((u) => (
                  <tr key={u.slug}>
                    <td>
                      <Link to={`/universities/${u.slug}`}>
                        <strong>{u.short}</strong>
                        <span>{u.name}</span>
                      </Link>
                    </td>
                    <td>{u.city}</td>
                    <td>{u.departments.length}</td>
                    <td>
                      {u.website
                        ? <a href={u.website} target="_blank" rel="noreferrer">Visit ↗</a>
                        : <span className="muted">{u.websiteNote}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <TwoFactorSettings />

        <DeleteAccount />
      </div>
    </main>
  )
}

export default Dashboard
