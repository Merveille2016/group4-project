import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './Login';
import Dashboard from './Dashboard';

function App() {
  return (
    <Router>
      <Routes>
        {/* When they go to the homepage (http://localhost:5173/), show the Login page */}
        <Route path="/" element={<Login />} />
        
        {/* When they go to /dashboard, show the Dashboard page */}
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;