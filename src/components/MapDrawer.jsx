import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import domtoimage from 'dom-to-image-more';
import * as api from '../lib/api';
import Button from './Button';

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
  geografia: { label: 'Geografía de vuelo', color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.25, weight: 3 },
  contingencia: { label: 'Volumen de contingencia', color: '#ea580c', fillColor: '#ea580c', fillOpacity: 0.20, weight: 3 },
  grb: { label: 'GRB (riesgo en tierra)', color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.18, weight: 3 }
};

function buildBaseLayers() {
  return {
    'Callejero': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19
    }),
    'Satélite': L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Esri World Imagery', maxZoom: 19 }
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
 * Calcula el centroide aproximado de un polígono GeoJSON.
 * No es el centroide geométrico exacto pero suficiente para nuestro propósito.
 */
function centroidFromGeoJSON(gj) {
  if (!gj) return null;
  // Si es Feature, extraemos geometry
  const g = gj.type === 'Feature' ? gj.geometry : gj;
  if (!g || g.type !== 'Polygon') return null;
  const coords = g.coordinates?.[0];
  if (!coords || coords.length === 0) return null;
  let sumLng = 0, sumLat = 0, n = 0;
  // El último punto es el primero repetido (polígono cerrado), lo saltamos
  for (let i = 0; i < coords.length - 1; i++) {
    sumLng += coords[i][0];
    sumLat += coords[i][1];
    n++;
  }
  if (n === 0) return null;
  return { lat: sumLat / n, lon: sumLng / n };
}

