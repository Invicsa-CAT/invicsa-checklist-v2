// Genera el PDF del Apéndice 4 - Lista de planificación operacional
// Replica la plantilla oficial del Manual de Operaciones edición 9 / revisión 10.

import {
  createDoc, drawHeader, drawApendiceTitle, drawFooters,
  drawHeaderDataTable, drawSectionHeader, drawChecklistTable,
  drawSignature, ensureSpace, docToBase64, getConfigCached,
  fetchOpImage, safeAddImage, PAGE, COLOR
} from './pdfCommon';
import { formatFechaHoras } from './format';

const ZONAS_GEOGRAFICAS = [
  { code: '0.4.1', label: 'Espacio aéreo controlado y zonas de información de vuelo (FIZ)' },
  { code: '0.4.1.1', label: 'Se cuenta con un estudio aeronáutico de seguridad específico coordinado con el ATSP', indent: true },
  { code: '0.4.2', label: 'Entorno de aeródromos o helipuertos, civiles o militares' },
  { code: '0.4.2.1', label: 'Se ha realizado una coordinación previa con el gestor de la infraestructura y proveedor ATS si lo hubiera', indent: true },
  { code: '0.4.3', label: 'Zonas prohibidas, restringidas y asociadas a la gestión flexible del espacio aéreo' },
  { code: '0.4.3.1', label: 'Se cumple con las condiciones y limitaciones o se cuenta con la autorización pertinente del gestor del área', indent: true },
  { code: '0.4.4', label: 'Zonas de seguridad militar, de la Defensa Nacional y de la seguridad del Estado' },
  { code: '0.4.4.1', label: 'Se cuenta con permiso previo y expreso del titular de la zona o del gestor responsable', indent: true },
  { code: '0.4.5', label: 'Instalaciones que prestan servicios esenciales para la comunidad' },
  { code: '0.4.5.1', label: 'Se cuenta con permiso previo y expreso del titular de la zona o del gestor responsable', indent: true },
  { code: '0.4.6', label: 'Entornos urbanos' },
  { code: '0.4.6.1a', label: 'Se cumplen con las distancias a edificios determinadas en la declaración operacional o autorización', indent: true },
  { code: '0.4.6.1b', label: 'Se ha realizado la comunicación al Ministerio del Interior al menos con 5 días de antelación', indent: true },
  { code: '0.4.7', label: 'Zona Restringida al Vuelo Fotográfico (ZRVF)' },
  { code: '0.4.7.1', label: 'Se cuenta con el permiso del CECAF para la toma de imágenes', indent: true },
  { code: '0.4.8', label: 'Zonas de protección medioambiental' },
  { code: '0.4.8.1', label: 'Se dispone de coordinación con el gestor del espacio', indent: true }
];

const REQUISITOS_061 = [
  { code: '0.6.1', label: 'CONOPS y modelo semántico', header: true },
  { code: '0.6.1.1', label: 'Se aplica e identifica el modelo semántico en la zona de vuelo y este se ajusta al CONOPS autorizado', indent: true },
  { code: '0.6.1.2', label: 'Se define la geografía del vuelo junto con el perfil de vuelos en función del CONOPS', indent: true },
  { code: '0.6.1.3', label: 'Se define el volumen de contingencia', indent: true },
  { code: '0.6.1.4', label: 'Se define el margen por riesgo en tierra', indent: true },
  { code: '0.6.1.5', label: 'Se planifica la ubicación de observadores y/o asistentes', indent: true },
  { code: '0.6.1.6', label: 'Se define el área adyacente', indent: true },
  { code: '0.6.1.7', label: 'La densidad de población en la geografía de vuelo y el área adyacente se ajustan al ConOps', indent: true }
];

const REQUISITOS_062 = [
  { code: '0.6.2', label: 'NOTAMs', header: true },
  { code: '0.6.2.1', label: 'Se revisan los NOTAMs activos y no existen limitaciones a la operación', indent: true },
  { code: '0.6.2.2', label: 'Si la operación debe realizarse en TSA o está condicionada a la publicación previa de NOTAM, se solicita al COOP de ENAIRE su promulgación', indent: true }
];

