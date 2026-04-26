// Utilidades para formatear fechas y horas que vienen de Google Sheets en formato ISO raro.
// Cuando una celda tiene SOLO una hora, Google Sheets devuelve "1899-12-30T20:44:44.000Z" porque
// usa la fecha base de Excel (30/12/1899) para almacenar valores de tiempo puro.

/**
 * Formatea una fecha que puede venir como:
 *   - Date object
 *   - "2026-04-26"
 *   - "26/04/2026"
 *   - ISO string: "2026-04-25T22:00:00.000Z"
 * Devuelve "26/04/2026" (formato español).
 */
export function formatFecha(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return formatDateObj(value);
  }
  const s = String(value);
  // ISO completo
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d)) return formatDateObj(d);
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }
  // DD/MM/YYYY ya viene formateada
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    return s;
  }
  return s;
}

/**
 * Formatea una hora que puede venir como:
 *   - Date object con fecha base 1899-12-30
 *   - "1899-12-30T20:44:44.000Z" (Sheets devuelve así las horas puras)
 *   - "20:44" o "20:44:44" (string ya legible)
 *   - número decimal de Sheets (fracción de día, ej. 0.86 ≈ 20:38)
 * Devuelve "HH:MM" en formato 24h.
 */
export function formatHora(value) {
  if (value === '' || value === null || value === undefined) return '';

  if (value instanceof Date) {
    return horaFromDate(value);
  }

  const s = String(value);

  // ISO con fecha (puede ser 1899-12-30 si solo hay hora)
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d)) return horaFromDate(d);
  }

  // HH:MM o HH:MM:SS
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
    return s.substring(0, 5);
  }

  // Número decimal (fracción de día)
  const num = parseFloat(s);
  if (!isNaN(num) && num >= 0 && num < 1) {
    const totalMin = Math.round(num * 24 * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  return s;
}

function formatDateObj(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function horaFromDate(d) {
  // Importante: usamos getUTCHours/Minutes porque las horas puras llegan en UTC desde Sheets
  // y queremos preservar exactamente lo que el usuario escribió.
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Combina formatFecha + formatHora para mostrar "26/04/2026 · 14:30 - 18:30 (HL)"
 */
export function formatFechaHoras(fecha, ini, fin) {
  const f = formatFecha(fecha);
  const i = formatHora(ini);
  const e = formatHora(fin);
  if (i && e) return `${f} · ${i} - ${e} (HL)`;
  if (i || e) return `${f} · ${i || e} (HL)`;
  return f;
}
