import { useEffect, useState } from 'react';
import * as api from '../lib/api';
import Header from '../components/Header';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';

export default function AdminPage({ onBack }) {
  const [pilotos, setPilotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pwModal, setPwModal] = useState(null); // username del piloto seleccionado

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listPilotos();
      setPilotos(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleToggleActivo(p) {
    try {
      await api.togglePilotoActivo(p.username, !p.activo);
      await load();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  return (
    <div className="min-h-screen">
      <Header title="Administración" subtitle="Gestión de pilotos" onBack={onBack} />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {loading && <div className="text-center py-8 text-slate-500">Cargando...</div>}

        {!loading && (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-2 font-medium">Usuario</th>
                  <th className="px-4 py-2 font-medium hidden sm:table-cell">Nombre</th>
                  <th className="px-4 py-2 font-medium hidden md:table-cell">Rol</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  <th className="px-4 py-2 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pilotos.map(p => (
                  <tr key={p.username}>
                    <td className="px-4 py-3 font-mono text-xs">{p.username}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">{p.nombre_completo}</td>
                    <td className="px-4 py-3 hidden md:table-cell capitalize">{p.rol}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="secondary" onClick={() => setPwModal(p.username)}>
                          Cambiar contraseña
                        </Button>
                        {p.rol !== 'gestor' && (
                          <Button
                            size="sm"
                            variant={p.activo ? 'danger' : 'primary'}
                            onClick={() => handleToggleActivo(p)}
                          >
                            {p.activo ? 'Desactivar' : 'Activar'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {pwModal && (
        <ChangePasswordModal
          username={pwModal}
          onClose={() => setPwModal(null)}
          onDone={() => { setPwModal(null); load(); }}
        />
      )}
    </div>
  );
}

function ChangePasswordModal({ username, onClose, onDone }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(null);
    if (pw.length < 8) { setErr('Mínimo 8 caracteres'); return; }
    if (pw !== pw2)    { setErr('Las contraseñas no coinciden'); return; }
    setSubmitting(true);
    try {
      await api.resetPassword(username, pw);
      alert(`Contraseña actualizada para ${username}.\nComunícasela al piloto: ${pw}`);
      onDone();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title={`Cambiar contraseña · ${username}`}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="Nueva contraseña"
          type="text"
          autoComplete="new-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Mínimo 8 caracteres"
          required
        />
        <Input
          label="Confirmar contraseña"
          type="text"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          required
        />
        {err && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</div>
        )}
        <p className="text-xs text-slate-500">
          La nueva contraseña se mostrará en pantalla al confirmar para que puedas comunicársela al piloto.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button type="submit" loading={submitting}>Confirmar</Button>
        </div>
      </form>
    </Modal>
  );
}
