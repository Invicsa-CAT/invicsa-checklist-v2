import { useEffect, useState } from 'react';
import * as api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import Button from '../components/Button';

const ESTADO_LABELS = {
  borrador: { label: 'Borrador', color: 'bg-amber-100 text-amber-800' },
  firmado:  { label: 'Firmada',  color: 'bg-emerald-100 text-emerald-800' }
};

export default function OperacionesListPage({ onOpenOp, onNewOp, onGoToAdmin }) {
  const { user } = useAuth();
  const [ops, setOps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('todas');
  const [filtroPiloto, setFiltroPiloto] = useState('todos');
  const [pilotos, setPilotos] = useState([]);

  const isGestor = user?.rol === 'gestor';

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listOps();
      setOps(data);
      if (isGestor) {
        const ps = await api.listPilotos();
        setPilotos(ps.filter(p => p.activo && p.rol === 'piloto'));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const opsFiltradas = ops.filter(op => {
    if (filtroEstado !== 'todas' && op.estado !== filtroEstado) return false;
    if (filtroPiloto !== 'todos' && op.piloto_username !== filtroPiloto) return false;
    return true;
  });

  // Ordenar por fecha desc (más recientes primero)
  const opsOrdenadas = [...opsFiltradas].sort((a, b) => {
    const da = parseFecha(a.fecha);
    const db = parseFecha(b.fecha);
    return db - da;
  });

  return (
    <div className="min-h-screen">
      <Header
        title="Operaciones"
        subtitle={isGestor ? 'Vista de gestor' : `Operaciones de ${user.nombre_completo}`}
      />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-2">
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
            >
              <option value="todas">Todos los estados</option>
              <option value="borrador">Borradores</option>
              <option value="firmado">Firmadas</option>
            </select>

            {isGestor && (
              <select
                value={filtroPiloto}
                onChange={(e) => setFiltroPiloto(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
              >
                <option value="todos">Todos los pilotos</option>
                {pilotos.map(p => (
                  <option key={p.username} value={p.username}>{p.nombre_completo}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex gap-2">
            {isGestor && (
              <Button variant="secondary" onClick={onGoToAdmin}>
                Administración
              </Button>
            )}
            <Button onClick={onNewOp}>
              Nueva operación
            </Button>
          </div>
        </div>

        {loading && (
          <div className="text-center py-12 text-slate-500">Cargando operaciones...</div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 mb-4 text-sm">
            {error}
            <button onClick={load} className="ml-2 underline">Reintentar</button>
          </div>
        )}

        {!loading && !error && opsOrdenadas.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <p className="text-slate-500">No hay operaciones que coincidan con los filtros.</p>
          </div>
        )}

        {!loading && opsOrdenadas.length > 0 && (
          <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
            {opsOrdenadas.map(op => (
              <button
                key={op.id}
                onClick={() => onOpenOp(op.id)}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs text-slate-500">{op.id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_LABELS[op.estado]?.color || 'bg-slate-100 text-slate-700'}`}>
                      {ESTADO_LABELS[op.estado]?.label || op.estado}
                    </span>
                  </div>
                  <div className="font-medium text-slate-900 truncate">{op.titulo}</div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    {op.fecha} · {op.piloto_username} · {op.ubicacion || 'Sin ubicación'}
                  </div>
                </div>
                <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// Convierte "DD/MM/YYYY" o "YYYY-MM-DD" a timestamp para ordenar
function parseFecha(f) {
  if (!f) return 0;
  const s = String(f);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/');
    return new Date(`${y}-${m}-${d}`).getTime();
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return new Date(s).getTime();
  }
  return 0;
}
