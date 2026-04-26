// Cliente API contra el Apps Script de Google Sheets.

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  console.error('VITE_API_URL no está configurada.');
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

async function call(action, payload = {}) {
  if (!API_URL) throw new Error('API_URL no configurada');
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
    throw new Error('Respuesta inválida del servidor (posible límite de tamaño)');
  }

  if (!data.ok) {
    if (data.error && /sesi[oó]n/i.test(data.error)) clearSession();
    throw new Error(data.error || 'Error desconocido');
  }
  return data;
}

// AUTH
export async function login(username, password) {
  const data = await call('login', { username, password });
  storeSession(data.token, data.user);
  return data.user;
}
export function logout() { clearSession(); }
export async function ping() { return call('ping'); }

// CATÁLOGOS
export async function listUAS() { const d = await call('listUAS'); return d.data; }
export async function listPilotos() { const d = await call('listPilotos'); return d.data; }
export async function getConfig() { const d = await call('getConfig'); return d.data; }

// OPERACIONES
export async function listOps(filters = {}) { const d = await call('listOps', filters); return d.data; }
export async function getOp(id) { const d = await call('getOp', { id }); return d.data; }
export async function createOp(opData) { const d = await call('createOp', opData); return d.data; }
export async function updateOp(id, fields) { return call('updateOp', { id, fields }); }
export async function finalizarOp(id) { return call('finalizarOp', { id }); }

export async function signApendice(opId, apendiceNum, payloadJson, firmaDataUrl) {
  const d = await call('signApendice', {
    op_id: opId,
    apendice_num: apendiceNum,
    payload_json: payloadJson,
    firma_dataurl: firmaDataUrl
  });
  return d.data;
}

export async function uploadPdf(opId, apendiceNum, pdfBase64) {
  const d = await call('uploadPdf', {
    op_id: opId,
    apendice_num: apendiceNum,
    pdf_base64: pdfBase64
  });
  return d.data;
}

/**
 * Sube la imagen del mapa del Apéndice 4 a la carpeta de Drive de la operación.
 * Devuelve { url, fileId, fileName }.
 * Esto evita meter una imagen de 1MB+ dentro del payload_json (límite 50K chars/celda).
 */
export async function uploadMapSnapshot(opId, imageBase64) {
  const d = await call('uploadMapSnapshot', {
    op_id: opId,
    image_base64: imageBase64
  });
  return d.data;
}

// ADMIN
export async function resetPassword(username, tempPassword) {
  return call('resetPassword', { username, tempPassword });
}
export async function togglePilotoActivo(username, activo) {
  return call('togglePilotoActivo', { username, activo });
}
