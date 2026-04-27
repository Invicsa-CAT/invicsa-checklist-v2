// Orquesta el flujo completo de "firmar apéndice":
//   1. Llama al backend signApendice (guarda payload + firma en el Sheet).
//   2. Genera el PDF localmente con jsPDF.
//   3. Sube el PDF a Drive vía uploadPdf.

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
    console.log(`[PDF] Generando Apéndice ${apendiceNum} para ${op.id}`);
    pdfBase64 = await generator(op, payload, firmaDataUrl);
    console.log(`[PDF] Generado OK. Tamaño base64: ${pdfBase64?.length || 0} chars`);
  } catch (e) {
    pdfError = `Error generando PDF: ${e.message}`;
    console.error('[PDF] Error en generación:', e);
  }

  // 3. Subir PDF a Drive
  if (pdfBase64) {
    try {
      onProgress('Subiendo PDF a Drive...');
      console.log(`[PDF] Subiendo a Drive...`);
      const uploadRes = await api.uploadPdf(op.id, apendiceNum, pdfBase64);
      pdfUrl = uploadRes?.url || null;
      console.log(`[PDF] Subido OK. URL: ${pdfUrl}`);
    } catch (e) {
      pdfError = `PDF generado pero no subido: ${e.message}`;
      console.error('[PDF] Error en subida:', e);
    }
  }

  return { signedRecord, pdfUrl, pdfError };
}
