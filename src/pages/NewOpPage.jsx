import { useEffect, useState } from 'react';
import * as api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import Button from '../components/Button';
import Input from '../components/Input';

const TIPOS_OP = [
  'Audiovisual',
  'Topografía',
  '3D',
  'Inspección',
  'Formación',
  'Agricultura',
  'Carga',
  'Otros'
];

const CATEGORIAS = [
  'Abierta - A1',
  'Abierta - A2',
  'Abierta - A3',
  'STS-ES-01',
  'STS-01',
  'STS-02',
  'PDRA S01 [F]',
  'BVLOS Deslocalizado',
  'Inspecciones industriales deslocalizadas',
  'Operaciones en Altura',
  'Operaciones Carga',
  'Operaciones rurales deslocalizadas'
];

const VALORES_AUT = ['Autorizado', 'No', 'No Aplica'];

export default function NewOpPage({ onCreated, onCancel }) {
  const { user } = useAuth();
  const isGestor = user?.rol === 'gestor';

  const [uas, setUas] = useState([]);
  const [pilotos, setPilotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    titulo: '',
    tipo: 'Audiovisual',
    descripcion: '',
    fecha: new Date().toISOString().slice(0, 10),
    inicio_hl: '',
    fin_hl: '',
    categoria: 'Abierta - A3',
    piloto_username: user?.rol === 'piloto' ? user.username : '',
    uas_id: '',
    altura_max_m: '120',
    ctr: 'No',
    tiempo_vuelo_h: '',
    aut_ctr: 'No Aplica',
    aut_cecaf: 'No Aplica',
    n_oia: '',
    oia_finalizada: '',
    aut_aerodromo_1: 'No Aplica',
    aut_aerodromo_2: 'No Aplica',
    aut_aerodromo_3: 'No Aplica',
    aut_naturaleza: 'No Aplica',
    aut_infraestr_critica: 'No Aplica',
    aut_min_interior: 'No Aplica',
    ubicacion: '',
    lat: '',
    lon: '',
    observadores: ''
  });

  useEffect(() => {
    (async () => {
      try {
        const [u, p] = await Promise.all([
          api.listUAS(),
          isGestor ? api.listPilotos() : Promise.resolve([])
        ]);
        setUas(u);
        setPilotos(p.filter(x => x.activo && x.rol === 'piloto'));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [isGestor]);

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!form.titulo || !form.fecha || !form.piloto_username || !form.uas_id) {
      setError('Faltan campos obligatorios: título, fecha, piloto y UAS.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.createOp(form);
      onCreated(created);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Nueva operación" onBack={onCancel} />
        <div className="text-center py-12 text-slate-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Nueva operación" onBack={onCancel} />

      <main className="max-w-3xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">

          <Section title="Identificación">
            <Input
              label="Título de la operación *"
              value={form.titulo}
              onChange={(e) => update('titulo', e.target.value)}
              placeholder="Ej. Inspección Torre Norte"
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select label="Tipo *" value={form.tipo} onChange={(v) => update('tipo', v)} options={TIPOS_OP} />
              <Select label="Categoría / ConOps *" value={form.categoria} onChange={(v) => update('categoria', v)} options={CATEGORIAS} />
            </div>
            <Input
              label="Descripción y objetivos"
              value={form.descripcion}
              onChange={(e) => update('descripcion', e.target.value)}
              placeholder="Breve descripción del objetivo del vuelo"
            />
          </Section>

          <Section title="Fecha y horario">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Fecha *"
                type="date"
                value={form.fecha}
                onChange={(e) => update('fecha', e.target.value)}
                required
              />
              <Input
                label="Hora inicio (HL)"
                type="time"
                value={form.inicio_hl}
                onChange={(e) => update('inicio_hl', e.target.value)}
              />
              <Input
                label="Hora fin (HL)"
                type="time"
                value={form.fin_hl}
                onChange={(e) => update('fin_hl', e.target.value)}
              />
            </div>
            <Input
              label="Tiempo de vuelo previsto (horas)"
              type="number"
              step="0.1"
              value={form.tiempo_vuelo_h}
              onChange={(e) => update('tiempo_vuelo_h', e.target.value)}
              placeholder="Ej. 2.5"
            />
          </Section>

          <Section title="Personal y aeronave">
            {isGestor && (
              <Select
                label="Piloto a distancia *"
                value={form.piloto_username}
                onChange={(v) => update('piloto_username', v)}
                options={pilotos.map(p => ({ value: p.username, label: p.nombre_completo }))}
                placeholder="Selecciona piloto..."
              />
            )}
            {!isGestor && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Piloto a distancia</label>
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-700">
                  {user.nombre_completo}
                </div>
              </div>
            )}
            <Select
              label="UAS *"
              value={form.uas_id}
              onChange={(v) => update('uas_id', v)}
              options={uas.map(u => ({
                value: u.id,
                label: `${u.marca} ${u.modelo}${u.serie ? ' (S/N: ' + u.serie + ')' : ''}`
              }))}
              placeholder="Selecciona aeronave..."
            />
            <Input
              label="Observadores (uno por línea o separados por comas)"
              value={form.observadores}
              onChange={(e) => update('observadores', e.target.value)}
            />
          </Section>

          <Section title="Localización">
            <Input
              label="Ubicación *"
              value={form.ubicacion}
              onChange={(e) => update('ubicacion', e.target.value)}
              placeholder="Ej. Tordesillas (Valladolid)"
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Latitud"
                type="number"
                step="0.00001"
                value={form.lat}
                onChange={(e) => update('lat', e.target.value)}
                placeholder="41.50060"
              />
              <Input
                label="Longitud"
                type="number"
                step="0.00001"
                value={form.lon}
                onChange={(e) => update('lon', e.target.value)}
                placeholder="-5.00060"
              />
            </div>
          </Section>

          <Section title="Limitaciones operacionales">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Altura máxima (m)"
                type="number"
                value={form.altura_max_m}
                onChange={(e) => update('altura_max_m', e.target.value)}
              />
              <Input
                label="CTR (designador, ej. EA-LELN)"
                value={form.ctr}
                onChange={(e) => update('ctr', e.target.value)}
              />
            </div>
          </Section>

          <Section title="Autorizaciones">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select label="Autorización CTR" value={form.aut_ctr} onChange={(v) => update('aut_ctr', v)} options={VALORES_AUT} />
              <Select label="Autorización CECAF" value={form.aut_cecaf} onChange={(v) => update('aut_cecaf', v)} options={VALORES_AUT} />
              <Select label="Aerodromo 1" value={form.aut_aerodromo_1} onChange={(v) => update('aut_aerodromo_1', v)} options={VALORES_AUT} />
              <Select label="Aerodromo 2" value={form.aut_aerodromo_2} onChange={(v) => update('aut_aerodromo_2', v)} options={VALORES_AUT} />
              <Select label="Aerodromo 3" value={form.aut_aerodromo_3} onChange={(v) => update('aut_aerodromo_3', v)} options={VALORES_AUT} />
              <Select label="Naturaleza" value={form.aut_naturaleza} onChange={(v) => update('aut_naturaleza', v)} options={VALORES_AUT} />
              <Select label="Infraestructura crítica" value={form.aut_infraestr_critica} onChange={(v) => update('aut_infraestr_critica', v)} options={VALORES_AUT} />
              <Select label="Comunicación Min. Interior" value={form.aut_min_interior} onChange={(v) => update('aut_min_interior', v)} options={VALORES_AUT} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Nº OIA"
                value={form.n_oia}
                onChange={(e) => update('n_oia', e.target.value)}
                placeholder="Ej. 1455-21"
              />
              <Select
                label="OIA finalizada"
                value={form.oia_finalizada}
                onChange={(v) => update('oia_finalizada', v)}
                options={['', 'Sí', 'No']}
                placeholder="—"
              />
            </div>
          </Section>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onCancel} type="button">Cancelar</Button>
            <Button type="submit" loading={submitting}>
              Crear operación
            </Button>
          </div>
        </form>
      </main>
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

function Select({ label, value, onChange, options, placeholder }) {
  // options puede ser array de strings o array de {value, label}
  const opts = options.map(o => typeof o === 'string' ? { value: o, label: o || '—' } : o);
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-invicsa-400"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {opts.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
