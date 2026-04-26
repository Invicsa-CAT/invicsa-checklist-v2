import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import domtoimage from 'dom-to-image-more';
import Button from './Button';

// Arreglo de iconos por defecto de Leaflet (problema clásico con Vite)
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow
});

const CAPAS = {
  geografia: {
    label: 'Geografía de vuelo',
    color: '#16a34a',
    fillColor: '#16a34a',
    fillOpacity: 0.25,
    weight: 3
  },
  contingencia: {
    label: 'Volumen de contingencia',
    color: '#ea580c',
    fillColor: '#ea580c',
    fillOpacity: 0.20,
    weight: 3
  },
  grb: {
    label: 'GRB (riesgo en tierra)',
    color: '#dc2626',
    fillColor: '#dc2626',
    fillOpacity: 0.18,
    weight: 3
  }
};

// Capas base disponibles
function buildBaseLayers() {
  return {
    'Callejero': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    }),
    'Satélite': L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Esri World Imagery',
        maxZoom: 19
      }
    ),
    'Híbrido': L.layerGroup([
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, attribution: 'Esri World Imagery' }
      ),
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, attribution: 'Esri Reference' }
      )
    ])
  };
}

/**
 * Mapa interactivo con dibujo de 3 polígonos (geografía, contingencia, GRB).
 * - Permite cambiar entre callejero, satélite e híbrido.
 * - Los polígonos pueden tener cualquier número de vértices: se cierran haciendo
 *   click en el primer punto, o usando "Terminar" en la barra de leaflet-draw.
 *
 * Props:
 *   - lat, lon: centro inicial del mapa
 *   - value: { geografia: GeoJSON|null, contingencia: GeoJSON|null, grb: GeoJSON|null, snapshot: dataURL|null }
 *   - onChange: callback con el nuevo valor
 */
