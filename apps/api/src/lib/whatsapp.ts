/**
 * Interfaz del envío de WhatsApp — no hay alta en Meta Business Manager
 * todavía, así que la única implementación real hoy falla de forma
 * explícita en vez de simular un envío exitoso. El pipeline completo
 * (config, barrido, log, mensaje compuesto) corre igual — cuando exista la
 * credencial real, se agrega una implementación nueva que llame a la Meta
 * WhatsApp Business API y se swapea acá, sin tocar reminders.service.ts.
 */
export interface WhatsAppSender {
  send(phone: string, message: string): Promise<{ ok: boolean; error?: string }>;
}

class UnconfiguredWhatsAppSender implements WhatsAppSender {
  async send(_phone: string, _message: string): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: 'WhatsApp Business API no configurado todavía' };
  }
}

export const whatsAppSender: WhatsAppSender = new UnconfiguredWhatsAppSender();
