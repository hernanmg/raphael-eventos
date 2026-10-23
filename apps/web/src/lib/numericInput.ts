// Campos numéricos sin letras (feedback 2026-10-23). Un solo listener global
// en vez de un handler por input: hay montos/cantidades en una docena de
// pantallas (React Hook Form y estado local) y `type="number"` no alcanza —
// Firefox deja tipear letras ahí, Chrome deja "e" y "+", y los inputs de
// texto con `inputMode="decimal"` no filtran nada.
//
// Aplica a todo <input type="number"> o con inputMode decimal/numeric:
//  - decimal / number: dígitos, coma y punto (el server acepta ambas);
//  - numeric: solo dígitos;
//  - el signo "-" solo si el input declara un `min` negativo (ej. IPC).
// Se filtra en `beforeinput`, que cubre teclado, pegar, arrastrar y los
// teclados de celular. Borrar / mover el cursor no se toca (no traen `data`).

function allowedPattern(input: HTMLInputElement): RegExp | null {
  const mode = input.inputMode;
  const isNumberType = input.type === 'number';
  if (!isNumberType && mode !== 'decimal' && mode !== 'numeric') return null;
  const negative = input.min !== '' && Number(input.min) < 0;
  if (mode === 'numeric') return negative ? /^[0-9-]*$/ : /^[0-9]*$/;
  return negative ? /^[0-9.,-]*$/ : /^[0-9.,]*$/;
}

function onBeforeInput(event: Event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const pattern = allowedPattern(input);
  const data = (event as InputEvent).data;
  if (pattern && data && !pattern.test(data)) event.preventDefault();
}

let installed = false;

export function installNumericInputGuard() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('beforeinput', onBeforeInput, true);
}
