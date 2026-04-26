// Almacenamiento local de borradores de apéndices.
// Permite que el piloto cierre la app a medias y recupere su trabajo.
// Estructura: clave = `${op_id}_ap${apendice_num}`, valor = { payload, savedAt }.

import { openDB } from 'idb';

const DB_NAME = 'invicsa-drafts';
const DB_VERSION = 1;
const STORE = 'drafts';

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      }
    });
  }
  return dbPromise;
}

export async function saveDraft(opId, apendiceNum, payload) {
  const db = await getDB();
  const id = `${opId}_ap${apendiceNum}`;
  await db.put(STORE, { id, opId, apendiceNum, payload, savedAt: Date.now() });
}

export async function loadDraft(opId, apendiceNum) {
  const db = await getDB();
  const id = `${opId}_ap${apendiceNum}`;
  const rec = await db.get(STORE, id);
  return rec ? rec.payload : null;
}

export async function deleteDraft(opId, apendiceNum) {
  const db = await getDB();
  const id = `${opId}_ap${apendiceNum}`;
  await db.delete(STORE, id);
}

export async function listDraftsByOp(opId) {
  const db = await getDB();
  const all = await db.getAll(STORE);
  return all.filter(r => r.opId === opId);
}
