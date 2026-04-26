import { useEffect, useRef, useState } from 'react';
import * as api from '../lib/api';
import * as drafts from '../lib/draftStorage';
import Header from '../components/Header';
import Button from '../components/Button';
import ChecklistItem from '../components/ChecklistItem';
import MapDrawer from '../components/MapDrawer';
import SignaturePad from '../components/SignaturePad';

// Estructura del Apéndice 4 según plantilla del Manual de Operaciones.
// Sección 0.4 incluye sub-ítems condicionales (si "padre" es Sí, se habilita el hijo).

const ZONAS_GEOGRAFICAS = [
  {
    code: '0.4.1',
    label: 'Espacio aéreo controlado y FIZ',
    children: [
      { code: '0.4.1.1', label: 'Estudio aeronáutico de seguridad con ATSP' }
    ]
  },
  {
    code: '0.4.2',
    label: 'Entorno de aeródromos o helipuertos',
    children: [
      { code: '0.4.2.1', label: 'Coordinación previa con el gestor' }
    ]
  },
  {
    code: '0.4.3',
    label: 'Zonas prohibidas, restringidas',
    children: [
      { code: '0.4.3.1', label: 'Cumple condiciones o cuenta con autorización' }
    ]
  },
  {
    code: '0.4.4',
    label: 'Zonas de seguridad militar',
    children: [
      { code: '0.4.4.1', label: 'Permiso previo del titular/gestor' }
    ]
  },
  {
    code: '0.4.5',
    label: 'Instalaciones de servicios esenciales',
    children: [
      { code: '0.4.5.1', label: 'Permiso previo del titular/gestor' }
    ]
  },
  {
    code: '0.4.6',
    label: 'Entornos urbanos',
    children: [
      { code: '0.4.6.1a', label: 'Cumple distancias a edificios' },
      { code: '0.4.6.1b', label: 'Comunicación al Min. Interior (5 días)' }
    ]
  },
  {
    code: '0.4.7',
    label: 'Zona Restringida al Vuelo Fotográfico',
    children: [
      { code: '0.4.7.1', label: 'Permiso del CECAF' }
    ]
  },
  {
    code: '0.4.8',
    label: 'Zonas de protección medioambiental',
    children: [
      { code: '0.4.8.1', label: 'Coordinación con gestor del espacio' }
    ]
  }
];

const REQUISITOS = [
  { code: '0.6.1.1', label: 'Modelo semántico ajustado al CONOPS' },
  { code: '0.6.1.2', label: 'Geografía y perfil de vuelos definidos' },
  { code: '0.6.1.3', label: 'Volumen de contingencia definido' },
  { code: '0.6.1.4', label: 'Margen por riesgo en tierra definido' },
  { code: '0.6.1.5', label: 'Ubicación de observadores/asistentes' },
  { code: '0.6.1.6', label: 'Área adyacente definida' },
  { code: '0.6.1.7', label: 'Densidad de población ajustada al ConOps' },
  { code: '0.6.2.1', label: 'NOTAMs revisados sin limitaciones' },
  { code: '0.6.2.2', label: 'Solicitud NOTAM a COOP ENAIRE si procede' }
];

function buildInitialState() {
  const items = {};
  ZONAS_GEOGRAFICAS.forEach(z => {
    items[z.code] = null;
    z.children.forEach(c => { items[c.code] = null; });
  });
  REQUISITOS.forEach(r => { items[r.code] = null; });
  return {
    items,
    map: { geografia: null, contingencia: null, grb: null, snapshot: null },
    firma: null,
    notas: ''
  };
}

