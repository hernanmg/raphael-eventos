import { useEffect, useRef, useState, type ReactNode } from 'react';

// Port de la clase .reveal/.reveal.in de docs/landing/landing.html: fade-in +
// translateY cuando el bloque entra en viewport, con el mismo "safety net"
// (si por lo que sea el IntersectionObserver nunca dispara, se muestra igual
// a los 2.5s) para que el contenido nunca quede invisible.
export function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Sin IntersectionObserver (navegadores viejos, jsdom en los tests) se
    // muestra directo: antes tiraba ReferenceError y rompía la landing entera.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(el);

    const safety = setTimeout(() => setVisible(true), 2500);

    return () => {
      observer.disconnect();
      clearTimeout(safety);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  );
}
