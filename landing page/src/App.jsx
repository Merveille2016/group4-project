import { Route, Routes } from 'react-router-dom'
import AuthProvider from './auth/AuthProvider'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import University from './pages/University'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import RequireAuth from './auth/RequireAuth'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <div className="app">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/universities/:slug" element={<University />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="*" element={<University />} />
        </Routes>
        <Footer />
      </div>
    </AuthProvider>
  )
}

export default App