export async function generateApendice4PDF(op, payload, firmaDataUrl) {
  const config = await getConfigCached();
  const doc = createDoc();

  drawHeader(doc, config);
  let y = drawApendiceTitle(doc, 'APÉNDICE 4 - LISTA DE PLANIFICACIÓN OPERACIONAL', 26);

  // Sección 0.1 Información sobre las operaciones
  y = drawSectionHeader(doc, '0.1', 'INFORMACIÓN SOBRE LAS OPERACIONES', y);
  y = drawHeaderDataTable(doc, [
    ['Título y/o código', op.titulo || ''],
    ['Descripción y objetivos', op.descripcion || ''],
    ['Fecha/s y hora/s previstas', formatFechaHoras(op.fecha, op.inicio_hl, op.fin_hl)],
    ['Personal necesario', op.observadores ? `${payload.firmanteName || op.piloto_username}, ${op.observadores}` : (payload.firmanteName || op.piloto_username || '')],
    ['UAS previsto', op.uas_id || ''],
    ['Medios materiales / categoría', op.categoria || '']
  ], y);

  // Sección 0.2
  y = drawSectionHeader(doc, '0.2', 'EVALUACIÓN DEL ESCENARIO DE OPERACIONES', y + 4);
  y = drawHeaderDataTable(doc, [
    ['Dirección', op.ubicacion || ''],
    ['Coordenadas aprox.', (op.lat && op.lon) ? `${op.lat}, ${op.lon}` : '']
  ], y);

  // Sección 0.3 - Captura de ENAIRE Drones
  y = drawSectionHeader(doc, '0.3', 'ESPACIO AÉREO (ENAIRE Drones)', y + 4);
  y = ensureSpace(doc, y + 2, 76);
  {
    const imgW = 130;
    const imgH = 70;
    const x = (PAGE.width - imgW) / 2;
    let imgData = null;
    if (payload.enaire_image_url) {
      imgData = await fetchOpImage(op.id, 'enaire_drones');
    }
    safeAddImage(doc, imgData, x, y, imgW, imgH, '(Sin captura de ENAIRE Drones)');
    y = y + imgH + 4;
  }

  // Sección 0.4 Zonas geográficas (checklist)
  y = drawSectionHeader(doc, '0.4', 'ZONAS GEOGRÁFICAS DE UAS', y + 2);
  const zonasItems = ZONAS_GEOGRAFICAS.map(z => ({
    ...z,
    value: payload.items?.[z.code] || null
  }));
  y = drawChecklistTable(doc, zonasItems, y);

  // Sección 0.5 - Mapa de zona de vuelo
  y = drawSectionHeader(doc, '0.5', 'ZONA DE VUELO', y + 4);
  y = ensureSpace(doc, y + 2, 86);
  {
    const imgW = 140;
    const imgH = 80;
    const x = (PAGE.width - imgW) / 2;
    let imgData = null;
    if (payload.map?.snapshotUrl) {
      imgData = await fetchOpImage(op.id, 'mapa_planificacion');
    }
    safeAddImage(doc, imgData, x, y, imgW, imgH, '(Sin mapa de zona de vuelo)');
    y = y + imgH + 4;
  }

  // Sección 0.6 Requisitos
  y = drawSectionHeader(doc, '0.6', 'REQUISITOS Y LIMITACIONES EN LA ZONA DE VUELO', y + 2);
  const reqsItems = [
    ...REQUISITOS_061.map(r => ({ ...r, value: payload.items?.[r.code] || null })),
    ...REQUISITOS_062.map(r => ({ ...r, value: payload.items?.[r.code] || null }))
  ];
  y = drawChecklistTable(doc, reqsItems, y);

  // Otras limitaciones (texto libre)
  if (payload.otras_limitaciones_texto?.trim()) {
    y = drawSectionHeader(doc, '0.6.4', 'OTRAS LIMITACIONES', y + 4);
    y = ensureSpace(doc, y + 2, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR.text);
    const textLines = doc.splitTextToSize(
      payload.otras_limitaciones_texto,
      PAGE.width - PAGE.marginLeft - PAGE.marginRight - 4
    );
    doc.text(textLines, PAGE.marginLeft + 2, y + 4);
    y = y + 4 + textLines.length * 4;
  }

  // Notas
  if (payload.notas?.trim()) {
    y = drawSectionHeader(doc, '', 'NOTAS ADICIONALES', y + 4);
    y = ensureSpace(doc, y + 2, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR.text);
    const textLines = doc.splitTextToSize(
      payload.notas,
      PAGE.width - PAGE.marginLeft - PAGE.marginRight - 4
    );
    doc.text(textLines, PAGE.marginLeft + 2, y + 4);
    y = y + 4 + textLines.length * 4;
  }

  // Firma
  y = drawSectionHeader(doc, '0.6.5', 'APROBACIÓN DEL RESPONSABLE DE PLANIFICACIÓN', y + 4);
  drawSignature(doc, firmaDataUrl, payload.firmanteName);

  drawFooters(doc);
  return docToBase64(doc);
}