/**
 * Geocoding inverso con Nominatim (OpenStreetMap).
 * Sin API key, gratuito, pero limitado a 1 req/segundo. Más que suficiente para nuestro uso.
 */
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1&accept-language=es`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data) return null;
    // Construimos un nombre legible: "Pueblo (Provincia)"
    const a = data.address || {};
    const lugar = a.town || a.village || a.city || a.hamlet || a.suburb || a.county || data.name;
    const provincia = a.province || a.state || a.county;
    if (lugar && provincia && lugar !== provincia) return `${lugar} (${provincia})`;
    if (lugar) return lugar;
    return data.display_name?.split(',').slice(0, 2).join(',').trim() || null;
  } catch {
    return null;
  }
}

/**
 * Mapa con dibujo de 3 polígonos. Al confirmar la zona:
 *   - Sube el snapshot a Drive (no se almacena en el payload).
 *   - Calcula el centroide del polígono "geografía" → lat/lon de la operación.
 *   - Resuelve el nombre del lugar por geocoding inverso.
 *   - Llama a onZoneConfirmed con { snapshotUrl, lat, lon, ubicacion }.
 *
 * Props:
 *   - opId: ID de la operación (para subir el snapshot a su carpeta de Drive)
 *   - lat, lon: centro inicial del mapa
 *   - value: { geografia, contingencia, grb, snapshotUrl }
 *   - onChange: callback con { geografia, contingencia, grb, snapshotUrl }
 *   - onZoneConfirmed: callback({ snapshotUrl, lat, lon, ubicacion }) tras confirmar
 */
export default function MapDrawer({ opId, lat, lon, value, onChange, onZoneConfirmed }) {
  const mapEl = useRef(null);
  const map = useRef(null);
  const layers = useRef({ geografia: null, contingencia: null, grb: null });
  const [drawingLayer, setDrawingLayer] = useState(null);
  const drawHandlerRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState('');

  useEffect(() => {
    if (map.current) return;
    const center = [parseFloat(lat) || 40.4168, parseFloat(lon) || -3.7038];
    const baseLayers = buildBaseLayers();

    map.current = L.map(mapEl.current, {
      center, zoom: 16, zoomControl: true,
      layers: [baseLayers['Híbrido']]
    });

    L.control.layers(baseLayers, null, { position: 'topright', collapsed: false }).addTo(map.current);

    Object.keys(CAPAS).forEach(k => {
      if (value && value[k]) addPolygonFromGeoJSON(k, value[k]);
    });

    setTimeout(() => map.current?.invalidateSize(), 100);

    return () => {
      if (map.current) { map.current.remove(); map.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (map.current && lat && lon) {
      map.current.setView([parseFloat(lat), parseFloat(lon)], 16);
    }
  }, [lat, lon]);

  function addPolygonFromGeoJSON(capa, geojson) {
    if (layers.current[capa]) map.current.removeLayer(layers.current[capa]);
    const layer = L.geoJSON(geojson, { style: () => CAPAS[capa] }).addTo(map.current);
    layers.current[capa] = layer;
  }

  function startDrawing(capa) {
    if (drawHandlerRef.current) {
      drawHandlerRef.current.disable();
      drawHandlerRef.current = null;
    }
    setDrawingLayer(capa);
    const handler = new L.Draw.Polygon(map.current, {
      shapeOptions: CAPAS[capa],
      allowIntersection: true,
      showArea: false,
      drawError: { color: '#e1e100', message: '' },
      icon: new L.DivIcon({ iconSize: new L.Point(10, 10), className: 'leaflet-div-icon leaflet-editing-icon' }),
      maxPoints: 0,
      guidelineDistance: 20
    });
    handler.enable();
    drawHandlerRef.current = handler;

    map.current.once(L.Draw.Event.CREATED, (e) => {
      if (layers.current[capa]) map.current.removeLayer(layers.current[capa]);
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
    if (drawHandlerRef.current?.completeShape) {
      drawHandlerRef.current.completeShape();
    }
  }

  function emitChange() {
    const payload = { geografia: null, contingencia: null, grb: null, snapshotUrl: value?.snapshotUrl || null };
    Object.keys(layers.current).forEach(k => {
      const lyr = layers.current[k];
      if (lyr) payload[k] = lyr.toGeoJSON();
    });
    onChange?.(payload);
  }

  /**
   * Confirma la zona de operación:
   * 1. Captura el snapshot del mapa.
   * 2. Lo sube a Drive.
   * 3. Calcula centroide de la geografía y resuelve la ubicación.
   * 4. Llama onZoneConfirmed con todos los datos.
   */
  async function confirmZone() {
    if (!map.current) return;
    setBusy(true);
    setConfirmStatus('Capturando imagen del mapa...');
    try {
      // 1. Snapshot
      await new Promise(r => setTimeout(r, 800));
      const dataUrl = await domtoimage.toPng(mapEl.current, { quality: 0.85, bgcolor: '#ffffff' });

      // 2. Subir a Drive
      setConfirmStatus('Subiendo a Drive...');
      let snapshotUrl = null;
      try {
        const res = await api.uploadMapSnapshot(opId, dataUrl);
        snapshotUrl = res.url;
      } catch (e) {
        // Si falla la subida, seguimos sin URL pero avisamos
        console.error('Error subiendo snapshot:', e);
        setConfirmStatus('Aviso: imagen no subida (' + e.message + ')');
      }

      // 3. Centroide de la geografía
      let lat = null, lon = null;
      if (layers.current.geografia) {
        const gj = layers.current.geografia.toGeoJSON();
        const feat = gj.features?.[0] || gj;
        const c = centroidFromGeoJSON(feat);
        if (c) { lat = c.lat; lon = c.lon; }
      }

      // 4. Geocoding inverso
      let ubicacion = null;
      if (lat && lon) {
        setConfirmStatus('Resolviendo ubicación...');
        ubicacion = await reverseGeocode(lat, lon);
      }

      // 5. Actualizar el value local con la URL del snapshot
      onChange?.({
        geografia: layers.current.geografia?.toGeoJSON() || null,
        contingencia: layers.current.contingencia?.toGeoJSON() || null,
        grb: layers.current.grb?.toGeoJSON() || null,
        snapshotUrl
      });

      // 6. Notificar al padre con todo (lat, lon, ubicacion, snapshotUrl)
      onZoneConfirmed?.({ snapshotUrl, lat, lon, ubicacion });

      setConfirmStatus('Zona confirmada ✓');
      setTimeout(() => setConfirmStatus(''), 2500);
    } catch (e) {
      setConfirmStatus('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  const hasGeografia = !!layers.current.geografia;
  const hasContingencia = !!layers.current.contingencia;
  const hasGrb = !!layers.current.grb;
  const hasAll = hasGeografia && hasContingencia && hasGrb;

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
          {hasAll
            ? 'Las 3 áreas dibujadas. Confirma la zona para fijar coordenadas y capturar el mapa.'
            : 'Dibuja las áreas requeridas según el ConOps.'}
        </span>
        <Button
          size="sm"
          variant="primary"
          onClick={confirmZone}
          loading={busy}
          disabled={!hasGeografia}
          type="button"
        >
          {value?.snapshotUrl ? 'Re-confirmar zona' : 'Confirmar zona de operación'}
        </Button>
      </div>

      {confirmStatus && (
        <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded px-3 py-2">
          {confirmStatus}
        </div>
      )}

      {value?.snapshotUrl && !confirmStatus && (
        <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
          ✓ Imagen subida a Drive y zona confirmada.
        </div>
      )}
    </div>
  );
}
