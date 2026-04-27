import { useEffect, useRef, useState } from 'react';
import * as api from '../lib/api';
import * as drafts from '../lib/draftStorage';
import { signAndGeneratePdf } from '../lib/signAndGeneratePdf';
import { useAuth } from '../contexts/AuthContext';
import { formatFecha } from '../lib/format';
import { durationBetween, sumDurations } from '../lib/timeUtils';
import Header from '../components/Header';
import Button from '../components/Button';
import Input from '../components/Input';
import SignaturePad from '../components/SignaturePad';

const MAX_ACTIVIDADES = 4;

function buildInitialState(op, pilotoName) {
  return {
    nombre: pilotoName || '',
    puesto: 'Piloto remoto',
    tripulacion: pilotoName || '',
    inicio_jornada: '',
    fin_jornada: '',
    actividades: [
      { inicio: '', fin: '', descanso_min: '' },
      { inicio: '', fin: '', descanso_min: '' }
    ],
    total_vuelo_manual: '',  // Si el piloto quiere sobreescribir el calculado
    firma: null,
    firmanteName: pilotoName || ''
  };
}

export default function Apendice14Page({ op, onBack, onSigned }) {
  const { user } = useAuth();
  const [state, setState] = useState(() => buildInitialState(op, user?.nombre_completo));
  const [tiempoVueloDeAp6, setTiempoVueloDeAp6] = useState(''); // leído del Apéndice 6 si existe
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [draftStatus, setDraftStatus] = useState('');
  const [pdfStatus, setPdfStatus] = useState('');
  const draftTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const fresh = await api.getOp(op.id);
        // Buscar tiempo de operación en Apéndice 6 si está firmado
        const ap6 = fresh.apendices.find(a => String(a.apendice_num) === '6');
        if (ap6) {
          const ap6Payload = typeof ap6.payload_json === 'string' ? JSON.parse(ap6.payload_json) : ap6.payload_json;
          if (ap6Payload?.tiempo_operacion) {
            setTiempoVueloDeAp6(ap6Payload.tiempo_operacion);
          }
        }
        // Cargar Apéndice 14 si ya existe
        const ap14 = fresh.apendices.find(a => String(a.apendice_num) === '14');
        if (ap14) {
          const parsed = typeof ap14.payload_json === 'string' ? JSON.parse(ap14.payload_json) : ap14.payload_json;
          setState({
            ...buildInitialState(op, user?.nombre_completo),
            ...parsed,
            firma: ap14.firma_dataurl || null
          });
          setLoading(false);
          return;
        }
        const draft = await drafts.loadDraft(op.id, '14');
        if (draft) setState({ ...buildInitialState(op, user?.nombre_completo), ...draft });
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    setDraftStatus('guardando...');
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(async () => {
      try { await drafts.saveDraft(op.id, '14', state); setDraftStatus('guardado'); setTimeout(() => setDraftStatus(''), 1500); }
      catch { setDraftStatus('error guardando'); }
    }, 800);
    return () => clearTimeout(draftTimer.current);
  }, [state, loading, op.id]);

  function update(field, value) { setState(s => ({ ...s, [field]: value })); }

  function updateActividad(idx, field, value) {
    setState(s => ({
      ...s,
      actividades: s.actividades.map((a, i) => i === idx ? { ...a, [field]: value } : a)
    }));
  }

  function addActividad() {
    if (state.actividades.length >= MAX_ACTIVIDADES) return;
    setState(s => ({ ...s, actividades: [...s.actividades, { inicio: '', fin: '', descanso_min: '' }] }));
  }

  function removeActividad(idx) {
    if (state.actividades.length <= 1) return;
    setState(s => ({ ...s, actividades: s.actividades.filter((_, i) => i !== idx) }));
  }

  // Cálculos derivados
  const totalJornada = durationBetween(state.inicio_jornada, state.fin_jornada);
  const duracionesActividades = state.actividades.map(a =>
    a.inicio && a.fin ? durationBetween(a.inicio, a.fin) : ''
  );
  const totalVueloCalculado = sumDurations(duracionesActividades.filter(Boolean));

  // Total horas de vuelo: prioridad
  // 1. Lo introducido manualmente en el campo total_vuelo_manual.
  // 2. Lo del Apéndice 6 si existe.
  // 3. Lo calculado a partir de las actividades.
  const totalVueloFinal = state.total_vuelo_manual || tiempoVueloDeAp6 || totalVueloCalculado;

  function validate() {
    const missing = [];
    if (!state.nombre?.trim()) missing.push('nombre');
    if (!state.tripulacion?.trim()) missing.push('tripulación');
    if (!state.inicio_jornada) missing.push('inicio jornada');
    if (!state.fin_jornada) missing.push('fin jornada');
    const completas = state.actividades.filter(a => a.inicio && a.fin);
    if (completas.length === 0) missing.push('al menos una actividad');
    if (!state.firma) missing.push('firma');
    if (!state.firmanteName?.trim()) missing.push('nombre del firmante');
    return missing;
  }

  async function handleSign() {
    setError(null);
    const missing = validate();
    if (missing.length > 0) {
      setError(`Faltan campos: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`);
      return;
    }
    setSaving(true);
    try {
      const { firma, ...payload } = state;
      payload.total_jornada = totalJornada;
      payload.total_vuelo = totalVueloFinal;
      const res = await signAndGeneratePdf(op, '14', payload, firma, { onProgress: setPdfStatus });
      await drafts.deleteDraft(op.id, '14');
      if (res.pdfError) {
        setPdfStatus(`✓ Firmado. Aviso: ${res.pdfError}`);
        setTimeout(() => onSigned(), 1500);
      } else {
        setPdfStatus('✓ Firmado y PDF subido a Drive');
        setTimeout(() => onSigned(), 800);
      }
    } catch (e) {
      setError(e.message);
      setPdfStatus('');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Apéndice 14" onBack={onBack} />
        <div className="text-center py-12 text-slate-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <Header title="Apéndice 14 — Registro ciclos de trabajo" subtitle={`${op.id} · ${op.titulo}`} onBack={onBack} />

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <Section title="Datos del piloto">
          <Input label="Nombre" value={state.nombre} onChange={(e) => update('nombre', e.target.value)} />
          <Input label="Puesto" value={state.puesto} onChange={(e) => update('puesto', e.target.value)} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="Fecha" value={formatFecha(op.fecha)} />
            <Field label="Operación" value={op.titulo} />
          </div>
          <Input
            label="Tripulación"
            value={state.tripulacion}
            onChange={(e) => update('tripulacion', e.target.value)}
            placeholder="Listar todos los miembros separados por comas"
          />
        </Section>

        <Section title="Registro de jornada">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="Inicio jornada" type="time" value={state.inicio_jornada} onChange={(e) => update('inicio_jornada', e.target.value)} />
            <Input label="Fin jornada" type="time" value={state.fin_jornada} onChange={(e) => update('fin_jornada', e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Total</label>
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-mono text-slate-800">
                {totalJornada || '—'}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Tiempos de actividad y descansos">
          <div className="space-y-3">
            {state.actividades.map((a, i) => (
              <div key={i} className="border border-slate-200 rounded-md p-3 bg-slate-50/50">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-700">Actividad {i + 1}</h3>
                  {state.actividades.length > 1 && (
                    <button type="button" onClick={() => removeActividad(i)} className="text-xs text-red-600 hover:text-red-700">
                      Eliminar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <Input label="Inicio" type="time" value={a.inicio} onChange={(e) => updateActividad(i, 'inicio', e.target.value)} />
                  <Input label="Fin" type="time" value={a.fin} onChange={(e) => updateActividad(i, 'fin', e.target.value)} />
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Duración</label>
                    <div className="px-3 py-2 bg-white border border-slate-200 rounded-md text-sm font-mono text-slate-800">
                      {duracionesActividades[i] || '—'}
                    </div>
                  </div>
                  {i < state.actividades.length - 1 && (
                    <Input label="Descanso siguiente (min)" type="number" min="0" value={a.descanso_min} onChange={(e) => updateActividad(i, 'descanso_min', e.target.value)} placeholder="15" />
                  )}
                </div>
              </div>
            ))}
            {state.actividades.length < MAX_ACTIVIDADES && (
              <Button size="sm" variant="secondary" onClick={addActividad} type="button">
                + Añadir actividad ({state.actividades.length}/{MAX_ACTIVIDADES})
              </Button>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Total horas de vuelo acumuladas:</span>
              <span className="text-base font-mono font-semibold text-invicsa-900">{totalVueloFinal || '—'}</span>
            </div>
            {tiempoVueloDeAp6 && !state.total_vuelo_manual && (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                ✓ Auto-rellenado desde el Apéndice 6 (tiempo de operación: {tiempoVueloDeAp6})
              </p>
            )}
            {!tiempoVueloDeAp6 && (
              <p className="text-xs text-slate-500 italic">
                💡 Si firmas primero el Apéndice 6 con el tiempo de operación, este campo se rellenará automáticamente.
              </p>
            )}
            <details className="text-xs">
              <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
                Sobreescribir manualmente
              </summary>
              <Input
                label="Total horas de vuelo manual (HH:MM)"
                type="time"
                value={state.total_vuelo_manual}
                onChange={(e) => update('total_vuelo_manual', e.target.value)}
                className="mt-2"
              />
            </details>
          </div>
        </Section>

        <Section title="Firma del piloto">
          <Input
            label="Nombre del firmante"
            value={state.firmanteName}
            onChange={(e) => update('firmanteName', e.target.value)}
            className="mb-3"
          />
          <SignaturePad value={state.firma} onChange={(firma) => update('firma', firma)} />
        </Section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">{error}</div>
        )}
      </main>

      <BottomBar draftStatus={pdfStatus || draftStatus} onBack={onBack} onSign={handleSign} saving={saving} />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5 space-y-3">
      <h2 className="text-sm font-semibold text-invicsa-900 uppercase tracking-wide">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-700">{value || '—'}</div>
    </div>
  );
}

function BottomBar({ draftStatus, onBack, onSign, saving }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-md z-20">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">{draftStatus || 'Borrador autoguardado en este dispositivo'}</span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onBack} type="button">Volver</Button>
          <Button onClick={onSign} loading={saving}>Firmar y guardar</Button>
        </div>
      </div>
    </div>
  );
}
