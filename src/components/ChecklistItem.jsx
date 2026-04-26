/**
 * Fila de un checklist con tres opciones excluyentes: Sí | No | N/A.
 * Props:
 *   - code: identificador (ej. "0.4.1.1")
 *   - label: texto descriptivo
 *   - value: 'si' | 'no' | 'na' | null
 *   - onChange: callback(value)
 *   - disabled: si está deshabilitado (ítem condicional inactivo)
 *   - hint: texto de ayuda opcional debajo del label
 */
export default function ChecklistItem({ code, label, value, onChange, disabled = false, hint = null, indent = false }) {
  const opts = [
    { v: 'si', l: 'Sí',  cls: 'bg-emerald-600 text-white border-emerald-600' },
    { v: 'no', l: 'No',  cls: 'bg-red-600 text-white border-red-600' },
    { v: 'na', l: 'N/A', cls: 'bg-slate-500 text-white border-slate-500' }
  ];

  return (
    <div className={`flex items-start gap-3 py-2 ${indent ? 'pl-6 border-l-2 border-slate-200' : ''} ${disabled ? 'opacity-40' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          {code && <span className="text-xs font-mono text-slate-500 w-12 flex-shrink-0">{code}</span>}
          <span className="text-sm text-slate-800">{label}</span>
        </div>
        {hint && <p className="text-xs text-slate-500 mt-0.5 ml-14">{hint}</p>}
      </div>
      <div className="flex gap-1 flex-shrink-0">
        {opts.map(opt => {
          const active = value === opt.v;
          return (
            <button
              key={opt.v}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.v)}
              className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                active
                  ? opt.cls
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              } disabled:cursor-not-allowed`}
            >
              {opt.l}
            </button>
          );
        })}
      </div>
    </div>
  );
}