export default function MapDrawer({ lat, lon, value, onChange }) {
  const mapEl = useRef(null);
  const map = useRef(null);
  const layers = useRef({ geografia: null, contingencia: null, grb: null });
  const [drawingLayer, setDrawingLayer] = useState(null);
  const drawHandlerRef = useRef(null);
  const [busy, setBusy] = useState(false);

  // Inicializar mapa
  useEffect(() => {
    if (map.current) return;
    const center = [parseFloat(lat) || 40.4168, parseFloat(lon) || -3.7038];

    const baseLayers = buildBaseLayers();

    map.current = L.map(mapEl.current, {
      center,
      zoom: 16,
      zoomControl: true,
      layers: [baseLayers['Híbrido']] // por defecto vista híbrida
    });

    L.control.layers(baseLayers, null, { position: 'topright', collapsed: false }).addTo(map.current);

    // Si hay valores previos, dibujarlos
    Object.keys(CAPAS).forEach(k => {
      if (value && value[k]) {
        addPolygonFromGeoJSON(k, value[k]);
      }
    });

    // Forzar redimensionamiento (a veces el contenedor no tiene tamaño correcto al inicio)
    setTimeout(() => map.current?.invalidateSize(), 100);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Centrar mapa si cambian las coordenadas
  useEffect(() => {
    if (map.current && lat && lon) {
      map.current.setView([parseFloat(lat), parseFloat(lon)], 16);
    }
  }, [lat, lon]);

  function addPolygonFromGeoJSON(capa, geojson) {
    if (layers.current[capa]) {
      map.current.removeLayer(layers.current[capa]);
    }
    const layer = L.geoJSON(geojson, { style: () => CAPAS[capa] }).addTo(map.current);
    layers.current[capa] = layer;
  }

  function startDrawing(capa) {
    if (drawHandlerRef.current) {
      drawHandlerRef.current.disable();
      drawHandlerRef.current = null;
    }
    setDrawingLayer(capa);

    // Configuración explícita: SIN límite de vértices, snap solo al primer punto
    const handler = new L.Draw.Polygon(map.current, {
      shapeOptions: CAPAS[capa],
      allowIntersection: true,
      showArea: false,        // desactiva cálculo de área (evita warnings)
      drawError: { color: '#e1e100', message: '' },
      icon: new L.DivIcon({
        iconSize: new L.Point(10, 10),
        className: 'leaflet-div-icon leaflet-editing-icon'
      }),
      maxPoints: 0,           // 0 = sin límite (algunas versiones requieren explícito)
      guidelineDistance: 20
    });
    handler.enable();
    drawHandlerRef.current = handler;

    map.current.once(L.Draw.Event.CREATED, (e) => {
      if (layers.current[capa]) {
        map.current.removeLayer(layers.current[capa]);
      }
      const layer = e.layer;
      layer.setStyle(CAPAS[capa]);
      layer.addTo(map.current);
      layers.current[capa] = layer;
      setDrawingLayer(null);
      drawHandlerRef.current = null;
      emitChange();
    });
  }

  function clearLayer(capa) {
    if (layers.current[capa]) {
      map.current.removeLayer(layers.current[capa]);
      layers.current[capa] = null;
      emitChange();
    }
  }

  function cancelDrawing() {
    if (drawHandlerRef.current) {
      drawHandlerRef.current.disable();
      drawHandlerRef.current = null;
    }
    setDrawingLayer(null);
  }

  function finishDrawing() {
    // Termina el polígono actual (igual que pulsar "Finish" en la barra de leaflet-draw)
    if (drawHandlerRef.current && drawHandlerRef.current.completeShape) {
      drawHandlerRef.current.completeShape();
    }
  }

  function emitChange() {
    const payload = { geografia: null, contingencia: null, grb: null, snapshot: null };
    Object.keys(layers.current).forEach(k => {
      const lyr = layers.current[k];
      if (lyr) {
        payload[k] = lyr.toGeoJSON();
      }
    });
    payload.snapshot = value?.snapshot || null;
    onChange?.(payload);
  }

  async function captureSnapshot() {
    if (!map.current) return null;
    setBusy(true);
    try {
      // Espera a que las teselas se rendericen (especialmente importante si se acaba de cambiar de capa)
      await new Promise(r => setTimeout(r, 800));
      const dataUrl = await domtoimage.toPng(mapEl.current, {
        quality: 0.85,
        bgcolor: '#ffffff'
      });
      onChange?.({ ...(value || {}), snapshot: dataUrl });
      return dataUrl;
    } finally {
      setBusy(false);
    }
  }

  const hasGeografia = !!layers.current.geografia;
  const hasContingencia = !!layers.current.contingencia;
  const hasGrb = !!layers.current.grb;

  return (
    <div className="space-y-3">
      <div
        ref={mapEl}
        style={{ height: '420px', width: '100%' }}
        className="rounded-md border border-slate-300 overflow-hidden"
      />

      {drawingLayer && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-sm text-amber-900 flex items-center justify-between gap-2 flex-wrap">
          <span>
            Dibujando <b>{CAPAS[drawingLayer].label}</b>. Toca puntos en el mapa, cierra haciendo clic en el primer punto o pulsando "Terminar".
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="primary" onClick={finishDrawing} type="button">Terminar</Button>
            <Button size="sm" variant="ghost" onClick={cancelDrawing} type="button">Cancelar</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {Object.keys(CAPAS).map(k => {
          const cap = CAPAS[k];
          const has = !!layers.current[k];
          return (
            <div key={k} className="border border-slate-200 rounded-md p-3 bg-white">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: cap.color }} />
                <span className="text-sm font-medium text-slate-800">{cap.label}</span>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={has ? 'secondary' : 'primary'}
                  onClick={() => startDrawing(k)}
                  disabled={!!drawingLayer}
                  type="button"
                  className="flex-1"
                >
                  {has ? 'Redibujar' : 'Dibujar'}
                </Button>
                {has && (
                  <Button size="sm" variant="ghost" onClick={() => clearLayer(k)} type="button">
                    Borrar
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
        <span className="text-xs text-slate-500">
          {hasGeografia && hasContingencia && hasGrb
            ? 'Las 3 áreas dibujadas. Captura la imagen antes de firmar.'
            : 'Dibuja las áreas requeridas según el ConOps.'}
        </span>
        <Button
          size="sm"
          variant="secondary"
          onClick={captureSnapshot}
          loading={busy}
          disabled={!hasGeografia && !hasContingencia && !hasGrb}
          type="button"
        >
          {value?.snapshot ? 'Re-capturar imagen' : 'Capturar imagen del mapa'}
        </Button>
      </div>

      {value?.snapshot && (
        <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
          ✓ Imagen del mapa capturada y lista para incluir en el PDF.
        </div>
      )}
    </div>
  );
}
