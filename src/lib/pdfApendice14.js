// Genera el PDF del Apéndice 14 - Registro de tiempos de ciclos de trabajo

import {
  createDoc, drawHeader, drawApendiceTitle, drawFooters,
  drawHeaderDataTable, drawSectionHeader,
  drawSignature, ensureSpace, docToBase64, getConfigCached,
  PAGE, COLOR
} from './pdfCommon';
import { formatFecha } from './format';
import { durationBetween } from './timeUtils';

export async function generateApendice14PDF(op, payload, firmaDataUrl) {
  const config = await getConfigCached();
  const doc = createDoc();

  drawHeader(doc, config);
  let y = drawApendiceTitle(doc, 'APÉNDICE 14 - REGISTRO DE TIEMPOS DE CICLOS DE TRABAJO', 26);

  y = drawHeaderDataTable(doc, [
    ['Nombre', payload.nombre || ''],
    ['Puesto', payload.puesto || 'Piloto remoto'],
    ['Fecha', formatFecha(op.fecha)],
    ['Tripulación', payload.tripulacion || ''],
    ['Operación', op.titulo || '']
  ], y);

  // Registro de jornada
  y = drawSectionHeader(doc, '', 'REGISTRO DE JORNADA', y + 4);
  y = ensureSpace(doc, y + 2, 12);
  doc.autoTable({
    startY: y,
    body: [[
      { content: `Inicio jornada: ${payload.inicio_jornada || '—'}`, styles: { cellWidth: 60 } },
      { content: `Fin jornada: ${payload.fin_jornada || '—'}`, styles: { cellWidth: 60 } },
      { content: `Total: ${payload.total_jornada || '—'}`, styles: { cellWidth: 'auto', fontStyle: 'bold' } }
    ]],
    margin: { left: PAGE.marginLeft, right: PAGE.marginRight },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2, lineColor: COLOR.border, lineWidth: 0.15, textColor: COLOR.text }
  });
  y = doc.lastAutoTable.finalY;

  // Tiempos de actividad y descansos
  y = drawSectionHeader(doc, '', 'TIEMPOS DE ACTIVIDAD Y DESCANSOS', y + 4);
  y = ensureSpace(doc, y + 2, 30);

  const actividades = payload.actividades || [];
  // Construimos las filas de la tabla.
  // Cada actividad ocupa una fila con: Inicio, Fin, Duración, Descanso siguiente.
  const head = [[
    { content: 'Actividad', styles: { cellWidth: 22, halign: 'center' } },
    { content: 'Inicio', styles: { cellWidth: 'auto', halign: 'center' } },
    { content: 'Fin', styles: { cellWidth: 'auto', halign: 'center' } },
    { content: 'Duración', styles: { cellWidth: 'auto', halign: 'center' } },
    { content: 'Descanso siguiente', styles: { cellWidth: 'auto', halign: 'center' } }
  ]];
  const body = actividades.map((a, i) => [
    { content: `${i + 1}`, styles: { halign: 'center', fontStyle: 'bold' } },
    { content: a.inicio || '—', styles: { halign: 'center' } },
    { content: a.fin || '—', styles: { halign: 'center' } },
    { content: (a.inicio && a.fin) ? durationBetween(a.inicio, a.fin) : '—', styles: { halign: 'center' } },
    { content: (i < actividades.length - 1 && a.descanso_min) ? `${a.descanso_min} min` : '—', styles: { halign: 'center' } }
  ]);

  doc.autoTable({
    startY: y,
    head,
    body,
    margin: { left: PAGE.marginLeft, right: PAGE.marginRight },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2, lineColor: COLOR.border, lineWidth: 0.15, textColor: COLOR.text },
    headStyles: { fillColor: COLOR.headerBg, textColor: COLOR.text, fontStyle: 'bold' }
  });
  y = doc.lastAutoTable.finalY;

  // Total horas de vuelo acumuladas
  y = ensureSpace(doc, y + 4, 12);
  doc.autoTable({
    startY: y,
    body: [[
      { content: 'Total horas de vuelo acumuladas:', styles: { cellWidth: 80, fontStyle: 'bold', fillColor: COLOR.headerBg } },
      { content: payload.total_vuelo || '—', styles: { cellWidth: 'auto', fontStyle: 'bold', halign: 'center' } }
    ]],
    margin: { left: PAGE.marginLeft, right: PAGE.marginRight },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 2.5, lineColor: COLOR.border, lineWidth: 0.15, textColor: COLOR.text }
  });
  y = doc.lastAutoTable.finalY;

  // Firma
  y = ensureSpace(doc, y + 8, 40);
  drawSignature(doc, firmaDataUrl, payload.firmanteName);
  // Nota: en el apéndice 14 oficial el label es "Firma del piloto"
  // pero drawSignature pone "Firma" como genérico, suficiente.

  drawFooters(doc);
  return docToBase64(doc);
}
