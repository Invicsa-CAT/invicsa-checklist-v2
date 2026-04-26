// Cliente API contra el Apps Script de Google Sheets.
// Todas las llamadas son POST con body { action, payload, token }.

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  console.error('VITE_API_URL no está configurada. Definir en .env (local) o en Vercel Settings > Environment Variables.');
}

const TOKEN_KEY = 'invicsa_session_token';
const USER_KEY = 'invicsa_session_user';

export function getStoredToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

function storeSession(token, user) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Llamada genérica al backend.
 * Apps Script con redirect requiere petición simple (sin Content-Type custom),
 * por eso enviamos como text/plain. El servidor parsea JSON igualmente.
 */
async function call(action, payload = {}) {
  if (!API_URL) {
    throw new Error('API_URL no configurada');
  }
  const token = getStoredToken();
  const body = JSON.stringify({ action, payload, token });

  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow'
    });
  } catch (e) {
    throw new Error('No se pudo conectar con el servidor. Comprueba tu conexión.');
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Respuesta inválida del servidor');
  }

  if (!data.ok) {
    // Si la sesión expiró, limpiamos y propagamos
    if (data.error && /sesi[oó]n/i.test(data.error)) {
      clearSession();
    }
    throw new Error(data.error || 'Error desconocido');
  }
  return data;
}

// =============================================================================
// AUTENTICACIÓN
// =============================================================================

export async function login(username, password) {
  const data = await call('login', { username, password });
  storeSession(data.token, data.user);
  return data.user;
}

export function logout() {
  clearSession();
}

export async function ping() {
  return call('ping');
}

// =============================================================================
// CATÁLOGOS (UAS, pilotos, config)
// =============================================================================

export async function listUAS() {
  const data = await call('listUAS');
  return data.data;
}

export async function listPilotos() {
  const data = await call('listPilotos');
  return data.data;
}

export async function getConfig() {
  const data = await call('getConfig');
  return data.data;
}

// =============================================================================
// OPERACIONES
// =============================================================================

export async function listOps(filters = {}) {
  const data = await call('listOps', filters);
  return data.data;
}

export async function getOp(id) {
  const data = await call('getOp', { id });
  return data.data; // { op, apendices }
}

export async function createOp(opData) {
  const data = await call('createOp', opData);
  return data.data;
}

export async function updateOp(id, fields) {
  return call('updateOp', { id, fields });
}

export async function signApendice(opId, apendiceNum, payloadJson, firmaDataUrl) {
  const data = await call('signApendice', {
    op_id: opId,
    apendice_num: apendiceNum,
    payload_json: payloadJson,
    firma_dataurl: firmaDataUrl
  });
  return data.data;
}

export async function uploadPdf(opId, apendiceNum, pdfBase64) {
  const data = await call('uploadPdf', {
    op_id: opId,
    apendice_num: apendiceNum,
    pdf_base64: pdfBase64
  });
  return data.data;
}

export async function finalizarOp(id) {
  return call('finalizarOp', { id });
}

// =============================================================================
// ADMINISTRACIÓN DE PILOTOS (solo gestor)
// =============================================================================

export async function resetPassword(username, tempPassword) {
  return call('resetPassword', { username, tempPassword });
}

export async function togglePilotoActivo(username, activo) {
  return call('togglePilotoActivo', { username, activo });
}
