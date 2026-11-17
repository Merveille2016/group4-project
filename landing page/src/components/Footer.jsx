import { Link } from 'react-router-dom'
import { GraduationCap } from './Icons'

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link className="brand" to="/">
            <span className="brand-icon"><GraduationCap /></span>
            <span><strong>UniGuide</strong> <b>Cameroon</b></span>
          </Link>
          <p>Helping students find their path<br />to a brighter future.</p>
          <div className="socials">
            <a href="#" aria-label="Facebook">f</a>
            <a href="#" aria-label="Instagram">◎</a>
            <a href="#" aria-label="LinkedIn">in</a>
          </div>
        </div>
        <div className="footer-column">
          <h3>Explore</h3>
          <Link to="/#universities">Universities</Link>
          <Link to="/#programmes">Programmes</Link>
          <Link to="/#about">About UniGuide</Link>
        </div>
        <div className="footer-column">
          <h3>Regions</h3>
          <Link to="/?q=Yaoundé#universities">Yaoundé</Link>
          <Link to="/?q=Buea#universities">Buea</Link>
          <Link to="/?q=Douala#universities">Douala</Link>
          <Link to="/?q=Bamenda#universities">Bamenda</Link>
        </div>
        <div className="footer-column contact">
          <h3>Get in touch</h3>
          <a href="mailto:hello@uniguide.cm">hello@uniguide.cm</a>
          <span>Yaoundé, Cameroon</span>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 UniGuide Cameroon. All rights reserved.</span>
        <span><a href="#">Privacy Policy</a> <a href="#">Terms of Use</a></span>
      </div>
    </footer>
  )
}

export default Footer
