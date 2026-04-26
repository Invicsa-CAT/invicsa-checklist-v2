import { useEffect, useState } from 'react';
import * as api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import Button from '../components/Button';

const APENDICES_NUMS = ['4', '5', '6', '11', '14'];

const ESTADO_LABELS = {
  borrador: { label: 'Borrador', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  firmado:  { label: 'Firmada',  color: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
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
              <Button variant="secondary" onClick={onGoToAdmin}>Administración</Button>
            )}
            <Button onClick={onNewOp}>Nueva operación</Button>
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
          <div className="space-y-2">
            {opsOrdenadas.map(op => (
              <OpCard key={op.id} op={op} onOpen={() => onOpenOp(op.id)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function OpCard({ op, onOpen }) {
  const firmados = new Set((op.apendices_firmados || []).map(String));
  const numFirmados = APENDICES_NUMS.filter(n => firmados.has(n)).length;
  const fechaLegible = formatFechaLegible(op.fecha);
  const estado = ESTADO_LABELS[op.estado] || { label: op.estado, color: 'bg-slate-100 text-slate-700 border-slate-200' };

  return (
    <button
      onClick={onOpen}
      className="w-full text-left bg-white rounded-lg border border-slate-200 hover:border-invicsa-300 hover:shadow-sm transition-all p-4 flex items-center gap-4 group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-mono text-xs text-slate-500">{op.id}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${estado.color}`}>
            {estado.label}
          </span>
        </div>

        <h3 className="font-semibold text-slate-900 mb-1 truncate">{op.titulo}</h3>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            {fechaLegible}
          </span>
          <span className="inline-flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
            {op.piloto_nombre || op.piloto_username}
          </span>
          {op.ubicacion && (
            <span className="inline-flex items-center gap-1 truncate">
              <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <span className="truncate">{op.ubicacion}</span>
            </span>
          )}
        </div>

        {/* Progreso de los 5 apéndices */}
        <div className="flex items-center gap-2 mt-2.5">
          <div className="flex gap-1">
            {APENDICES_NUMS.map(n => (
              <div
                key={n}
                title={`Apéndice ${n}: ${firmados.has(n) ? 'firmado' : 'pendiente'}`}
                className={`w-6 h-1.5 rounded-full ${firmados.has(n) ? 'bg-emerald-500' : 'bg-slate-200'}`}
              />
            ))}
          </div>
          <span className="text-xs text-slate-500">
            {numFirmados}/{APENDICES_NUMS.length} apéndices
          </span>
        </div>
      </div>

      <svg className="w-5 h-5 text-slate-300 group-hover:text-invicsa-500 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
      </svg>
    </button>
  );
}

// "2026-04-26" o "26/04/2026" → "26 abr 2026"
function formatFechaLegible(fecha) {
  if (!fecha) return '—';
  const s = String(fecha);
  let d, m, y;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    [y, m, d] = s.slice(0, 10).split('-');
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    [d, m, y] = s.split('/');
  } else {
    return s;
  }
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const mi = parseInt(m, 10) - 1;
  return `${parseInt(d, 10)} ${meses[mi] || m} ${y}`;
}

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
