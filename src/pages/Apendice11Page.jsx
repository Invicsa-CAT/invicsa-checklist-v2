import { useEffect, useRef, useState } from 'react';
import * as api from '../lib/api';
import * as drafts from '../lib/draftStorage';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import Button from '../components/Button';
import Input from '../components/Input';
import SignaturePad from '../components/SignaturePad';

// Textos por defecto. La sección 1 y la 8 incorporan dinámicamente el tipo
// de operación y el nombre del piloto. El resto son fijos.
function buildDefaultTexts(op, pilotoName) {
  const tipo = op.tipo || 'Operación';
  return {
    riesgos: `Operación de tipo "${tipo}" que puede implicar la captación de imágenes donde se identifiquen personas o matrículas. Se aplican medidas de anonimización en postproducción cuando sea necesario.`,
    informacion_interesados: 'Señalización en zona y comunicación previa. Información en la web corporativa.',
    minimizacion: 'Planificación de encuadres. Difuminado/anonimización en postproducción.',
    almacenamiento: 'Almacenamiento cifrado con acceso restringido por rol.',
    derechos: 'Procedimiento ARCO+ mediante contacto a info@invicsa-airtech.com',
    informacion_adicional: `Piloto responsable: ${pilotoName || ''}. Tipo: ${tipo}.`
  };
}

function buildInitialState(op, pilotoName) {
  const t = buildDefaultTexts(op, pilotoName);
  return {
    riesgos: t.riesgos,
    rol_captura: true,
    rol_proceso: true,
    eipd_evaluada: 'si',     // Sí Evaluada por defecto
    eipd_requiere: 'no',     // No requiere por defecto
    eipd_realizada: 'no',    // No realizada por defecto
    informacion_interesados: t.informacion_interesados,
    minimizacion: t.minimizacion,
    almacenamiento: t.almacenamiento,
    derechos: t.derechos,
    informacion_adicional: t.informacion_adicional,
    firma: null,
    firmanteName: pilotoName || ''
  };
}

export default function Apendice11Page({ op, onBack, onSigned }) {
  const { user } = useAuth();
  const [state, setState] = useState(() => buildInitialState(op, user?.nombre_completo));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [draftStatus, setDraftStatus] = useState('');
  const draftTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const fresh = await api.getOp(op.id);
        const ap = fresh.apendices.find(a => String(a.apendice_num) === '11');
        if (ap) {
          const parsed = typeof ap.payload_json === 'string' ? JSON.parse(ap.payload_json) : ap.payload_json;
          setState({
            ...buildInitialState(op, user?.nombre_completo),
            ...parsed,
            firma: ap.firma_dataurl || null
          });
          setLoading(false);
          return;
        }
        const draft = await drafts.loadDraft(op.id, '11');
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
      try { await drafts.saveDraft(op.id, '11', state); setDraftStatus('guardado'); setTimeout(() => setDraftStatus(''), 1500); }
      catch { setDraftStatus('error guardando'); }
    }, 800);
    return () => clearTimeout(draftTimer.current);
  }, [state, loading, op.id]);

  function update(field, value) { setState(s => ({ ...s, [field]: value })); }

  function validate() {
    const missing = [];
    if (!state.riesgos?.trim()) missing.push('riesgos');
    if (!state.informacion_interesados?.trim()) missing.push('información a interesados');
    if (!state.minimizacion?.trim()) missing.push('minimización');
    if (!state.almacenamiento?.trim()) missing.push('almacenamiento');
    if (!state.derechos?.trim()) missing.push('derechos');
    if (!state.informacion_adicional?.trim()) missing.push('información adicional');
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
      await api.signApendice(op.id, '11', payload, firma);
      await drafts.deleteDraft(op.id, '11');
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
        <Header title="Apéndice 11" onBack={onBack} />
        <div className="text-center py-12 text-slate-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <Header title="Apéndice 11 — Lista verificación RGPD" subtitle={`${op.id} · ${op.titulo}`} onBack={onBack} />

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <Section title="Datos de la operación">
          <Field label="Título y/o código" value={op.titulo} />
          <Field label="Descripción y objetivos" value={op.descripcion} />
          <Field label="Tipo de operación" value={op.tipo} />
          <Field label="Piloto responsable" value={user.nombre_completo} />
        </Section>

        <Section title="1. Identificación de riesgos de privacidad">
          <TextArea value={state.riesgos} onChange={(v) => update('riesgos', v)} rows={3} />
          <Hint>Texto pre-rellenado según el tipo de operación. Editable.</Hint>
        </Section>

        <Section title="2. Rol respecto a captura y tratamiento">
          <Checkbox
            label="Capturo los datos"
            checked={state.rol_captura}
            onChange={(v) => update('rol_captura', v)}
          />
          <Checkbox
            label="Proceso los datos"
            checked={state.rol_proceso}
            onChange={(v) => update('rol_proceso', v)}
          />
        </Section>

        <Section title="3. Evaluación de impacto (EIPD)">
          <RadioRow
            label="¿Evaluada la necesidad de EIPD?"
            value={state.eipd_evaluada}
            onChange={(v) => update('eipd_evaluada', v)}
          />
          <RadioRow
            label="¿Requiere EIPD?"
            value={state.eipd_requiere}
            onChange={(v) => update('eipd_requiere', v)}
          />
          <RadioRow
            label="¿Realizó EIPD?"
            value={state.eipd_realizada}
            onChange={(v) => update('eipd_realizada', v)}
          />
        </Section>

        <Section title="4. Medidas de información a interesados">
          <TextArea value={state.informacion_interesados} onChange={(v) => update('informacion_interesados', v)} rows={2} />
        </Section>

        <Section title="5. Medidas de minimización de datos">
          <TextArea value={state.minimizacion} onChange={(v) => update('minimizacion', v)} rows={2} />
        </Section>

        <Section title="6. Almacenamiento y acceso">
          <TextArea value={state.almacenamiento} onChange={(v) => update('almacenamiento', v)} rows={2} />
        </Section>

        <Section title="7. Derechos de los interesados">
          <TextArea value={state.derechos} onChange={(v) => update('derechos', v)} rows={2} />
        </Section>

        <Section title="8. Información adicional">
          <TextArea value={state.informacion_adicional} onChange={(v) => update('informacion_adicional', v)} rows={2} />
        </Section>

        <Section title="Aprobación del piloto a distancia">
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

      <BottomBar draftStatus={draftStatus} onBack={onBack} onSign={handleSign} saving={saving} />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-invicsa-900 uppercase tracking-wide mb-3">{title}</h2>
      <div className="space-y-2">{children}</div>
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

function TextArea({ value, onChange, rows = 3 }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-invicsa-400"
    />
  );
}

function Hint({ children }) {
  return <p className="text-xs text-slate-500 italic">{children}</p>;
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 py-1 cursor-pointer text-sm text-slate-800">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-slate-300 text-invicsa-700 focus:ring-invicsa-400"
      />
      <span>{label}</span>
    </label>
  );
}

function RadioRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-1.5 gap-3">
      <span className="text-sm text-slate-800 flex-1">{label}</span>
      <div className="flex gap-1">
        {[
          { v: 'si', l: 'Sí', cls: 'bg-emerald-600 text-white border-emerald-600' },
          { v: 'no', l: 'No', cls: 'bg-red-600 text-white border-red-600' }
        ].map(opt => {
          const active = value === opt.v;
          return (
            <button
              key={opt.v}
              type="button"
              onClick={() => onChange(opt.v)}
              className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                active ? opt.cls : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {opt.l}
            </button>
          );
        })}
      </div>
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
