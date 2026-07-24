import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Send cookies with every request
axios.defaults.withCredentials = true;

// Global 401 handler — if a session expires mid-session, drop to /login.
axios.interceptors.response.use(
  (r) => r,
  (error) => {
    const url = error.config?.url || '';
    const isAuthCheck = url.includes('/auth/me') || url.includes('/auth/login') || url.includes('/auth/register');
    if (error.response?.status === 401 && !isAuthCheck && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

function formatApiErrorDetail(detail) {
  if (detail == null) return 'Something went wrong. Please try again.';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === 'string' ? e.msg : JSON.stringify(e))).filter(Boolean).join(' ');
  if (detail && typeof detail.msg === 'string') return detail.msg;
  return String(detail);
}

export function AuthProvider({ children }) {
  // null = checking session, false = anonymous, object = authenticated
  const [user, setUser] = useState(null);

  useEffect(() => {
    axios.get(`${API}/auth/me`)
      .then((res) => setUser(res.data))
      .catch(() => setUser(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await axios.post(`${API}/auth/login`, { email, password });
    setUser(data);
    return data;
  };

  const register = async (email, password, name) => {
    const { data } = await axios.post(`${API}/auth/register`, { email, password, name });
    setUser(data);
    return data;
  };

  const logout = async () => {
    try { await axios.post(`${API}/auth/logout`); } catch (e) { /* ignore */ }
    setUser(false);
  };

  const value = useMemo(
    () => ({ user, login, register, logout, formatApiErrorDetail }),
    [user]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
