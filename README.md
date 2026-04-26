# INVICSA Checklist v2

PWA de checklists operacionales UAS para INVICSA Airtech.

Stack: React + Vite + Tailwind. Backend: Google Apps Script + Google Sheets + Google Drive.

## Estructura

```
src/
  pages/        Páginas principales (Login, Operaciones, etc.)
  components/   Componentes UI reutilizables
  contexts/     Contextos React (Auth)
  lib/          Cliente API
  assets/       Logo y otros recursos estáticos
```

## Desarrollo local

1. Clonar el repo y entrar al directorio.
2. Crear `.env` copiando de `.env.example` y rellenar `VITE_API_URL` con la URL del Web App de Apps Script.
3. Instalar dependencias: `npm install`
4. Arrancar: `npm run dev`

## Despliegue en Vercel

Variable de entorno requerida:

| Nombre | Valor |
|--------|-------|
| `VITE_API_URL` | URL del Web App de Apps Script (`https://script.google.com/.../exec`) |

Configurarla en **Settings > Environment Variables** del proyecto en Vercel, marcada para Production, Preview y Development.

## Backend

El backend vive como Apps Script asociado a un Google Sheet llamado `INVICSA_UAS_Database` con las hojas: `Operaciones`, `UAS`, `Pilotos`, `Apendices`, `Config`. Ver `apps-script/Code.gs` en el repo de configuración.

## Roles

- **Piloto**: ve y cumplimenta sus operaciones.
- **Gestor**: ve todas las operaciones, las crea, asigna a pilotos, descarga PDFs, gestiona contraseñas y altas/bajas de pilotos.

## Versión

v2.0 — Login real contra Google Sheets, gestión de pilotos por gestor, creación de operaciones con numeración INV-YYYY-XXX. Apéndices en desarrollo (Fase 3 y 4).
