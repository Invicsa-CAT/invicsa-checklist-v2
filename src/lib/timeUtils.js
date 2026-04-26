// Helpers para gestión de tiempos en formato HH:MM (24h).
// Usados sobre todo en Apéndice 14 (registro de jornada y actividades).

/**
 * Convierte "HH:MM" → minutos totales desde 00:00.
 * Devuelve null si el formato no es válido.
 */
export function timeToMinutes(hhmm) {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm).trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

/**
 * Convierte minutos totales → "HH:MM".
 */
export function minutesToTime(min) {
  if (min === null || min === undefined || isNaN(min)) return '';
  const m = ((min % (24 * 60)) + 24 * 60) % (24 * 60); // normaliza a 0-1439
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Calcula la duración entre dos horas "HH:MM" en formato "HH:MM".
 * Si fin < inicio, asume que cruzó medianoche y suma 24h.
 */
export function durationBetween(start, end) {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s === null || e === null) return '';
  let diff = e - s;
  if (diff < 0) diff += 24 * 60; // asume cruce de medianoche
  return minutesToTime(diff);
}

/**
 * Suma una lista de duraciones "HH:MM" → "HH:MM".
 * Útil para calcular total horas de vuelo a partir de varias actividades.
 */
export function sumDurations(durations) {
  let total = 0;
  durations.forEach(d => {
    const m = timeToMinutes(d);
    if (m !== null) total += m;
  });
  return minutesToTime(total);
}

/**
 * Resta una duración "HH:MM" de otra. Si el resultado sería negativo, devuelve "".
 */
export function subtractDuration(from, sub) {
  const f = timeToMinutes(from);
  const s = timeToMinutes(sub);
  if (f === null || s === null) return '';
  const diff = f - s;
  if (diff < 0) return '';
  return minutesToTime(diff);
}
