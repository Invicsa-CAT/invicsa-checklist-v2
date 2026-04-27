// Genera el PDF del Apéndice 5 - Lista verificación prevuelo

import {
  createDoc, drawHeader, drawApendiceTitle, drawFooters,
  drawHeaderDataTable, drawSectionHeader, drawChecklistTable,
  drawSignature, ensureSpace, docToBase64, getConfigCached,
  PAGE, COLOR
} from './pdfCommon';
import { formatFechaHoras } from './format';

const SECCION_1 = [
  { code: '1.1', label: 'Evaluación del área de operación y el área circundante', header: true },
  { code: '1.1.1', label: 'Terreno, obstáculos y obstrucciones' },
  { code: '1.1.1.1', label: 'Se ha realizado una evaluación del cumplimiento entre la visibilidad y el alcance planificado', indent: true },
  { code: '1.1.1.2', label: 'Los observadores están correctamente posicionados', indent: true },
  { code: '1.2.2', label: 'NOTAM' },
  { code: '1.2.2.1', label: 'Se revisan los NOTAMs activos y no existen limitaciones a la operación', indent: true },
  { code: '1.2.2.2', label: 'Si la operación debe realizarse en TSA o está condicionada a la publicación previa de NOTAM, se confirma la correcta publicación', indent: true },
  { code: '1.2.3', label: 'Si la operación se lleva a cabo en espacio aéreo controlado o FIZ' },
  { code: '1.2.3.1', label: 'Se cumplen con los procedimientos acordados con el ATSP', indent: true },
  { code: '1.1.4', label: 'Si la operación se lleva a cabo próxima a aeropuertos, aeródromos y helipuertos' },
  { code: '1.1.4.1', label: 'Se han aplicado los condicionantes acordados con el gestor de la infraestructura', indent: true }
];

const SECCION_2 = [
  { code: '2.1.1', label: 'Las condiciones climatológicas no exceden los máximos previstos por el operador y/o por el fabricante del UAS' }
];

const SECCION_3 = [
  { code: '3.1', label: 'Se dispone de los medios requeridos para la comunicación entre el personal a cargo de las tareas esenciales' },
  { code: '3.2', label: 'Se dispone de los medios requeridos para la comunicación con terceras partes cuando sea necesario' }
];

const SECCION_4 = [
  { code: '4.1', label: 'Las atenuaciones del GRC están implementadas' },
  { code: '4.2', label: 'Las atenuaciones del ARC están implementadas' }
];

const SECCION_5 = [
  { code: '5.1', label: 'Estructura (Cableado, impactos, luces centro de gravedad, etc.)' },
  { code: '5.2', label: 'Sensores (GNSS, accelerómetro, barómetro, etc.)' },
  { code: '5.3', label: 'Motores (Giran libremente, sentido de giro correcto)' },
  { code: '5.4', label: 'Hélices (Sin muescas, correctamente instaladas)' },
  { code: '5.5', label: 'Unidad de control (Batería cargada, sujeta)' },
  { code: '5.6', label: 'Partes Móviles (Funcionamiento correcto, sin impactos)' },
  { code: '5.7', label: 'Comunicaciones (Antenas, recepción correcta, calidad de señal)' },
  { code: '5.8', label: 'Planta de potencia (Correcto estado y alimentación)' },
  { code: '5.9', label: 'Carga de pago (En funcionamiento, memoria suficiente)' },
  { code: '5.10', label: 'DRI (Datos de operador cargados, transmisión correcta)' },
  { code: '5.11', label: 'Sistema de geoconsciencia (Activado y configurado)' },
  { code: '5.12', label: 'Otros aspectos ligados al ConOps (paracaídas, anclajes, etc.)' }
];

