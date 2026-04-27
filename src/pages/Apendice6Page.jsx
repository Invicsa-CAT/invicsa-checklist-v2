import { useEffect, useRef, useState } from 'react';
import * as api from '../lib/api';
import * as drafts from '../lib/draftStorage';
import { signAndGeneratePdf } from '../lib/signAndGeneratePdf';
import { useAuth } from '../contexts/AuthContext';
import { formatFechaHoras } from '../lib/format';
import Header from '../components/Header';
import Button from '../components/Button';
import Input from '../components/Input';
import ChecklistItem from '../components/ChecklistItem';
import SignaturePad from '../components/SignaturePad';

// Numeración oficial Manual de Operaciones edición 9 revisión 10.
//
// 7.   Finalización y cierre de operaciones
//   7.1 Condiciones y limitaciones de zonas geográficas de UAS
//     7.1.1 Si la operación se lleva a cabo en espacio aéreo controlado o FIZ
//       7.1.1.1 (subitem)
//     7.1.2 Otras condiciones
//       7.1.2.1, 7.1.2.2
//   7.2 Registro de datos de vuelo y eventos
//     7.2.1 Registros de actividad de vuelo (Sí/No/N/A + comentarios)
//       7.2.1.1 Anotación de tiempos de vuelo de aeronave (con campos extra: tiempo_op, n_aterrizajes)
//       7.2.1.2 Anotación de tiempos de actividad del personal
//     7.2.2 Registro y comunicación de eventos significativos (Sí/No/N/A + comentarios)
//       7.2.2.1, 7.2.2.2
//     7.2.3 Aeronave (Sí/No + observaciones)
//       7.2.3.1 a 7.2.3.11

const SECCION_71_GRUPOS = [
  {
    code: '7.1.1',
    label: 'Si la operación se lleva a cabo en espacio aéreo controlado o FIZ',
    children: [
      { code: '7.1.1.1', label: 'Se cierran las operaciones conforme a las condiciones acordadas con el ATSP' }
    ]
  },
  {
    code: '7.1.2',
    label: 'Otras condiciones',
    children: [
      { code: '7.1.2.1', label: 'Comunicación a terceros de la finalización de operaciones' },
      { code: '7.1.2.2', label: 'Comunicación imágenes tomadas en ZRVF al CECAF' }
    ]
  }
];

const SECCION_721_GRUPO = {
  code: '7.2.1',
  label: 'Registros de actividad de vuelo',
  children: [
    { code: '7.2.1.1', label: 'Anotación de tiempos de vuelo de aeronave', hasFlightData: true },
    { code: '7.2.1.2', label: 'Anotación de tiempos de actividad del personal' }
  ]
};

const SECCION_722_GRUPO = {
  code: '7.2.2',
  label: 'Registro y comunicación de eventos significativos',
  children: [
    { code: '7.2.2.1', label: 'Anotación y comunicación interna de eventos de seguridad ocurridos durante las operaciones' },
    { code: '7.2.2.2', label: 'Comunicación de incidentes y accidentes a CIAIAC' }
  ]
};

const SECCION_723_ITEMS = [
  { code: '7.2.3.1',  label: 'Estructura' },
  { code: '7.2.3.2',  label: 'Baterías' },
  { code: '7.2.3.3',  label: 'Sensores' },
  { code: '7.2.3.4',  label: 'Motores' },
  { code: '7.2.3.5',  label: 'Hélices' },
  { code: '7.2.3.6',  label: 'Partes Móviles' },
  { code: '7.2.3.7',  label: 'Comunicaciones' },
  { code: '7.2.3.8',  label: 'Planta de potencia' },
  { code: '7.2.3.9',  label: 'DRI' },
  { code: '7.2.3.10', label: 'Sistema de geoconsciencia' },
  { code: '7.2.3.11', label: 'Recogida y almacenaje' }
];

const ALL_71_CODES = SECCION_71_GRUPOS.flatMap(g => [g.code, ...g.children.map(c => c.code)]);
const ALL_72_CODES = [
  SECCION_721_GRUPO.code, ...SECCION_721_GRUPO.children.map(c => c.code),
  SECCION_722_GRUPO.code, ...SECCION_722_GRUPO.children.map(c => c.code),
  ...SECCION_723_ITEMS.map(i => i.code)
];

function buildInitialState(defaultName) {
  const items = {};
  ALL_71_CODES.forEach(c => { items[c] = null; });
  ALL_72_CODES.forEach(c => { items[c] = null; });
  const comentarios = {};
  ALL_72_CODES.forEach(c => { comentarios[c] = ''; });
  return {
    items,
    comentarios,
    tiempo_operacion: '',  // HH:MM, va asociado a 7.2.1.1
    n_aterrizajes: '',     // numérico, va asociado a 7.2.1.1
    firma: null,
    firmanteName: defaultName || '',
    notas: ''
  };
}

