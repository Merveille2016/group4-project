import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Login.css'; 

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', { email, password });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.admin));
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="logo-box"></div>
        <h2>Welcome back</h2>
        <p className="subtitle">Please enter your details to sign in to your account.</p>
        
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          
          <div className="form-group">
            <label>Password</label>
            <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <a href="#" className="forgot-password">Forgot password?</a>

          <button type="submit" className="sign-in-btn">Sign in</button>
        </form>

        <div className="footer-text">
          Don't have an account? <a href="#">Sign up</a>
        </div>
      </div>
    </div>
  );
};
export default Login;