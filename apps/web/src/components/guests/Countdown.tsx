import { useEffect, useState } from 'react';

const UNITS: { label: string; ms: number }[] = [
  { label: 'días', ms: 86_400_000 },
  { label: 'horas', ms: 3_600_000 },
  { label: 'min', ms: 60_000 },
  { label: 'seg', ms: 1_000 },
];

export function Countdown({ target }: { target: Date }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  let remaining = target.getTime() - now;
  if (remaining <= 0) {
    return <p className="font-serif text-2xl text-gold-soft">¡Llegó el día!</p>;
  }

  const parts = UNITS.map((unit) => {
    const value = Math.floor(remaining / unit.ms);
    remaining -= value * unit.ms;
    return { label: unit.label, value };
  });

  return (
    <div className="flex gap-3" aria-label="Cuenta regresiva al evento">
      {parts.map((part) => (
        <div
          key={part.label}
          className="min-w-[64px] rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-center"
        >
          <p className="font-serif text-2xl font-semibold tabular-nums">
            {String(part.value).padStart(2, '0')}
          </p>
          <p className="text-[11px] uppercase tracking-[1.5px] text-white/60">{part.label}</p>
        </div>
      ))}
    </div>
  );
}
