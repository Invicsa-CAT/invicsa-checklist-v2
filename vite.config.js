import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // jsPDF y autotable van juntos en su propio chunk
          'pdf': ['jspdf', 'jspdf-autotable'],
          // Leaflet y plugins en otro chunk
          'maps': ['leaflet', 'leaflet-draw', 'dom-to-image-more']
        }
      }
    }
  }
})
