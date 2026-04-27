// Helpers comunes para generación de PDFs.
// Se usan desde cada Apéndice{N}.js
//
// Convenciones:
//   - Tamaño A4: 210 x 297 mm
//   - Margen lateral: 10 mm
//   - Top con header: 25 mm
//   - Bottom con footer: 15 mm
//
// Importante: jspdf-autotable se importa como side-effect; en cuanto se
// importa, jsPDF gana el método doc.autoTable().

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as api from './api';
import { LOGO_DATA_URL } from '../assets/logo';

// ============================================================================
// Constantes de layout
// ============================================================================
export const PAGE = {
  width: 210,
  height: 297,
  marginLeft: 10,
  marginRight: 10,
  marginTop: 28,    // espacio reservado para header
  marginBottom: 18  // espacio reservado para footer
};

export const COLOR = {
  invicsaBlue: [36, 74, 111],   // invicsa-700
  text: [30, 41, 59],
  textMuted: [100, 116, 139],
  border: [203, 213, 225],
  headerBg: [241, 245, 249],
  yes: [22, 163, 74],
  no: [220, 38, 38],
  na: [100, 116, 139]
};

// ============================================================================
// Crear documento base
// ============================================================================
export function createDoc() {
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
    compress: true
  });
  doc.setFont('helvetica');
  return doc;
}

// ============================================================================
// HEADER (logo + Manual de Operaciones + INVICSA AIRTECH SL + Edición/Revisión/Fecha)
// ============================================================================
export function drawHeader(doc, config) {
  const y = 4;
  const headerHeight = 18;

  // Recuadro del header
  doc.setDrawColor(...COLOR.border);
  doc.setLineWidth(0.2);
  doc.rect(PAGE.marginLeft, y, PAGE.width - PAGE.marginLeft - PAGE.marginRight, headerHeight);

  // Línea vertical separando logo del texto
  doc.line(PAGE.marginLeft + 35, y, PAGE.marginLeft + 35, y + headerHeight);

  // Línea vertical separando texto del bloque edición
  const editionX = PAGE.width - PAGE.marginRight - 35;
  doc.line(editionX, y, editionX, y + headerHeight);

  // Logo (escalado proporcionalmente: ratio del logo es 1118/310 ≈ 3.6)
  // Lo pongo en 30 x 8.3 mm
  safeAddImage(doc, LOGO_DATA_URL, PAGE.marginLeft + 2, y + 4.8, 30, 8.3, '');

  // Texto central
  doc.setTextColor(...COLOR.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('MANUAL DE OPERACIONES', PAGE.marginLeft + 38, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const empresa = config?.empresa_nombre || 'INVICSA AIRTECH SOCIEDAD LIMITADA';
  doc.text(empresa, PAGE.marginLeft + 38, y + 13);

  // Bloque edición/revisión/fecha
  doc.setFontSize(8);
  doc.text(`Edición ${config?.manual_edicion || ''}`, editionX + 2, y + 5);
  doc.text(`Revisión ${config?.manual_revision || ''}`, editionX + 2, y + 9.5);
  doc.text(`${config?.manual_fecha || ''}`, editionX + 2, y + 14);
}

// ============================================================================
// TÍTULO grande del apéndice
// ============================================================================
export function drawApendiceTitle(doc, title, y = 26) {
  doc.setTextColor(...COLOR.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(title, PAGE.marginLeft, y);
  return y + 6;
}

// ============================================================================
// FOOTER (página X de Y)
// ============================================================================
export function drawFooters(doc) {
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.textMuted);
    const text = `Manual de operaciones · Página ${i} de ${total}`;
    doc.text(text, PAGE.width / 2, PAGE.height - 8, { align: 'center' });
  }
}

// ============================================================================
// TABLA de datos cabecera (label : value)
// ============================================================================
export function drawHeaderDataTable(doc, rows, startY) {
  doc.autoTable({
    startY,
    body: rows,
    theme: 'plain',
    margin: { left: PAGE.marginLeft, right: PAGE.marginRight },
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: { top: 1.2, right: 2, bottom: 1.2, left: 2 },
      lineColor: COLOR.border,
      lineWidth: 0.15,
      textColor: COLOR.text
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50, fillColor: false },
      1: { cellWidth: 'auto' }
    }
  });
  return doc.lastAutoTable.finalY;
}

