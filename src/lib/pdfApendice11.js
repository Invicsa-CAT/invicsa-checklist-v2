// Genera el PDF del Apéndice 11 - Lista verificación RGPD

import {
  createDoc, drawHeader, drawApendiceTitle, drawFooters,
  drawHeaderDataTable, drawSectionHeader,
  drawSignature, ensureSpace, docToBase64, getConfigCached,
  PAGE, COLOR
} from './pdfCommon';
import { formatFecha } from './format';

function drawTextBlock(doc, text, y) {
  if (!text?.trim()) return y;
  y = ensureSpace(doc, y, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR.text);
  const lines = doc.splitTextToSize(text, PAGE.width - PAGE.marginLeft - PAGE.marginRight - 4);
  doc.text(lines, PAGE.marginLeft + 2, y + 4);
  return y + 4 + lines.length * 4 + 2;
}

function drawCheckBox(doc, x, y, marked) {
  const size = 3.5;
  doc.setDrawColor(...COLOR.text);
  doc.setLineWidth(0.2);
  doc.rect(x, y - size + 0.8, size, size);
  if (marked) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR.text);
    doc.text('X', x + 0.6, y);
  }
}

export async function generateApendice11PDF(op, payload, firmaDataUrl) {
  const config = await getConfigCached();
  const doc = createDoc();

  drawHeader(doc, config);
  let y = drawApendiceTitle(doc, 'APÉNDICE 11 - LISTA VERIFICACIÓN RGPD', 26);

  y = drawHeaderDataTable(doc, [
    ['Título y/o código', op.titulo || ''],
    ['Descripción y objetivos', op.descripcion || ''],
    ['Fecha', formatFecha(op.fecha)],
    ['Piloto responsable', payload.firmanteName || '']
  ], y);

  // 1. Identificación de riesgos
  y = drawSectionHeader(doc, '1.', 'IDENTIFICACIÓN DE RIESGOS DE PRIVACIDAD', y + 4);
  y = drawTextBlock(doc, payload.riesgos, y);

  // 2. Rol respecto a captura y tratamiento
  y = drawSectionHeader(doc, '2.', 'ROL RESPECTO A CAPTURA Y TRATAMIENTO', y + 2);
  y = ensureSpace(doc, y + 2, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR.text);
  drawCheckBox(doc, PAGE.marginLeft + 4, y + 5, !!payload.rol_captura);
  doc.text('Capturo los datos', PAGE.marginLeft + 10, y + 5);
  drawCheckBox(doc, PAGE.marginLeft + 4, y + 11, !!payload.rol_proceso);
  doc.text('Proceso los datos', PAGE.marginLeft + 10, y + 11);
  y += 14;

  // 3. Evaluación de impacto
  y = drawSectionHeader(doc, '3.', 'EVALUACIÓN DE IMPACTO (EIPD)', y + 2);
  y = ensureSpace(doc, y + 2, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const drawEIPDRow = (label, value, yRow) => {
    doc.text(label, PAGE.marginLeft + 4, yRow);
    const labelWidth = doc.getTextWidth(label);
    const baseX = PAGE.marginLeft + 4 + labelWidth + 6;
    doc.text('Sí', baseX, yRow);
    drawCheckBox(doc, baseX + 6, yRow, value === 'si');
    doc.text('No', baseX + 16, yRow);
    drawCheckBox(doc, baseX + 23, yRow, value === 'no');
  };
  drawEIPDRow('¿Evaluada la necesidad de EIPD?', payload.eipd_evaluada, y + 5);
  drawEIPDRow('¿Requiere EIPD?', payload.eipd_requiere, y + 10);
  drawEIPDRow('¿Realizó EIPD?', payload.eipd_realizada, y + 15);
  y += 19;

  // 4 a 8 - secciones de texto editable
  y = drawSectionHeader(doc, '4.', 'MEDIDAS DE INFORMACIÓN A INTERESADOS', y + 2);
  y = drawTextBlock(doc, payload.informacion_interesados, y);

  y = drawSectionHeader(doc, '5.', 'MEDIDAS DE MINIMIZACIÓN DE DATOS', y + 2);
  y = drawTextBlock(doc, payload.minimizacion, y);

  y = drawSectionHeader(doc, '6.', 'ALMACENAMIENTO Y ACCESO', y + 2);
  y = drawTextBlock(doc, payload.almacenamiento, y);

  y = drawSectionHeader(doc, '7.', 'DERECHOS DE LOS INTERESADOS', y + 2);
  y = drawTextBlock(doc, payload.derechos, y);

  y = drawSectionHeader(doc, '8.', 'INFORMACIÓN ADICIONAL', y + 2);
  y = drawTextBlock(doc, payload.informacion_adicional, y);

  // Firma
  y = drawSectionHeader(doc, '', 'APROBACIÓN DEL PILOTO A DISTANCIA', y + 4);
  drawSignature(doc, firmaDataUrl, payload.firmanteName);

  drawFooters(doc);
  return docToBase64(doc);
}
