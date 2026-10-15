import { useEffect, useState } from 'react';

// Mismo corte que el breakpoint `md` de Tailwind. El panel admin cambia de
// estructura (no solo de estilos) entre desktop y mobile: cards de módulo vs.
// tablero + barra inferior. Se resuelve en JS para no montar las dos versiones
// a la vez ni disparar sus queries de más.
const DESKTOP_QUERY = '(min-width: 768px)';

function matches(): boolean {
  // Sin matchMedia (jsdom en los tests) se asume desktop.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia(DESKTOP_QUERY).matches;
}

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(matches);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isDesktop;
}
