// Orquesta el flujo completo de "firmar apéndice":
//   1. Llama al backend signApendice (guarda payload + firma en el Sheet).
//   2. Genera el PDF localmente con jsPDF.
//   3. Sube el PDF a Drive vía uploadPdf.
//
// Si la generación o subida del PDF falla (porque la conexión es flaky o
// porque alguna imagen tarda), la firma ya está guardada y el PDF se puede
// regenerar más tarde haciendo "Re-firmar".

import * as api from './api';
import { generateApendice4PDF } from './pdfApendice4';
import { generateApendice5PDF } from './pdfApendice5';
import { generateApendice6PDF } from './pdfApendice6';
import { generateApendice11PDF } from './pdfApendice11';
import { generateApendice14PDF } from './pdfApendice14';

const GENERATORS = {
  '4':  generateApendice4PDF,
  '5':  generateApendice5PDF,
  '6':  generateApendice6PDF,
  '11': generateApendice11PDF,
  '14': generateApendice14PDF
};

/**
 * Firma el apéndice y sube el PDF en la misma operación.
 * @param {Object} op - operación completa
 * @param {string} apendiceNum - '4', '5', '6', '11', '14'
 * @param {Object} payload - el payload_json a guardar
 * @param {string} firmaDataUrl - imagen de la firma
 * @param {Object} opts - { onProgress?: (msg) => void }
 * @returns {Promise<{ signedRecord, pdfUrl, pdfError? }>}
 */
export async function signAndGeneratePdf(op, apendiceNum, payload, firmaDataUrl, opts = {}) {
  const onProgress = opts.onProgress || (() => {});
  const generator = GENERATORS[apendiceNum];
  if (!generator) throw new Error(`Apéndice no soportado: ${apendiceNum}`);

  // 1. Firmar (guardar payload y firma en el Sheet)
  onProgress('Guardando datos del apéndice...');
  const signedRecord = await api.signApendice(op.id, apendiceNum, payload, firmaDataUrl);

  // 2. Generar PDF
  let pdfBase64 = null;
  let pdfError = null;
  let pdfUrl = null;
  try {
    onProgress('Generando PDF...');
    pdfBase64 = await generator(op, payload, firmaDataUrl);
  } catch (e) {
    pdfError = `Error generando PDF: ${e.message}`;
    console.error(pdfError, e);
  }

  // 3. Subir PDF a Drive
  if (pdfBase64) {
    try {
      onProgress('Subiendo PDF a Drive...');
      const uploadRes = await api.uploadPdf(op.id, apendiceNum, pdfBase64);
      pdfUrl = uploadRes?.url || null;
    } catch (e) {
      pdfError = `PDF generado pero no subido: ${e.message}`;
      console.error(pdfError, e);
    }
  }

  return { signedRecord, pdfUrl, pdfError };
}