// ============================================================================
// SECTION HEADER (banda gris con título de sección)
// ============================================================================
export function drawSectionHeader(doc, code, title, y) {
  const w = PAGE.width - PAGE.marginLeft - PAGE.marginRight;
  doc.setFillColor(...COLOR.headerBg);
  doc.setDrawColor(...COLOR.border);
  doc.setLineWidth(0.15);
  doc.rect(PAGE.marginLeft, y, w, 6, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...COLOR.text);
  doc.text(code ? `${code}  ${title}` : title, PAGE.marginLeft + 2, y + 4);
  return y + 6;
}

// ============================================================================
// TABLA de checklist con columnas: Código | Descripción | Sí | No | N/A
// items = [{ code, label, value, indent?, comment?, header? }]
// options = 'siNoNa' (default) | 'siNo'
// withComment: añade columna 'Obs.' con el comentario
// ============================================================================
export function drawChecklistTable(doc, items, startY, opts = {}) {
  const { options = 'siNoNa', withComment = false, withHeaderRow = true } = opts;
  const cols = options === 'siNo' ? ['Sí', 'No'] : ['Sí', 'No', 'N/A'];

  const head = withHeaderRow
    ? [[
        { content: '', styles: { cellWidth: 14 } },
        { content: '', styles: { cellWidth: 'auto' } },
        ...cols.map(c => ({ content: c, styles: { cellWidth: 12, halign: 'center' } })),
        ...(withComment ? [{ content: 'Obs.', styles: { cellWidth: 30 } }] : [])
      ]]
    : [];

  const body = items.map(item => {
    if (item.header) {
      return [{
        content: item.code ? `${item.code}  ${item.label}` : item.label,
        colSpan: cols.length + 2 + (withComment ? 1 : 0),
        styles: {
          fillColor: COLOR.headerBg,
          fontStyle: 'bold',
          fontSize: 9.5,
          textColor: COLOR.text,
          cellPadding: { top: 1.5, bottom: 1.5, left: 2 }
        }
      }];
    }

    const codeStyles = { fontSize: 8, halign: 'center', textColor: COLOR.textMuted };
    const labelStyles = {
      fontSize: 9,
      cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: item.indent ? 6 : 2 }
    };

    const row = [
      { content: item.code || '', styles: codeStyles },
      { content: item.label || '', styles: labelStyles },
      ...cols.map(label => {
        const key = label === 'Sí' ? 'si' : (label === 'No' ? 'no' : 'na');
        const isMarked = item.value === key;
        return {
          content: isMarked ? 'X' : '',
          styles: {
            halign: 'center',
            fontStyle: 'bold',
            fontSize: 10,
            textColor: isMarked ? COLOR.text : COLOR.textMuted
          }
        };
      })
    ];

    if (withComment) {
      row.push({
        content: item.comment || '',
        styles: { fontSize: 8, textColor: COLOR.text }
      });
    }

    return row;
  });

  doc.autoTable({
    startY,
    head,
    body,
    margin: { left: PAGE.marginLeft, right: PAGE.marginRight },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 },
      lineColor: COLOR.border,
      lineWidth: 0.15,
      textColor: COLOR.text,
      valign: 'middle'
    },
    headStyles: {
      fillColor: COLOR.headerBg,
      textColor: COLOR.text,
      fontStyle: 'bold',
      fontSize: 9,
      lineWidth: 0.15
    }
  });

  return doc.lastAutoTable.finalY;
}

// ============================================================================
// FIRMA al final del documento (con nombre debajo y label "Firma")
// ============================================================================
export function drawSignature(doc, firmaDataUrl, firmanteName, y = null) {
  const startY = y !== null ? y : doc.lastAutoTable?.finalY + 10 || 200;
  const requiredSpace = 38;

  let actualY = startY;
  if (actualY + requiredSpace > PAGE.height - PAGE.marginBottom) {
    doc.addPage();
    actualY = PAGE.marginTop;
  }

  // Cuadro de la firma
  const sigW = 70;
  const sigH = 20;
  const sigX = PAGE.marginLeft + 3;
  doc.setDrawColor(...COLOR.border);
  doc.setLineWidth(0.2);

  if (firmaDataUrl) {
    safeAddImage(doc, firmaDataUrl, sigX, actualY + 2, sigW, sigH, '[firma]');
  }

  // Línea bajo la firma
  doc.line(sigX, actualY + sigH + 3, sigX + sigW, actualY + sigH + 3);

  // Label "Firma"
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR.text);
  doc.text('Firma', sigX + sigW / 2 - 5, actualY + sigH + 7);

  // Nombre debajo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(firmanteName || '', sigX, actualY + sigH + 12);

  return actualY + sigH + 18;
}

