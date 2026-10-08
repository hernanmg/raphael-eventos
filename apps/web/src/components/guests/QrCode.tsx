import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * QR dibujado en el navegador a partir del valor — nunca se guarda como
 * imagen en el servidor (decisión de Fase 3).
 */
export function QrCode({ value, size = 260 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#141414', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div style={{ width: size, height: size }} className="animate-pulse rounded-xl bg-line" />
    );
  }
  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt="Código QR de tu entrada"
      className="rounded-xl"
    />
  );
}
