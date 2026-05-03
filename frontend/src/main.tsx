import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.tsx'
import Auth from './Auth.tsx'

// Set default base URL for the new .NET API
axios.defaults.baseURL = 'http://localhost:5000'

function Root() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [username, setUsername] = useState<string | null>(localStorage.getItem('username'));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const handleLogin = (newToken: string, newUsername: string) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    setToken(newToken);
    setUsername(newUsername);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(null);
    setUsername(null);
  };

  return (
    <StrictMode>
      {token ? (
        <App username={username} onLogout={handleLogout} />
      ) : (
        <Auth onLogin={handleLogin} />
      )}
    </StrictMode>
  )
}

createRoot(document.getElementById('root')!).render(<Root />)
