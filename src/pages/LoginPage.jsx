import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LOGO_DATA_URL } from '../assets/logo';
import Button from '../components/Button';
import Input from '../components/Input';

export default function LoginPage() {
  const { signIn, loading, error } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await signIn(username.trim(), password);
    } catch {
      // error ya se muestra desde el contexto
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-slate-100 to-invicsa-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src={LOGO_DATA_URL}
            alt="INVICSA Airtech"
            className="h-16 w-auto mx-auto mb-3"
          />
          <p className="text-sm text-slate-500">Checklists operacionales UAS</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h1 className="text-lg font-semibold text-invicsa-900 mb-4">Acceso</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Usuario"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <Input
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" fullWidth loading={loading} disabled={!username || !password}>
              Iniciar sesión
            </Button>
          </form>

          <p className="mt-4 text-xs text-slate-500 text-center">
            ¿Problemas de acceso? Contacta con el gestor de operaciones.
          </p>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          INVICSA Airtech S.L. · Operador UAS ESP0rev8xuiuo4qe
        </p>
      </div>
    </div>
  );
}
