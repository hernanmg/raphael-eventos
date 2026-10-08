import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';

/**
 * Cámara del celular leyendo QR (PWA, sin app nativa). Usa `qr-scanner`
 * (worker JS) en vez de `BarcodeDetector`, que no existe en iOS Safari. La
 * cámara exige HTTPS — en localhost el navegador la permite igual.
 *
 * `onScan` se llama con cada lectura; el filtrado (pausa mientras hay un
 * invitado en pantalla, ignorar el mismo QR recién procesado) lo hace el
 * componente padre.
 */
export function QrScannerView({ onScan }: { onScan: (data: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!active || !videoRef.current) return;
    const scanner = new QrScanner(videoRef.current, (result) => onScanRef.current(result.data), {
      preferredCamera: 'environment',
      maxScansPerSecond: 4,
      returnDetailedScanResult: true,
      // Cuadro completo, no solo el recuadro central por defecto: un QR que
      // llena la pantalla (celular del invitado muy cerca) deja sus marcas
      // de posición fuera de esa zona y no se lee. Comprobado con la cámara.
      calculateScanRegion: (video) => {
        const side = Math.min(video.videoWidth, video.videoHeight);
        return {
          x: 0,
          y: 0,
          width: video.videoWidth,
          height: video.videoHeight,
          downScaledWidth: Math.min(side, 600),
          downScaledHeight: Math.min(side, 600),
        };
      },
    });
    scanner.start().catch(() => {
      setError(
        'No pudimos abrir la cámara. Revisá el permiso del navegador, o ingresá el código a mano.',
      );
      setActive(false);
    });
    return () => {
      scanner.stop();
      scanner.destroy();
    };
  }, [active]);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-ink">
      {active ? (
        <div className="relative">
          <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
          <button
            type="button"
            onClick={() => setActive(false)}
            className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white"
          >
            Apagar cámara
          </button>
        </div>
      ) : (
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 p-6 text-center">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setActive(true);
            }}
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-ink"
          >
            Activar cámara para escanear
          </button>
          {error && <p className="max-w-xs text-xs text-red-300">{error}</p>}
        </div>
      )}
    </div>
  );
}
