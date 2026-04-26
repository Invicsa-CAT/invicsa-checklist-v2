import { useEffect, useRef, useState } from 'react';
import * as api from '../lib/api';
import * as drafts from '../lib/draftStorage';
import { useAuth } from '../contexts/AuthContext';
import { formatFechaHoras } from '../lib/format';
import Header from '../components/Header';
import Button from '../components/Button';
import Input from '../components/Input';
import ChecklistItem from '../components/ChecklistItem';
import SignaturePad from '../components/SignaturePad';

const SECCIONES = [
  {
    title: '1. Lugar de la operación',
    items: [
      { code: '1.1.1.1', label: 'Evaluación visibilidad y alcance' },
      { code: '1.1.1.2', label: 'Observadores correctamente posicionados' },
      { code: '1.2.2.1', label: 'NOTAMs revisados sin limitaciones' },
      { code: '1.2.2.2', label: 'Confirmación publicación NOTAM si TSA' },
      { code: '1.2.3.1', label: 'Procedimientos ATSP cumplidos' },
      { code: '1.1.4.1', label: 'Condicionantes gestor infraestructura' }
    ]
  },
  {
    title: '2. Condiciones ambientales',
    items: [
      { code: '2.1.1', label: 'Condiciones no exceden máximos' }
    ]
  },
  {
    title: '3. Procedimientos de comunicación',
    items: [
      { code: '3.1', label: 'Comunicación entre personal' },
      { code: '3.2', label: 'Comunicación con terceras partes' }
    ]
  },
  {
    title: '4. Atenuaciones al riesgo',
    items: [
      { code: '4.1', label: 'Atenuaciones del GRC implementadas' },
      { code: '4.2', label: 'Atenuaciones del ARC implementadas' }
    ]
  },
  {
    title: '5. UAS es aeronavegable',
    items: [
      { code: '5.1',  label: 'Estructura' },
      { code: '5.2',  label: 'Sensores' },
      { code: '5.3',  label: 'Motores' },
      { code: '5.4',  label: 'Hélices' },
      { code: '5.5',  label: 'Unidad de control' },
      { code: '5.6',  label: 'Partes móviles' },
      { code: '5.7',  label: 'Comunicaciones' },
      { code: '5.8',  label: 'Planta de potencia' },
      { code: '5.9',  label: 'Carga de pago' },
      { code: '5.10', label: 'DRI' },
      { code: '5.11', label: 'Sistema de geoconsciencia' },
      { code: '5.12', label: 'Otros ConOps' }
    ]
  }
];

const ALL_CODES = SECCIONES.flatMap(s => s.items.map(i => i.code));

function buildInitialState(defaultName) {
  const items = {};
  ALL_CODES.forEach(c => { items[c] = null; });
  return { items, firma: null, firmanteName: defaultName || '', notas: '' };
}

export default function Apendice5Page({ op, onBack, onSigned }) {
  const { user } = useAuth();
  const [state, setState] = useState(buildInitialState(user?.nombre_completo));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [draftStatus, setDraftStatus] = useState('');
  const draftTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const fresh = await api.getOp(op.id);
        const ap = fresh.apendices.find(a => String(a.apendice_num) === '5');
        if (ap) {
          const parsed = typeof ap.payload_json === 'string' ? JSON.parse(ap.payload_json) : ap.payload_json;
          setState({
            items: parsed.items || buildInitialState().items,
            firma: ap.firma_dataurl || null,
            firmanteName: parsed.firmanteName || user?.nombre_completo || '',
            notas: parsed.notas || ''
          });
          setLoading(false);
          return;
        }
        const draft = await drafts.loadDraft(op.id, '5');
        if (draft) {
          setState({
            ...draft,
            firmanteName: draft.firmanteName || user?.nombre_completo || ''
          });
        }
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
      try {
        await drafts.saveDraft(op.id, '5', state);
        setDraftStatus('guardado');
        setTimeout(() => setDraftStatus(''), 1500);
      } catch { setDraftStatus('error guardando'); }
    }, 800);
    return () => clearTimeout(draftTimer.current);
  }, [state, loading, op.id]);

  function setItem(code, value) {
    setState(s => ({ ...s, items: { ...s.items, [code]: value } }));
  }

  function validate() {
    const missing = ALL_CODES.filter(c => !state.items[c]);
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
      await api.signApendice(op.id, '5', {
        items: state.items,
        firmanteName: state.firmanteName,
        notas: state.notas
      }, state.firma);
      await drafts.deleteDraft(op.id, '5');
      onSigned();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Apéndice 5" onBack={onBack} />
        <div className="text-center py-12 text-slate-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <Header
        title="Apéndice 5 — Verificación prevuelo"
        subtitle={`${op.id} · ${op.titulo}`}
        onBack={onBack}
      />

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <Section title="Datos de la operación">
          <Field label="Título y/o código" value={op.titulo} />
          <Field label="Descripción y objetivos" value={op.descripcion} />
          <Field label="CONOPS / Categoría" value={op.categoria} />
          <Field label="Fecha y horas previstas" value={formatFechaHoras(op.fecha, op.inicio_hl, op.fin_hl)} />
          <Field label="Piloto a distancia" value={user.nombre_completo} />
          <Field label="UAS" value={op.uas_id} />
        </Section>

        {SECCIONES.map(sec => (
          <Section key={sec.title} title={sec.title}>
            <div className="divide-y divide-slate-100">
              {sec.items.map(item => (
                <ChecklistItem
                  key={item.code}
                  code={item.code}
                  label={item.label}
                  value={state.items[item.code]}
                  onChange={(v) => setItem(item.code, v)}
                />
              ))}
            </div>
          </Section>
        ))}

        <Section title="Notas adicionales (opcional)">
          <textarea
            value={state.notas}
            onChange={(e) => setState(s => ({ ...s, notas: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-invicsa-400"
          />
        </Section>

        <Section title="6. Aprobación del piloto a distancia">
          <Input
            label="Nombre del firmante"
            value={state.firmanteName}
            onChange={(e) => setState(s => ({ ...s, firmanteName: e.target.value }))}
            className="mb-3"
          />
          <SignaturePad
            value={state.firma}
            onChange={(firma) => setState(s => ({ ...s, firma }))}
          />
        </Section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">{error}</div>
        )}
      </main>

      <BottomBar draftStatus={draftStatus} onBack={onBack} onSign={handleSign} saving={saving} />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-invicsa-900 uppercase tracking-wide mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="sm:col-span-2 text-slate-800 font-medium">{value || '—'}</span>
    </div>
  );
}

function BottomBar({ draftStatus, onBack, onSign, saving }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-md z-20">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">
          {draftStatus || 'Borrador autoguardado en este dispositivo'}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onBack} type="button">Volver</Button>
          <Button onClick={onSign} loading={saving}>Firmar y guardar</Button>
        </div>
      </div>
    </div>
  );
}
