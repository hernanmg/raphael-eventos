/** Error de una fila/form compacto de costeo. Antes estos forms no mostraban
 *  ningún error y "Agregar" parecía no hacer nada (feedback 2026-10). */
export function FormError({ message, className = '' }: { message?: string; className?: string }) {
  if (!message) return null;
  return <p className={`mt-1.5 text-xs text-red-600 ${className}`}>{message}</p>;
}