// ============================================================================
// Asegurar espacio en la página (salta de página si no hay sitio)
// ============================================================================
export function ensureSpace(doc, currentY, neededHeight) {
  if (currentY + neededHeight > PAGE.height - PAGE.marginBottom) {
    doc.addPage();
    return PAGE.marginTop;
  }
  return currentY;
}

// ============================================================================
// Convertir el doc a Base64 para subirlo al backend
// ============================================================================
export function docToBase64(doc) {
  // jsPDF.output('datauristring') incluye prefijo 'data:application/pdf;filename=...'
  // 'dataurlstring' lo mismo. Usamos 'datauristring' y limpiamos el prefijo.
  const dataUri = doc.output('datauristring');
  // Forma: data:application/pdf;filename=generated.pdf;base64,XXXX
  const m = /base64,(.+)$/.exec(dataUri);
  return m ? m[1] : dataUri;
}

// ============================================================================
// CARGAR config desde el backend (con cache de sesión)
// ============================================================================
let _configCache = null;
export async function getConfigCached() {
  if (_configCache) return _configCache;
  try {
    const cfg = await api.getConfig();
    _configCache = cfg;
    return cfg;
  } catch (e) {
    return {};
  }
}
export function clearConfigCache() { _configCache = null; }

// ============================================================================
// CARGAR una imagen desde URL pública (Drive) y devolver como Data URL
// Drive devuelve URLs tipo https://drive.google.com/file/d/{id}/view
// Necesitamos transformarlas en URLs accesibles desde el navegador.
// ============================================================================
export async function fetchImageAsDataUrl(driveUrl) {
  if (!driveUrl) return null;
  try {
    // Extraer fileId del URL típico de Drive: https://drive.google.com/file/d/{id}/view
    const m = /\/d\/([a-zA-Z0-9_-]+)/.exec(driveUrl);
    const fileId = m ? m[1] : null;
    if (!fileId) return null;

    // Endpoint público para visualizar Drive: thumbnail con tamaño grande
    // Nota: solo funciona si el archivo es accesible (la cuenta del Apps Script
    // lo crea con permisos de Anyone with link via createFile, así que sí).
    const url = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('No se pudo cargar imagen de Drive:', e);
    return null;
  }
}

// ============================================================================
// Detectar formato real de un Data URL (PNG, JPEG, WEBP)
// El segundo argumento de doc.addImage tiene que coincidir con el formato real
// del binario; si pasas 'PNG' a un JPEG, jsPDF revienta silenciosamente.
// ============================================================================
export function detectImageFormat(dataUrl) {
  if (!dataUrl) return null;
  const m = /^data:image\/([a-z]+);base64,/.exec(dataUrl);
  if (!m) return 'PNG'; // fallback
  const fmt = m[1].toLowerCase();
  if (fmt === 'jpeg' || fmt === 'jpg') return 'JPEG';
  if (fmt === 'png') return 'PNG';
  if (fmt === 'webp') return 'WEBP';
  return 'PNG';
}

// ============================================================================
// Helper resistente para añadir imágenes: detecta formato, captura errores
// individualmente y muestra placeholder de texto si falla.
// Devuelve true si la imagen se insertó, false si falló.
// ============================================================================
export function safeAddImage(doc, dataUrl, x, y, w, h, fallbackLabel = '(imagen no disponible)') {
  if (!dataUrl) {
    drawImagePlaceholder(doc, x, y, w, h, fallbackLabel);
    return false;
  }
  try {
    const fmt = detectImageFormat(dataUrl);
    doc.addImage(dataUrl, fmt, x, y, w, h, undefined, 'FAST');
    return true;
  } catch (e) {
    console.warn(`safeAddImage falló (${fallbackLabel}):`, e);
    drawImagePlaceholder(doc, x, y, w, h, fallbackLabel);
    return false;
  }
}

function drawImagePlaceholder(doc, x, y, w, h, label) {
  doc.setDrawColor(...COLOR.border);
  doc.setFillColor(248, 250, 252); // slate-50
  doc.rect(x, y, w, h, 'FD');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR.textMuted);
  doc.text(label, x + w / 2, y + h / 2, { align: 'center' });
}
