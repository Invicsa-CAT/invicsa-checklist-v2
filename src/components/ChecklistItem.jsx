import { useState } from 'react';

/**
 * Fila de un checklist con opciones excluyentes (Sí/No/N/A o Sí/No).
 *
 * Props:
 *   - code: identificador (ej. "1.1.1")
 *   - label: texto descriptivo
 *   - value: 'si' | 'no' | 'na' | null
 *   - onChange: callback(value)
 *   - disabled: ítem condicional inactivo
 *   - hint: ayuda opcional debajo
 *   - indent: indentar (sub-ítem)
 *   - options: 'siNoNa' (por defecto) | 'siNo'
 *   - withComment: muestra botón para añadir comentario
 *   - comment: valor actual del comentario
 *   - onCommentChange: callback(text)
 *   - header: si true, lo renderiza como cabecera de grupo (sin botones)
 */
export default function ChecklistItem({
  code,
  label,
  value,
  onChange,
  disabled = false,
  hint = null,
  indent = false,
  options = 'siNoNa',
  withComment = false,
  comment = '',
  onCommentChange,
  header = false
}) {
  const [showComment, setShowComment] = useState(!!comment);

  if (header) {
    return (
      <div className={`py-2 ${indent ? 'pl-6' : ''}`}>
        <div className="flex items-baseline gap-2">
          {code && <span className="text-xs font-mono text-slate-500 w-12 flex-shrink-0">{code}</span>}
          <span className="text-sm font-semibold text-slate-700">{label}</span>
        </div>
      </div>
    );
  }

  const optsSiNoNa = [
    { v: 'si', l: 'Sí',  cls: 'bg-emerald-600 text-white border-emerald-600' },
    { v: 'no', l: 'No',  cls: 'bg-red-600 text-white border-red-600' },
    { v: 'na', l: 'N/A', cls: 'bg-slate-500 text-white border-slate-500' }
  ];
  const optsSiNo = [
    { v: 'si', l: 'Sí', cls: 'bg-emerald-600 text-white border-emerald-600' },
    { v: 'no', l: 'No', cls: 'bg-red-600 text-white border-red-600' }
  ];
  const opts = options === 'siNo' ? optsSiNo : optsSiNoNa;

  return (
    <div className={`${indent ? 'pl-6 border-l-2 border-slate-200' : ''} ${disabled ? 'opacity-40' : ''}`}>
      <div className="flex items-start gap-3 py-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            {code && <span className="text-xs font-mono text-slate-500 w-14 flex-shrink-0">{code}</span>}
            <span className="text-sm text-slate-800">{label}</span>
          </div>
          {hint && <p className="text-xs text-slate-500 mt-0.5 ml-16">{hint}</p>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {opts.map(opt => {
            const active = value === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
                disabled={disabled}
                onClick={() => onChange(opt.v)}
                className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                  active ? opt.cls : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                } disabled:cursor-not-allowed`}
              >
                {opt.l}
              </button>
            );
          })}
          {withComment && !disabled && (
            <button
              type="button"
              onClick={() => setShowComment(s => !s)}
              title="Añadir comentario"
              className={`px-2 py-1.5 text-xs rounded border transition-colors ml-1 ${
                comment ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'
              }`}
            >
              💬
            </button>
          )}
        </div>
      </div>
      {withComment && showComment && !disabled && (
        <div className="pb-2 pl-16 pr-1">
          <textarea
            value={comment}
            onChange={(e) => onCommentChange?.(e.target.value)}
            rows={2}
            placeholder="Comentario u observación..."
            className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-invicsa-400"
          />
        </div>
      )}
    </div>
  );
}
