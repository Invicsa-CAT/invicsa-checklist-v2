import { useEffect, useState } from 'react';
import * as api from '../lib/api';
import Header from '../components/Header';
import Button from '../components/Button';
import Apendice4Page from './Apendice4Page';

const APENDICES = [
  { num: '4',  label: 'Apéndice 4 — Planificación operacional', implemented: true },
  { num: '5',  label: 'Apéndice 5 — Verificación prevuelo',     implemented: false },
  { num: '6',  label: 'Apéndice 6 — Verificación postvuelo',    implemented: false },
  { num: '11', label: 'Apéndice 11 — Lista verificación RGPD',  implemented: false },
  { num: '14', label: 'Apéndice 14 — Registro ciclos de trabajo', implemented: false }
];

export default function OpDetailPage({ opId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [finalizing, setFinalizing] = useState(false);
  const [openAp, setOpenAp] = useState(null); // número del apéndice abierto

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const d = await api.getOp(opId);
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [opId]);

  async function finalizar() {
    if (!confirm('¿Finalizar la operación? Una vez finalizada no se podrá editar.')) return;
    setFinalizing(true);
    try {
      await api.finalizarOp(opId);
      await load();
    } catch (e) {
      alert('No se pudo finalizar: ' + e.message);
    } finally {
      setFinalizing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Cargando..." onBack={onBack} />
        <div className="text-center py-12 text-slate-500">Cargando operación...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <Header title="Error" onBack={onBack} />
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
            {error}
            <button onClick={load} className="ml-2 underline">Reintentar</button>
          </div>
        </div>
      </div>
    );
  }

  const { op, apendices } = data;
  const firmados = new Set(apendices.map(a => String(a.apendice_num)));
  const allFirmados = APENDICES.every(a => firmados.has(a.num));
  const isFinalizada = op.estado === 'firmado';

  // Si hay un apéndice abierto, renderizamos su página
  if (openAp === '4') {
    return (
      <Apendice4Page
        op={op}
        onBack={() => setOpenAp(null)}
        onSigned={async () => {
          setOpenAp(null);
          await load();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        title={op.titulo}
        subtitle={`${op.id} · ${op.fecha} · ${op.ubicacion}`}
        onBack={onBack}
      />

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {isFinalizada && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md px-4 py-3 text-sm flex items-start gap-2">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <div className="font-medium">Operación finalizada</div>
              <div className="text-xs mt-0.5">Firmada el {formatDate(op.signed_at)}. No se puede editar.</div>
            </div>
          </div>
        )}

        <section className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-invicsa-900 uppercase tracking-wide mb-3">Apéndices</h2>
          <ul className="divide-y divide-slate-100">
            {APENDICES.map(a => {
              const firmado = firmados.has(a.num);
              return (
                <li key={a.num} className="py-3 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${firmado ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900">{a.label}</div>
                    {firmado && (
                      <div className="text-xs text-slate-500">
                        Firmado por {apendices.find(ap => String(ap.apendice_num) === a.num)?.firmado_por}
                      </div>
                    )}
                    {!a.implemented && (
                      <div className="text-xs text-amber-600 italic">Pendiente de implementar (Fase 4)</div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={firmado ? 'secondary' : 'primary'}
                    disabled={isFinalizada || !a.implemented}
                    onClick={() => setOpenAp(a.num)}
                  >
                    {firmado ? 'Ver / re-firmar' : 'Cumplimentar'}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>

        {!isFinalizada && (
          <div className="flex justify-end">
            <Button
              onClick={finalizar}
              disabled={!allFirmados || finalizing}
              loading={finalizing}
            >
              Finalizar operación
            </Button>
          </div>
        )}

        {!isFinalizada && !allFirmados && (
          <p className="text-xs text-slate-500 text-right">
            Faltan {APENDICES.filter(a => !firmados.has(a.num)).length} apéndice(s) por firmar
          </p>
        )}
      </main>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-ES');
  } catch {
    return iso;
  }
}