export default function Apendice6Page({ op, onBack, onSigned }) {
  const { user } = useAuth();
  const [state, setState] = useState(buildInitialState(user?.nombre_completo));
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
        const ap = fresh.apendices.find(a => String(a.apendice_num) === '6');
        if (ap) {
          const parsed = typeof ap.payload_json === 'string' ? JSON.parse(ap.payload_json) : ap.payload_json;
          setState({
            ...buildInitialState(user?.nombre_completo),
            ...parsed,
            firma: ap.firma_dataurl || null,
            firmanteName: parsed.firmanteName || user?.nombre_completo || ''
          });
          setLoading(false);
          return;
        }
        const draft = await drafts.loadDraft(op.id, '6');
        if (draft) setState({ ...buildInitialState(user?.nombre_completo), ...draft, firmanteName: draft.firmanteName || user?.nombre_completo || '' });
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
      try { await drafts.saveDraft(op.id, '6', state); setDraftStatus('guardado'); setTimeout(() => setDraftStatus(''), 1500); }
      catch { setDraftStatus('error guardando'); }
    }, 800);
    return () => clearTimeout(draftTimer.current);
  }, [state, loading, op.id]);

  function setItem(code, value) {
    setState(s => {
      const newItems = { ...s.items, [code]: value };
      // Lógica condicional para grupos de 7.1
      const grupo = SECCION_71_GRUPOS.find(g => g.code === code);
      if (grupo && (value === 'no' || value === 'na')) {
        grupo.children.forEach(c => { newItems[c.code] = 'na'; });
      }
      if (grupo && value === 'si') {
        grupo.children.forEach(c => {
          if (newItems[c.code] === 'na') newItems[c.code] = null;
        });
      }
      return { ...s, items: newItems };
    });
  }

  function setComentario(code, text) {
    setState(s => ({ ...s, comentarios: { ...s.comentarios, [code]: text } }));
  }

  function isChildEnabled(parentCode) {
    return state.items[parentCode] === 'si';
  }

  function validate() {
    const missing = [];
    SECCION_71_GRUPOS.forEach(g => {
      if (!state.items[g.code]) missing.push(g.code);
      if (state.items[g.code] === 'si') {
        g.children.forEach(c => { if (!state.items[c.code]) missing.push(c.code); });
      }
    });
    // 7.2.1, 7.2.2 y sus hijos siempre obligatorios
    if (!state.items[SECCION_721_GRUPO.code]) missing.push(SECCION_721_GRUPO.code);
    SECCION_721_GRUPO.children.forEach(c => { if (!state.items[c.code]) missing.push(c.code); });
    if (!state.items[SECCION_722_GRUPO.code]) missing.push(SECCION_722_GRUPO.code);
    SECCION_722_GRUPO.children.forEach(c => { if (!state.items[c.code]) missing.push(c.code); });
    // 7.2.3 todos obligatorios
    SECCION_723_ITEMS.forEach(item => { if (!state.items[item.code]) missing.push(item.code); });
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
      const res = await signAndGeneratePdf(op, '6', payload, firma, { onProgress: setPdfStatus });
      await drafts.deleteDraft(op.id, '6');
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
        <Header title="Apéndice 6" onBack={onBack} />
        <div className="text-center py-12 text-slate-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <Header title="Apéndice 6 — Lista verificación postvuelo" subtitle={`${op.id} · ${op.titulo}`} onBack={onBack} />

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <Section title="Datos de la operación">
          <Field label="Título y/o código" value={op.titulo} />
          <Field label="CONOPS / Categoría" value={op.categoria} />
          <Field label="Fecha y horas previstas" value={formatFechaHoras(op.fecha, op.inicio_hl, op.fin_hl)} />
          <Field label="Piloto a distancia" value={user.nombre_completo} />
          <Field label="UAS" value={op.uas_id} />
        </Section>

        <Section title="7.1 Condiciones y limitaciones de zonas geográficas">
          <div className="divide-y divide-slate-100">
            {SECCION_71_GRUPOS.map(grupo => (
              <div key={grupo.code}>
                <ChecklistItem
                  code={grupo.code}
                  label={grupo.label}
                  value={state.items[grupo.code]}
                  onChange={(v) => setItem(grupo.code, v)}
                />
                {grupo.children.map(child => (
                  <ChecklistItem
                    key={child.code}
                    code={child.code}
                    label={child.label}
                    value={state.items[child.code]}
                    onChange={(v) => setItem(child.code, v)}
                    disabled={!isChildEnabled(grupo.code)}
                    indent
                  />
                ))}
              </div>
            ))}
          </div>
        </Section>

        <Section title="7.2 Registro de datos de vuelo y eventos">

          {/* 7.2.1 Registros de actividad de vuelo */}
          <ChecklistItem
            code={SECCION_721_GRUPO.code}
            label={SECCION_721_GRUPO.label}
            value={state.items[SECCION_721_GRUPO.code]}
            onChange={(v) => setItem(SECCION_721_GRUPO.code, v)}
            withComment
            comment={state.comentarios[SECCION_721_GRUPO.code]}
            onCommentChange={(t) => setComentario(SECCION_721_GRUPO.code, t)}
          />
          <div className="pl-6 border-l-2 border-slate-200 space-y-1">
            {SECCION_721_GRUPO.children.map(child => (
              <div key={child.code}>
                <ChecklistItem
                  code={child.code}
                  label={child.label}
                  value={state.items[child.code]}
                  onChange={(v) => setItem(child.code, v)}
                  withComment
                  comment={state.comentarios[child.code]}
                  onCommentChange={(t) => setComentario(child.code, t)}
                />
                {/* Datos de vuelo asociados a 7.2.1.1 */}
                {child.hasFlightData && (
                  <div className="ml-14 mb-3 bg-slate-50 rounded p-3 border border-slate-200">
                    <p className="text-xs text-slate-600 mb-2 font-medium">
                      Datos de vuelo (se usarán en el Apéndice 14 y en el libro de mantenimiento):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-700 mb-1">Tiempo de operación (HH:MM)</label>
                        <input
                          type="time"
                          value={state.tiempo_operacion}
                          onChange={(e) => setState(s => ({ ...s, tiempo_operacion: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-invicsa-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-700 mb-1">Nº de aterrizajes</label>
                        <input
                          type="number"
                          min="0"
                          value={state.n_aterrizajes}
                          onChange={(e) => setState(s => ({ ...s, n_aterrizajes: e.target.value }))}
                          placeholder="1"
                          className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-invicsa-400"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 7.2.2 Registro y comunicación de eventos significativos */}
          <div className="mt-3">
            <ChecklistItem
              code={SECCION_722_GRUPO.code}
              label={SECCION_722_GRUPO.label}
              value={state.items[SECCION_722_GRUPO.code]}
              onChange={(v) => setItem(SECCION_722_GRUPO.code, v)}
              withComment
              comment={state.comentarios[SECCION_722_GRUPO.code]}
              onCommentChange={(t) => setComentario(SECCION_722_GRUPO.code, t)}
            />
            <div className="pl-6 border-l-2 border-slate-200">
              {SECCION_722_GRUPO.children.map(child => (
                <ChecklistItem
                  key={child.code}
                  code={child.code}
                  label={child.label}
                  value={state.items[child.code]}
                  onChange={(v) => setItem(child.code, v)}
                  withComment
                  comment={state.comentarios[child.code]}
                  onCommentChange={(t) => setComentario(child.code, t)}
                />
              ))}
            </div>
          </div>

          {/* 7.2.3 Aeronave (Sí/No + Obs.) */}
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">7.2.3 Aeronave</h3>
            <p className="text-xs text-slate-500 mb-2 italic">Marcar Sí/No para cada componente. Usar el comentario para anotar incidencias.</p>
            <div className="divide-y divide-slate-100">
              {SECCION_723_ITEMS.map(item => (
                <ChecklistItem
                  key={item.code}
                  code={item.code}
                  label={item.label}
                  value={state.items[item.code]}
                  onChange={(v) => setItem(item.code, v)}
                  options="siNo"
                  withComment
                  comment={state.comentarios[item.code]}
                  onCommentChange={(t) => setComentario(item.code, t)}
                />
              ))}
            </div>
          </div>
        </Section>

        <Section title="Notas adicionales (opcional)">
          <textarea
            value={state.notas}
            onChange={(e) => setState(s => ({ ...s, notas: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-invicsa-400"
          />
        </Section>

        <Section title="Aprobación del piloto a distancia">
          <Input
            label="Nombre del firmante"
            value={state.firmanteName}
            onChange={(e) => setState(s => ({ ...s, firmanteName: e.target.value }))}
            className="mb-3"
          />
          <SignaturePad value={state.firma} onChange={(firma) => setState(s => ({ ...s, firma }))} />
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
        <span className="text-xs text-slate-500">{draftStatus || 'Borrador autoguardado en este dispositivo'}</span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onBack} type="button">Volver</Button>
          <Button onClick={onSign} loading={saving}>Firmar y guardar</Button>
        </div>
      </div>
    </div>
  );
}
