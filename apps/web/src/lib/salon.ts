// Helpers de presentación del perfil público del salón (SalonProfile).

export function whatsappUrl(number: string, text?: string): string {
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/**
 * "5493513180810" → "351 318-0810" (celular argentino: 54 + 9 + área + número).
 * Otro formato se muestra tal cual con "+" adelante.
 */
export function formatWhatsappDisplay(number: string): string {
  if (number.startsWith('549') && number.length === 13) {
    const local = number.slice(3);
    return `${local.slice(0, 3)} ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  return `+${number}`;
}

/** "https://www.instagram.com/raphael.eventos/" → "@raphael.eventos". */
export function instagramHandle(url: string): string {
  const handle = url.replace(/\/+$/, '').split('/').pop();
  return handle ? `@${handle}` : url;
}
