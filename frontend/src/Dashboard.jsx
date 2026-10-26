import { useNavigate } from 'react-router-dom';
import './Login.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  return (
    <div className="login-container">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <div className="logo-box" style={{ margin: '0 auto 20px auto' }}></div>
        <h2>Welcome back!</h2>
        <p className="subtitle">You have successfully logged into the admin panel.</p>
        <div style={{ background: '#f3f4f6', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
          <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>Logged in as:</p>
          <h3 style={{ margin: '5px 0', color: '#111' }}>{user?.email || 'Admin'}</h3>
          <p style={{ margin: '5px 0', fontSize: '12px', color: '#3b82f6', fontWeight: 'bold' }}>Role: {user?.role || 'Administrator'}</p>
        </div>
        <button onClick={handleLogout} className="sign-in-btn" style={{ backgroundColor: '#ef4444' }}>Logout</button>
      </div>
    </div>
  );
};
export default Dashboard;