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
import MapDrawer from '../components/MapDrawer';
import ImageUpload from '../components/ImageUpload';
import SignaturePad from '../components/SignaturePad';

// Numeración oficial Manual de Operaciones edición 9 revisión 10.

const ZONAS_GEOGRAFICAS = [
  { code: '0.4.1', label: 'Espacio aéreo controlado y zonas de información de vuelo (FIZ)', children: [
    { code: '0.4.1.1', label: 'Se cuenta con un estudio aeronáutico de seguridad específico coordinado con el ATSP' }
  ]},
  { code: '0.4.2', label: 'Entorno de aeródromos o helipuertos, civiles o militares', children: [
    { code: '0.4.2.1', label: 'Se ha realizado una coordinación previa con el gestor de la infraestructura y proveedor ATS si lo hubiera' }
  ]},
  { code: '0.4.3', label: 'Zonas prohibidas, restringidas y asociadas a la gestión flexible del espacio aéreo', children: [
    { code: '0.4.3.1', label: 'Se cumple con las condiciones y limitaciones o se cuenta con la autorización pertinente del gestor del área' }
  ]},
  { code: '0.4.4', label: 'Zonas de seguridad militar, de la Defensa Nacional y de la seguridad del Estado', children: [
    { code: '0.4.4.1', label: 'Se cuenta con permiso previo y expreso del titular de la zona o del gestor responsable' }
  ]},
  { code: '0.4.5', label: 'Instalaciones que prestan servicios esenciales para la comunidad', children: [
    { code: '0.4.5.1', label: 'Se cuenta con permiso previo y expreso del titular de la zona o del gestor responsable' }
  ]},
  { code: '0.4.6', label: 'Entornos urbanos', children: [
    { code: '0.4.6.1a', label: 'Se cumplen con las distancias a edificios determinadas en la declaración operacional o autorización' },
    { code: '0.4.6.1b', label: 'Se ha realizado la comunicación al Ministerio del Interior al menos con 5 días de antelación a la operación' }
  ]},
  { code: '0.4.7', label: 'Zona Restringida al Vuelo Fotográfico (ZRVF)', children: [
    { code: '0.4.7.1', label: 'Se cuenta con el permiso del CECAF para la toma de imágenes' }
  ]},
  { code: '0.4.8', label: 'Zonas de protección medioambiental', children: [
    { code: '0.4.8.1', label: 'Se dispone de coordinación con el gestor del espacio' }
  ]}
];

const REQUISITOS_HEADER = { code: '0.6.1', label: 'CONOPS y modelo semántico', isHeader: true };
const REQUISITOS_061 = [
  { code: '0.6.1.1', label: 'Se aplica e identifica el modelo semántico en la zona de vuelo y este se ajusta al CONOPS autorizado' },
  { code: '0.6.1.2', label: 'Se define la geografía del vuelo junto con el perfil de vuelos en función del CONOPS (alcance máximo, altura máxima, VLOS/BVLOS...) y los obstáculos y orografía' },
  { code: '0.6.1.3', label: 'Se define el volumen de contingencia' },
  { code: '0.6.1.4', label: 'Se define el margen por riesgo en tierra' },
  { code: '0.6.1.5', label: 'Se planifica la ubicación de observadores y/o asistentes' },
  { code: '0.6.1.6', label: 'Se define el área adyacente' },
  { code: '0.6.1.7', label: 'La densidad de población en la geografía de vuelo y el área adyacente se ajustan al ConOps' }
];

const REQUISITOS_NOTAM_HEADER = { code: '0.6.2', label: 'NOTAMs', isHeader: true };
const REQUISITOS_062 = [
  { code: '0.6.2.1', label: 'Se revisan los NOTAMs activos y no existen limitaciones a la operación' },
  { code: '0.6.2.2', label: 'Si la operación debe realizarse en TSA o está condicionada a la publicación previa de NOTAM, se solicita al COOP de ENAIRE su promulgación' }
];

const REQUISITOS_OTRAS = { code: '0.6.4', label: 'Otras limitaciones', isHeader: true };

function buildInitialState(defaultName) {
  const items = {};
  ZONAS_GEOGRAFICAS.forEach(z => {
    items[z.code] = null;
    z.children.forEach(c => { items[c.code] = null; });
  });
  REQUISITOS_061.forEach(r => { items[r.code] = null; });
  REQUISITOS_062.forEach(r => { items[r.code] = null; });
  items['0.6.4.1'] = null;
  return {
    items,
    otras_limitaciones_texto: '',
    enaire_image_url: null,
    map: { geografia: null, contingencia: null, grb: null, snapshotUrl: null },
    firma: null,
    firmanteName: defaultName || '',
    notas: ''
  };
}

