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

// Numeración oficial Manual de Operaciones edición 9 revisión 10.
//
// Sección 1 - Lugar de la operación: tiene jerarquía padre/hijo.
//   1.1   Evaluación del área (cabecera, no es checklist)
//     1.1.1 Terreno, obstáculos y obstrucciones (Sí/No/N/A)
//       1.1.1.1, 1.1.1.2 (sub-ítems condicionales)
//     1.2.2 NOTAM (Sí/No/N/A)
//       1.2.2.1, 1.2.2.2 (sub-ítems condicionales)
//     1.2.3 Si la operación se lleva a cabo en espacio aéreo controlado o FIZ (Sí/No/N/A)
//       1.2.3.1 (sub-ítem condicional)
//     1.1.4 Si la operación se lleva a cabo próxima a aeropuertos (Sí/No/N/A)
//       1.1.4.1 (sub-ítem condicional)

const SECCION_1_GRUPOS = [
  {
    code: '1.1.1',
    label: 'Terreno, obstáculos y obstrucciones',
    children: [
      { code: '1.1.1.1', label: 'Se ha realizado una evaluación del cumplimiento entre la visibilidad y el alcance planificado' },
      { code: '1.1.1.2', label: 'Los observadores están correctamente posicionados' }
    ]
  },
  {
    code: '1.2.2',
    label: 'NOTAM',
    children: [
      { code: '1.2.2.1', label: 'Se revisan los NOTAMs activos y no existen limitaciones a la operación' },
      { code: '1.2.2.2', label: 'Si la operación debe realizarse en TSA o está condicionada a la publicación previa de NOTAM, se confirma que la correcta publicación del NOTAM informado de la TSA o actividad con UAS' }
    ]
  },
  {
    code: '1.2.3',
    label: 'Si la operación se lleva a cabo en espacio aéreo controlado o FIZ',
    children: [
      { code: '1.2.3.1', label: 'Se cumplen con los procedimientos acordados con el ATSP' }
    ]
  },
  {
    code: '1.1.4',
    label: 'Si la operación se lleva a cabo próxima a aeropuertos, aeródromos y helipuertos',
    children: [
      { code: '1.1.4.1', label: 'Se han aplicado los condicionantes acordados con el gestor de la infraestructura (p.ej. notificación a usuarios, llamada al gestor...)' }
    ]
  }
];

const SECCION_2 = {
  title: '2. Condiciones ambientales y climatológicas',
  items: [
    { code: '2.1.1', label: 'Las condiciones climatológicas no exceden los máximos previstos por el operador y/o por el fabricante del UAS para llevar a cabo la operación' }
  ]
};

const SECCION_3 = {
  title: '3. Procedimientos de comunicación',
  items: [
    { code: '3.1', label: 'Se dispone de los medios requeridos para la comunicación entre el personal a cargo de las tareas esenciales para la operación del UAS y funcionan correctamente' },
    { code: '3.2', label: 'Se dispone de los medios requeridos para la comunicación con terceras partes cuando sea necesario y funcionan correctamente' }
  ]
};

const SECCION_4 = {
  title: '4. Atenuaciones al riesgo',
  items: [
    { code: '4.1', label: 'Las atenuaciones del GRC están implementadas' },
    { code: '4.2', label: 'Las atenuaciones del ARC están implementadas' }
  ]
};

const SECCION_5 = {
  title: '5. El UAS es aeronavegable',
  items: [
    { code: '5.1',  label: 'Estructura (Cableado, impactos, luces centro de gravedad, etc.)' },
    { code: '5.2',  label: 'Sensores (GNSS, accelerómetro, barómetro, etc.)' },
    { code: '5.3',  label: 'Motores (Giran libremente, sentido de giro correcto)' },
    { code: '5.4',  label: 'Hélices (Sin muescas, correctamente instaladas)' },
    { code: '5.5',  label: 'Unidad de control (Batería cargada, sujeta)' },
    { code: '5.6',  label: 'Partes Móviles (Funcionamiento correcto, sin impactos)' },
    { code: '5.7',  label: 'Comunicaciones (Antenas, recepción correcta, calidad de señal)' },
    { code: '5.8',  label: 'Planta de potencia (Correcto estado y alimentación)' },
    { code: '5.9',  label: 'Carga de pago (En funcionamiento, memoria suficiente)' },
    { code: '5.10', label: 'DRI (Datos de operador cargados, transmisión correcta)' },
    { code: '5.11', label: 'Sistema de geoconsciencia (Activado y configurado)' },
    { code: '5.12', label: 'Otros aspectos ligados al ConOps (paracaídas, anclajes, etc.)' }
  ]
};

