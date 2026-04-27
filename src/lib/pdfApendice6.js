// Genera el PDF del Apéndice 6 - Lista verificación postvuelo

import {
  createDoc, drawHeader, drawApendiceTitle, drawFooters,
  drawHeaderDataTable, drawSectionHeader, drawChecklistTable,
  drawSignature, ensureSpace, docToBase64, getConfigCached,
  PAGE, COLOR
} from './pdfCommon';
import { formatFechaHoras } from './format';

const SECCION_71 = [
  { code: '7.1.1', label: 'Si la operación se lleva a cabo en espacio aéreo controlado o FIZ' },
  { code: '7.1.1.1', label: 'Se cierran las operaciones conforme a las condiciones acordadas con el ATSP', indent: true },
  { code: '7.1.2', label: 'Otras condiciones' },
  { code: '7.1.2.1', label: 'Comunicación a terceros de la finalización de operaciones', indent: true },
  { code: '7.1.2.2', label: 'Comunicación imágenes tomadas en ZRVF al CECAF', indent: true }
];

const SECCION_721 = [
  { code: '7.2.1', label: 'Registros de actividad de vuelo' },
  { code: '7.2.1.1', label: 'Anotación de tiempos de vuelo de aeronave', indent: true },
  { code: '7.2.1.2', label: 'Anotación de tiempos de actividad del personal', indent: true }
];

const SECCION_722 = [
  { code: '7.2.2', label: 'Registro y comunicación de eventos significativos' },
  { code: '7.2.2.1', label: 'Anotación y comunicación interna de eventos de seguridad ocurridos durante las operaciones', indent: true },
  { code: '7.2.2.2', label: 'Comunicación de incidentes y accidentes a CIAIAC', indent: true }
];

const SECCION_723 = [
  { code: '7.2.3.1',  label: 'Estructura' },
  { code: '7.2.3.2',  label: 'Baterías' },
  { code: '7.2.3.3',  label: 'Sensores' },
  { code: '7.2.3.4',  label: 'Motores' },
  { code: '7.2.3.5',  label: 'Hélices' },
  { code: '7.2.3.6',  label: 'Partes Móviles' },
  { code: '7.2.3.7',  label: 'Comunicaciones' },
  { code: '7.2.3.8',  label: 'Planta de potencia' },
  { code: '7.2.3.9',  label: 'DRI' },
  { code: '7.2.3.10', label: 'Sistema de geoconsciencia' },
  { code: '7.2.3.11', label: 'Recogida y almacenaje' }
];

export async function generateApendice6PDF(op, payload, firmaDataUrl) {
  const config = await getConfigCached();
  const doc = createDoc();

  drawHeader(doc, config);
  let y = drawApendiceTitle(doc, 'APÉNDICE 6 - LISTA VERIFICACIÓN POSTVUELO', 26);

  y = drawHeaderDataTable(doc, [
    ['Título y/o código', op.titulo || ''],
    ['CONOPS / Categoría', op.categoria || ''],
    ['Fecha y horas previstas', formatFechaHoras(op.fecha, op.inicio_hl, op.fin_hl)],
    ['Piloto a distancia', payload.firmanteName || ''],
    ['UAS', op.uas_id || '']
  ], y);

  // 7.1
  y = drawSectionHeader(doc, '7.1', 'CONDICIONES Y LIMITACIONES DE ZONAS GEOGRÁFICAS DE UAS', y + 4);
  y = drawChecklistTable(doc, SECCION_71.map(it => ({ ...it, value: payload.items?.[it.code] || null })), y);

  // 7.2 — Sección compuesta
  y = drawSectionHeader(doc, '7.2', 'REGISTRO DE DATOS DE VUELO Y EVENTOS', y + 4);

  // 7.2.1 con comentarios
  const items721 = SECCION_721.map(it => ({
    ...it,
    value: payload.items?.[it.code] || null,
    comment: payload.comentarios?.[it.code] || ''
  }));
  y = drawChecklistTable(doc, items721, y, { withComment: true });

  // Tabla extra: tiempo de operación + nº aterrizajes (asociados a 7.2.1.1)
  if (payload.tiempo_operacion || payload.n_aterrizajes) {
    y = ensureSpace(doc, y + 2, 14);
    doc.autoTable({
      startY: y,
      body: [
        ['Tiempo de operación (HH:MM)', payload.tiempo_operacion || '—'],
        ['Nº de aterrizajes', payload.n_aterrizajes !== undefined && payload.n_aterrizajes !== '' ? String(payload.n_aterrizajes) : '—']
      ],
      margin: { left: PAGE.marginLeft + 6, right: PAGE.marginRight + 50 },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.5, lineColor: COLOR.border, lineWidth: 0.15, textColor: COLOR.text },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60, fillColor: COLOR.headerBg },
        1: { cellWidth: 40, halign: 'center' }
      }
    });
    y = doc.lastAutoTable.finalY;
  }

  // 7.2.2 con comentarios
  const items722 = SECCION_722.map(it => ({
    ...it,
    value: payload.items?.[it.code] || null,
    comment: payload.comentarios?.[it.code] || ''
  }));
  y = drawChecklistTable(doc, items722, y + 2, { withComment: true });

  // 7.2.3 — Aeronave (Sí/No + Obs)
  y = drawSectionHeader(doc, '7.2.3', 'AERONAVE', y + 4);
  const items723 = SECCION_723.map(it => ({
    ...it,
    value: payload.items?.[it.code] || null,
    comment: payload.comentarios?.[it.code] || ''
  }));
  y = drawChecklistTable(doc, items723, y, { options: 'siNo', withComment: true });

  // Notas
  if (payload.notas?.trim()) {
    y = drawSectionHeader(doc, '', 'NOTAS ADICIONALES', y + 4);
    y = ensureSpace(doc, y + 2, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR.text);
    const textLines = doc.splitTextToSize(payload.notas, PAGE.width - PAGE.marginLeft - PAGE.marginRight - 4);
    doc.text(textLines, PAGE.marginLeft + 2, y + 4);
    y = y + 4 + textLines.length * 4;
  }

  y = drawSectionHeader(doc, '', 'APROBACIÓN DEL PILOTO A DISTANCIA', y + 4);
  drawSignature(doc, firmaDataUrl, payload.firmanteName);

  drawFooters(doc);
  return docToBase64(doc);
}