export async function generateApendice5PDF(op, payload, firmaDataUrl) {
  const config = await getConfigCached();
  const doc = createDoc();

  drawHeader(doc, config);
  let y = drawApendiceTitle(doc, 'APÉNDICE 5 - LISTA VERIFICACIÓN PREVUELO', 26);

  y = drawHeaderDataTable(doc, [
    ['Título y/o código', op.titulo || ''],
    ['CONOPS / Categoría', op.categoria || ''],
    ['Fecha y horas previstas', formatFechaHoras(op.fecha, op.inicio_hl, op.fin_hl)],
    ['Piloto a distancia', payload.firmanteName || ''],
    ['UAS', op.uas_id || '']
  ], y);

  // Sección 1
  y = drawSectionHeader(doc, '1.', 'LUGAR DE LA OPERACIÓN', y + 4);
  const items1 = SECCION_1.map(it => ({ ...it, value: payload.items?.[it.code] || null }));
  y = drawChecklistTable(doc, items1, y);

  // Sección 2
  y = drawSectionHeader(doc, '2.', 'CONDICIONES AMBIENTALES Y CLIMATOLÓGICAS', y + 4);
  y = drawChecklistTable(doc, SECCION_2.map(it => ({ ...it, value: payload.items?.[it.code] || null })), y);

  // Sección 3
  y = drawSectionHeader(doc, '3.', 'PROCEDIMIENTOS DE COMUNICACIÓN', y + 4);
  y = drawChecklistTable(doc, SECCION_3.map(it => ({ ...it, value: payload.items?.[it.code] || null })), y);

  // Sección 4
  y = drawSectionHeader(doc, '4.', 'ATENUACIONES AL RIESGO', y + 4);
  y = drawChecklistTable(doc, SECCION_4.map(it => ({ ...it, value: payload.items?.[it.code] || null })), y);

  // Sección 5
  y = drawSectionHeader(doc, '5.', 'EL UAS ES AERONAVEGABLE', y + 4);
  y = drawChecklistTable(doc, SECCION_5.map(it => ({ ...it, value: payload.items?.[it.code] || null })), y);

  // Sección 6 - Aptitud
  y = drawSectionHeader(doc, '6.', 'APTITUD PARA OPERAR', y + 4);
  y = ensureSpace(doc, y + 2, 30);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR.text);
  const aptitudHeader = 'La tripulación a distancia se encuentra en condiciones adecuadas para la operación y conocen las tareas a su puesto.';
  const aptitudLines = doc.splitTextToSize(aptitudHeader, PAGE.width - PAGE.marginLeft - PAGE.marginRight - 4);
  doc.text(aptitudLines, PAGE.marginLeft + 2, y + 4);
  y = y + 4 + aptitudLines.length * 4 + 2;

  // Tabla de tripulantes
  const tripulacion = payload.tripulacion || [];
  const tripBody = tripulacion.map((t, i) => [
    `6.1.${i + 1}`,
    t.nombre || '',
    t.apto ? 'X' : ''
  ]);
  doc.autoTable({
    startY: y,
    head: [[
      { content: '', styles: { cellWidth: 14 } },
      { content: 'Nombre del tripulante', styles: { cellWidth: 'auto' } },
      { content: 'Apto', styles: { cellWidth: 14, halign: 'center' } }
    ]],
    body: tripBody,
    margin: { left: PAGE.marginLeft, right: PAGE.marginRight },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.5, lineColor: COLOR.border, lineWidth: 0.15 },
    headStyles: { fillColor: COLOR.headerBg, textColor: COLOR.text, fontStyle: 'bold', fontSize: 9 },
    columnStyles: { 0: { halign: 'center', textColor: COLOR.textMuted }, 2: { halign: 'center', fontStyle: 'bold' } }
  });
  y = doc.lastAutoTable.finalY;

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

  // Firma
  y = drawSectionHeader(doc, '', 'APROBACIÓN DEL PILOTO A DISTANCIA', y + 4);
  drawSignature(doc, firmaDataUrl, payload.firmanteName);

  drawFooters(doc);
  return docToBase64(doc);
}
