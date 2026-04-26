export default function Input({ label, error, id, className = '', ...rest }) {
  const inputId = id || rest.name;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-1">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-invicsa-400 focus:border-invicsa-500 ${error ? 'border-red-400' : 'border-slate-300'}`}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
