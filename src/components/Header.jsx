import { useAuth } from '../contexts/AuthContext';
import { LOGO_DATA_URL } from '../assets/logo';
import Button from './Button';

export default function Header({ title, subtitle, onBack }) {
  const { user, signOut } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded hover:bg-slate-100 text-slate-600"
            aria-label="Volver"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <img
          src={LOGO_DATA_URL}
          alt="INVICSA Airtech"
          className="h-9 w-auto"
        />
        <div className="flex-1 min-w-0">
          {title && <h1 className="text-base sm:text-lg font-semibold text-invicsa-900 truncate">{title}</h1>}
          {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
        </div>
        {user && (
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-slate-800">{user.nombre_completo}</div>
              <div className="text-xs text-slate-500 capitalize">{user.rol}</div>
            </div>
            <Button variant="secondary" size="sm" onClick={signOut}>
              Salir
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
