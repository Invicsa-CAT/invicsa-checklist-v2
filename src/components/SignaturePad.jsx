import { useEffect, useRef, useState } from 'react';
import Button from './Button';

/**
 * Canvas de firma. Soporta touch y mouse.
 * Props:
 *   - value: dataURL de la firma actual (string o null)
 *   - onChange: callback(dataURL | null) cuando cambia la firma
 *   - height: altura en px (default 160)
 */
export default function SignaturePad({ value, onChange, height = 160 }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(!!value);
  const lastPos = useRef({ x: 0, y: 0 });

  // Configurar canvas en alta resolución y restaurar firma previa si existe
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, height);

    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, height);
        setHasContent(true);
      };
      img.src = value;
    }
  }, []);

  function getPos(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0];
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function start(e) {
    e.preventDefault();
    setDrawing(true);
    lastPos.current = getPos(e);
  }

  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasContent(true);
  }

  function end() {
    if (!drawing) return;
    setDrawing(false);
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onChange?.(dataUrl);
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasContent(false);
    onChange?.(null);
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="border border-slate-300 rounded-md overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
          style={{ touchAction: 'none', display: 'block', cursor: 'crosshair' }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {hasContent ? 'Firma capturada' : 'Firme con el dedo o el ratón'}
        </span>
        <Button size="sm" variant="ghost" onClick={clear} disabled={!hasContent} type="button">
          Borrar firma
        </Button>
      </div>
    </div>
  );
}