const SECCION_1_CODES = SECCION_1_GRUPOS.flatMap(g => [g.code, ...g.children.map(c => c.code)]);
const ALL_CHECKLIST_CODES = [
  ...SECCION_1_CODES,
  ...SECCION_2.items.map(i => i.code),
  ...SECCION_3.items.map(i => i.code),
  ...SECCION_4.items.map(i => i.code),
  ...SECCION_5.items.map(i => i.code)
];

function buildInitialState(defaultName) {
  const items = {};
  ALL_CHECKLIST_CODES.forEach(c => { items[c] = null; });
  return {
    items,
    // Sección 6 Aptitud para operar: 3 nombres de tripulación con un check Sí cada uno
    tripulacion: [
      { nombre: '', apto: false },
      { nombre: '', apto: false },
      { nombre: '', apto: false }
    ],
    firma: null,
    firmanteName: defaultName || '',
    notas: ''
  };
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
            ...buildInitialState(user?.nombre_completo),
            ...parsed,
            firma: ap.firma_dataurl || null,
            firmanteName: parsed.firmanteName || user?.nombre_completo || ''
          });
          setLoading(false);
          return;
        }
        const draft = await drafts.loadDraft(op.id, '5');
        if (draft) {
          setState({
            ...buildInitialState(user?.nombre_completo),
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
      try { await drafts.saveDraft(op.id, '5', state); setDraftStatus('guardado'); setTimeout(() => setDraftStatus(''), 1500); }
      catch { setDraftStatus('error guardando'); }
    }, 800);
    return () => clearTimeout(draftTimer.current);
  }, [state, loading, op.id]);

  function setItem(code, value) {
    setState(s => {
      const newItems = { ...s.items, [code]: value };
      // Lógica condicional: si un padre 1.X.X cambia a No/N/A, sus hijos se ponen en N/A
      const grupo = SECCION_1_GRUPOS.find(g => g.code === code);
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

  function isChildEnabled(parentCode) {
    return state.items[parentCode] === 'si';
  }

  function updateTripulante(idx, field, value) {
    setState(s => ({
      ...s,
      tripulacion: s.tripulacion.map((t, i) => i === idx ? { ...t, [field]: value } : t)
    }));
  }

  function validate() {
    const missing = [];
    // Padres siempre obligatorios
    SECCION_1_GRUPOS.forEach(g => {
      if (!state.items[g.code]) missing.push(g.code);
      if (state.items[g.code] === 'si') {
        g.children.forEach(c => {
          if (!state.items[c.code]) missing.push(c.code);
        });
      }
    });
    // Resto de secciones
    [SECCION_2, SECCION_3, SECCION_4, SECCION_5].forEach(sec => {
      sec.items.forEach(item => {
        if (!state.items[item.code]) missing.push(item.code);
      });
    });
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
      await api.signApendice(op.id, '5', payload, firma);
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
      <Header title="Apéndice 5 — Lista verificación prevuelo" subtitle={`${op.id} · ${op.titulo}`} onBack={onBack} />

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <Section title="Datos de la operación">
          <Field label="Título y/o código" value={op.titulo} />
          <Field label="CONOPS / Categoría" value={op.categoria} />
          <Field label="Fecha y horas previstas" value={formatFechaHoras(op.fecha, op.inicio_hl, op.fin_hl)} />
          <Field label="Piloto a distancia" value={user.nombre_completo} />
          <Field label="UAS" value={op.uas_id} />
        </Section>

        <Section title="1. Lugar de la operación">
          <p className="text-sm text-slate-600 mb-3 italic">Evaluación del área de operación y el área circundante</p>
          <div className="divide-y divide-slate-100">
            {SECCION_1_GRUPOS.map(grupo => (
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

        {[SECCION_2, SECCION_3, SECCION_4, SECCION_5].map(sec => (
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

        <Section title="6. Aptitud para operar">
          <p className="text-sm text-slate-600 mb-3 italic">
            La tripulación a distancia se encuentra en condiciones adecuadas para la operación y conocen las tareas a su puesto.
          </p>
          <div className="space-y-2">
            {state.tripulacion.map((t, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-500 w-12 flex-shrink-0">6.1.{i + 1}</span>
                <input
                  type="text"
                  placeholder="Nombre del tripulante (opcional)"
                  value={t.nombre}
                  onChange={(e) => updateTripulante(i, 'nombre', e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-invicsa-400"
                />
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={t.apto}
                    onChange={(e) => updateTripulante(i, 'apto', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-invicsa-700 focus:ring-invicsa-400"
                  />
                  <span className="text-sm text-slate-700">Apto</span>
                </label>
              </div>
            ))}
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
        <span className="text-xs text-slate-500">{draftStatus || 'Borrador autoguardado en este dispositivo'}</span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onBack} type="button">Volver</Button>
          <Button onClick={onSign} loading={saving}>Firmar y guardar</Button>
        </div>
      </div>
    </div>
  );
}
