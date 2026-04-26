// Logo de INVICSA Airtech en Base64 (PNG, 1118x310 px, fondo transparente)
// 
// IMPORTANTE: este archivo contiene el Base64 que el usuario pasó en el chat anterior.
// Si el logo cambia en el futuro, sustituir el contenido de la constante LOGO_BASE64.
// Para convertir un PNG/JPG a Base64 desde Windows PowerShell:
//   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\ruta\logo.png")) | clip
// Eso copia el Base64 al portapapeles. Pegar entre las comillas.

export const LOGO_BASE64 = "PEGAR_AQUI_EL_BASE64_DEL_LOGO_QUE_ENVIASTE_EN_EL_CHAT_ANTERIOR";

// URL data lista para usar como src de <img> o como imagen embebida en jsPDF.
export const LOGO_DATA_URL = `data:image/png;base64,${LOGO_BASE64}`;

// Dimensiones nativas del logo (para mantener proporción al renderizar).
export const LOGO_WIDTH = 1118;
export const LOGO_HEIGHT = 310;
export const LOGO_RATIO = LOGO_WIDTH / LOGO_HEIGHT;