export default function Apendice4Page({ op: opInitial, onBack, onSigned }) {
  const { user } = useAuth();
  const [op, setOp] = useState(opInitial);
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
        setOp(fresh.op);
        const ap4 = fresh.apendices.find(a => String(a.apendice_num) === '4');
        if (ap4) {
          const parsed = typeof ap4.payload_json === 'string' ? JSON.parse(ap4.payload_json) : ap4.payload_json;
          setState({
            ...buildInitialState(user?.nombre_completo),
            ...parsed,
            firma: ap4.firma_dataurl || null,
            firmanteName: parsed.firmanteName || user?.nombre_completo || ''
          });
          setLoading(false);
          return;
        }
        const draft = await drafts.loadDraft(op.id, '4');
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
      try {
        await drafts.saveDraft(op.id, '4', state);
        setDraftStatus('guardado');
        setTimeout(() => setDraftStatus(''), 1500);
      } catch { setDraftStatus('error guardando'); }
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

  async function handleZoneConfirmed({ snapshotUrl, lat, lon, ubicacion }) {
    const fields = {};
    if (lat !== null && lat !== undefined) fields.lat = lat.toFixed(5);
    if (lon !== null && lon !== undefined) fields.lon = lon.toFixed(5);
    if (ubicacion && !op.ubicacion) fields.ubicacion = ubicacion;
    if (Object.keys(fields).length === 0) return;
    try {
      await api.updateOp(op.id, fields);
      setOp(prev => ({ ...prev, ...fields }));
    } catch (e) {
      console.error('No se pudo actualizar lat/lon/ubicacion:', e.message);
    }
  }

  function validate() {
    const missing = [];
    ZONAS_GEOGRAFICAS.forEach(z => {
      if (!state.items[z.code]) missing.push(z.code);
      if (state.items[z.code] === 'si') {
        z.children.forEach(c => {
          if (!state.items[c.code]) missing.push(c.code);
        });
      }
    });
    REQUISITOS_061.forEach(r => { if (!state.items[r.code]) missing.push(r.code); });
    REQUISITOS_062.forEach(r => { if (!state.items[r.code]) missing.push(r.code); });
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
      const res = await signAndGeneratePdf(op, '4', payload, firma, {
        onProgress: setPdfStatus
      });
      await drafts.deleteDraft(op.id, '4');
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
        <Header title="Apéndice 4" onBack={onBack} />
        <div className="text-center py-12 text-slate-500">Cargando...</div>
      </div>
    );
  }

  const personal = op.observadores ? `${user.nombre_completo}, ${op.observadores}` : user.nombre_completo;

  return (
    <div className="min-h-screen pb-24">
      <Header title="Apéndice 4 — Lista de planificación operacional" subtitle={`${op.id} · ${op.titulo}`} onBack={onBack} />

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        <Section title="0.1 Información sobre las operaciones">
          <Field label="Título y/o código" value={op.titulo} />
          <Field label="Descripción y objetivos" value={op.descripcion} />
          <Field label="Fecha y horas previstas" value={formatFechaHoras(op.fecha, op.inicio_hl, op.fin_hl)} />
          <Field label="Personal necesario" value={personal} />
          <Field label="UAS previsto" value={op.uas_id} />
          <Field label="Medios materiales / categoría" value={op.categoria} />
        </Section>

        <Section title="0.2 Evaluación del escenario de operaciones">
          <Field label="Dirección" value={op.ubicacion} />
          <Field label="Coordenadas aprox." value={(op.lat && op.lon) ? `${op.lat}, ${op.lon}` : '—'} />
        </Section>

        <Section title="0.3 Espacio aéreo (ENAIRE Drones)">
          <p className="text-sm text-slate-600 mb-2">
            Sube una captura de pantalla del visor de ENAIRE Drones para la zona de operación.
          </p>
          <ImageUpload
            opId={op.id}
            kind="enaire_drones"
            label=""
            value={state.enaire_image_url}
            onChange={(url) => setState(s => ({ ...s, enaire_image_url: url }))}
          />
        </Section>

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

        <Section title="0.5 Zona de vuelo">
          <p className="text-sm text-slate-600 mb-3">
            Dibuja sobre el mapa: <b className="text-emerald-700">geografía de vuelo</b>, <b className="text-orange-700">volumen de contingencia</b> y <b className="text-red-700">GRB</b>. Al pulsar "Confirmar zona", se fijan las coordenadas y la ubicación.
          </p>
          <MapDrawer
            opId={op.id}
            lat={op.lat}
            lon={op.lon}
            value={state.map}
            onChange={(map) => setState(s => ({ ...s, map }))}
            onZoneConfirmed={handleZoneConfirmed}
          />
        </Section>

        <Section title="0.6 Requisitos y limitaciones en la zona de vuelo">
          <ChecklistItem header code={REQUISITOS_HEADER.code} label={REQUISITOS_HEADER.label} />
          <div className="divide-y divide-slate-100">
            {REQUISITOS_061.map(r => (
              <ChecklistItem
                key={r.code}
                code={r.code}
                label={r.label}
                value={state.items[r.code]}
                onChange={(v) => setItem(r.code, v)}
                indent
              />
            ))}
          </div>

          <div className="mt-4">
            <ChecklistItem header code={REQUISITOS_NOTAM_HEADER.code} label={REQUISITOS_NOTAM_HEADER.label} />
            <div className="divide-y divide-slate-100">
              {REQUISITOS_062.map(r => (
                <ChecklistItem
                  key={r.code}
                  code={r.code}
                  label={r.label}
                  value={state.items[r.code]}
                  onChange={(v) => setItem(r.code, v)}
                  indent
                />
              ))}
            </div>
          </div>

          <div className="mt-4">
            <ChecklistItem header code={REQUISITOS_OTRAS.code} label={REQUISITOS_OTRAS.label} />
            <div className="pl-6">
              <textarea
                value={state.otras_limitaciones_texto}
                onChange={(e) => setState(s => ({ ...s, otras_limitaciones_texto: e.target.value }))}
                rows={2}
                placeholder="Describe otras limitaciones aplicables (opcional)..."
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-invicsa-400"
              />
            </div>
          </div>
        </Section>

        <Section title="Notas adicionales (opcional)">
          <textarea
            value={state.notas}
            onChange={(e) => setState(s => ({ ...s, notas: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-invicsa-400"
            placeholder="Observaciones sobre la planificación..."
          />
        </Section>

        <Section title="0.6.5 Aprobación del responsable de planificación">
          <Input
            label="Nombre del firmante"
            value={state.firmanteName}
            onChange={(e) => setState(s => ({ ...s, firmanteName: e.target.value }))}
            placeholder="Ej. Víctor Martínez Prieto"
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
