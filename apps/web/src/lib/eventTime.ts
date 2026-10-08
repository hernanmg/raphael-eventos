/**
 * Hora local del salón respecto de UTC — mismo valor que
 * SALON_UTC_OFFSET_HOURS en apps/api (guests.service.ts). Argentina, sin
 * horario de verano.
 */
const SALON_UTC_OFFSET_HOURS = -3;

/**
 * Instante de inicio del evento: `eventDate` es la medianoche UTC del día
 * (fecha de calendario) y `startTime` ("HH:mm") es hora local del salón.
 * Sin hora cargada, se toma el comienzo del día.
 */
export function eventStartsAt(eventDate: string | null, startTime: string | null): Date | null {
  if (!eventDate) return null;
  const day = new Date(eventDate);
  const [hours = 0, minutes = 0] = (startTime ?? '00:00').split(':').map(Number);
  return new Date(
    Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      hours - SALON_UTC_OFFSET_HOURS,
      minutes,
    ),
  );
}
