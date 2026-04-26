import { useState, useRef } from 'react';
import * as api from '../lib/api';
import Button from './Button';

/**
 * Permite al piloto seleccionar una imagen (galería o cámara en móvil) y la sube a Drive
 * usando uploadOpImage con un `kind` específico.
 *
 * Props:
 *   - opId: ID de la operación
 *   - kind: identificador del tipo de imagen (ej. 'enaire_drones')
 *   - label: texto descriptivo para el usuario
 *   - value: URL de la imagen ya subida (string) o null
 *   - onChange: callback(value) con la nueva URL tras subir
 */
export default function ImageUpload({ opId, kind, label, value, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen.');
      return;
    }
    // Limitamos a 5 MB para evitar problemas con Apps Script
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen es demasiado grande (máximo 5 MB).');
      return;
    }

    setError(null);
    setBusy(true);

    try {
      // Convertir a Data URL
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Error leyendo archivo'));
        reader.readAsDataURL(file);
      });

      setPreview(dataUrl);

      // Subir a Drive
      const res = await api.uploadOpImage(opId, dataUrl, kind);
      onChange?.(res.url);
    } catch (e) {
      setError(e.message);
      setPreview(null);
    } finally {
      setBusy(false);
      // Reset el input para permitir re-subir el mismo archivo si cambia
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleClear() {
    setPreview(null);
    onChange?.(null);
    setError(null);
  }

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium text-slate-700">{label}</label>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {!value && !preview && (
        <Button
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          loading={busy}
          type="button"
        >
          Subir imagen
        </Button>
      )}

      {(value || preview) && (
        <div className="space-y-2">
          <div className="relative inline-block">
            {preview && (
              <img
                src={preview}
                alt="Preview"
                className="max-h-48 rounded border border-slate-300"
              />
            )}
            {!preview && value && (
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
                ✓ Imagen subida a Drive
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              loading={busy}
              type="button"
            >
              Sustituir
            </Button>
            <Button size="sm" variant="ghost" onClick={handleClear} type="button">
              Quitar
            </Button>
          </div>
        </div>
      )}

      {busy && !preview && (
        <div className="text-xs text-slate-500">Subiendo imagen a Drive...</div>
      )}

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}
