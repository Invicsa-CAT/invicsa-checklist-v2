import { createContext, useContext, useEffect, useState } from 'react';
import * as api from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => api.getStoredUser());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Si hay token pero validamos al arrancar haciendo un ping autenticado
  useEffect(() => {
    let cancelled = false;
    if (user && api.getStoredToken()) {
      // Comprobamos validez de sesión llamando a getConfig (requiere token)
      api.getConfig().catch(() => {
        if (!cancelled) {
          api.clearSession();
          setUser(null);
        }
      });
    }
    return () => { cancelled = true; };
  }, []);

  async function signIn(username, password) {
    setLoading(true);
    setError(null);
    try {
      const u = await api.login(username, password);
      setUser(u);
      return u;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }

  function signOut() {
    api.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