export default function Apendice4Page({ op, onBack, onSigned }) {
  const [state, setState] = useState(buildInitialState());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [draftStatus, setDraftStatus] = useState(''); // '' | 'guardando...' | 'guardado'
  const draftTimer = useRef(null);

  // Cargar borrador o datos previos firmados al entrar
  useEffect(() => {
    (async () => {
      try {
        // 1. Intentar cargar firmado del servidor
        const fresh = await api.getOp(op.id);
        const ap4 = fresh.apendices.find(a => String(a.apendice_num) === '4');
        if (ap4) {
          const parsed = typeof ap4.payload_json === 'string'
            ? JSON.parse(ap4.payload_json)
            : ap4.payload_json;
          setState({
            items: parsed.items || buildInitialState().items,
            map: parsed.map || buildInitialState().map,
            firma: ap4.firma_dataurl || null,
            notas: parsed.notas || ''
          });
          setLoading(false);
          return;
        }
        // 2. Si no hay firmado, intentar borrador local
        const draft = await drafts.loadDraft(op.id, '4');
        if (draft) setState(draft);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [op.id]);

  // Auto-guardado de borrador (debounced 800ms)
  useEffect(() => {
    if (loading) return;
    setDraftStatus('guardando...');
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(async () => {
      try {
        await drafts.saveDraft(op.id, '4', state);
        setDraftStatus('guardado');
        setTimeout(() => setDraftStatus(''), 1500);
      } catch {
        setDraftStatus('error guardando borrador');
      }
    }, 800);
    return () => clearTimeout(draftTimer.current);
  }, [state, loading, op.id]);

  function setItem(code, value) {
    setState(s => {
      const newItems = { ...s.items, [code]: value };
      // Si un padre 0.4.X cambia a No o N/A, sus hijos se ponen automáticamente a N/A
      const zona = ZONAS_GEOGRAFICAS.find(z => z.code === code);
      if (zona && (value === 'no' || value === 'na')) {
        zona.children.forEach(c => { newItems[c.code] = 'na'; });
      }
      // Si un padre cambia a Sí, sus hijos se resetean a null para que el piloto los conteste
      if (zona && value === 'si') {
        zona.children.forEach(c => {
          if (newItems[c.code] === 'na') newItems[c.code] = null;
        });
      }
      return { ...s, items: newItems };
    });
  }

  function isChildEnabled(parentCode) {
    return state.items[parentCode] === 'si';
  }

  function validate() {
    const missing = [];
    // Todos los items de zonas (padres siempre obligatorios; hijos solo si padre = sí)
    ZONAS_GEOGRAFICAS.forEach(z => {
      if (!state.items[z.code]) missing.push(z.code);
      if (state.items[z.code] === 'si') {
        z.children.forEach(c => {
          if (!state.items[c.code]) missing.push(c.code);
        });
      }
    });
    REQUISITOS.forEach(r => {
      if (!state.items[r.code]) missing.push(r.code);
    });
    if (!state.firma) missing.push('firma');
    return missing;
  }

  async function handleSign() {
    setError(null);
    const missing = validate();
    if (missing.length > 0) {
      setError(`Faltan campos por completar: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`);
      return;
    }
    setSaving(true);
    try {
      await api.signApendice(op.id, '4', {
        items: state.items,
        map: state.map,
        notas: state.notas
      }, state.firma);
      await drafts.deleteDraft(op.id, '4');
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
        <Header title="Apéndice 4" onBack={onBack} />
        <div className="text-center py-12 text-slate-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <Header
        title="Apéndice 4 — Planificación operacional"
        subtitle={`${op.id} · ${op.titulo}`}
        onBack={onBack}
      />

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* 0.1 Información de la operación (solo lectura, viene de la op) */}
        <Section title="0.1 Información sobre las operaciones">
          <Field label="Título y/o código" value={op.titulo} />
          <Field label="Descripción y objetivos" value={op.descripcion} />
          <Field label="Fecha y horas previstas" value={`${op.fecha} · ${op.inicio_hl} - ${op.fin_hl} (HL)`} />
          <Field label="Personal necesario" value={op.observadores ? `${op.piloto_username}, ${op.observadores}` : op.piloto_username} />
          <Field label="UAS previsto" value={op.uas_id} />
          <Field label="CONOPS / Categoría" value={op.categoria} />
        </Section>

        {/* 0.2 Escenario */}
        <Section title="0.2 Evaluación del escenario de operaciones">
          <Field label="Dirección" value={op.ubicacion} />
          <Field label="Coordenadas" value={(op.lat && op.lon) ? `${op.lat}, ${op.lon}` : '—'} />
        </Section>

        {/* 0.3 Mapa */}
        <Section title="0.3 Áreas operacionales">
          <p className="text-sm text-slate-600 mb-3">
            Dibuja las áreas operacionales sobre el mapa: <b className="text-emerald-700">geografía de vuelo</b>, <b className="text-orange-700">volumen de contingencia</b> y <b className="text-red-700">GRB</b>. Captura la imagen al terminar para incluirla en el PDF.
          </p>
          <MapDrawer
            lat={op.lat}
            lon={op.lon}
            value={state.map}
            onChange={(map) => setState(s => ({ ...s, map }))}
          />
        </Section>

        {/* 0.4 Zonas geográficas */}
        <Section title="0.4 Zonas geográficas de UAS">
          <div className="divide-y divide-slate-100">
            {ZONAS_GEOGRAFICAS.map(zona => (
              <div key={zona.code}>
                <ChecklistItem
                  code={zona.code}
                  label={zona.label}
                  value={state.items[zona.code]}
                  onChange={(v) => setItem(zona.code, v)}
                />
                {zona.children.map(child => (
                  <ChecklistItem
                    key={child.code}
                    code={child.code}
                    label={child.label}
                    value={state.items[child.code]}
                    onChange={(v) => setItem(child.code, v)}
                    disabled={!isChildEnabled(zona.code)}
                    indent
                  />
                ))}
              </div>
            ))}
          </div>
        </Section>

        {/* 0.6 Requisitos y limitaciones */}
        <Section title="0.6 Requisitos y limitaciones">
          <div className="divide-y divide-slate-100">
            {REQUISITOS.map(r => (
              <ChecklistItem
                key={r.code}
                code={r.code}
                label={r.label}
                value={state.items[r.code]}
                onChange={(v) => setItem(r.code, v)}
              />
            ))}
          </div>
        </Section>

        {/* Notas opcionales */}
        <Section title="Notas adicionales (opcional)">
          <textarea
            value={state.notas}
            onChange={(e) => setState(s => ({ ...s, notas: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-invicsa-400"
            placeholder="Observaciones sobre la planificación..."
          />
        </Section>

        {/* Firma */}
        <Section title="0.6.5 Aprobación del responsable de planificación">
          <SignaturePad
            value={state.firma}
            onChange={(firma) => setState(s => ({ ...s, firma }))}
          />
        </Section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
            {error}
          </div>
        )}
      </main>

      {/* Barra inferior fija con estado y botón firmar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-md z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {draftStatus || 'Borrador autoguardado en este dispositivo'}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onBack} type="button">Volver</Button>
            <Button onClick={handleSign} loading={saving}>
              Firmar y guardar
            </Button>
          </div>
        </div>
      </div>
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
