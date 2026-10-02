import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Abstracción de storage para archivos que no van en Postgres (hoy: solo
 * contratos digitales). No hay Supabase Storage conectado todavía (el dev
 * usa Postgres propio en Docker, no Supabase) — esta interfaz existe para
 * poder swapear a una implementación real (Supabase Storage / S3) cuando se
 * configure el deploy, sin tocar el código que la llama.
 */
export interface ContractStorage {
  save(key: string, buffer: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

const STORAGE_ROOT = path.join(__dirname, '..', '..', 'storage', 'contracts');

/** Implementación de desarrollo — filesystem local, gitignored. */
class LocalFsContractStorage implements ContractStorage {
  private resolve(key: string): string {
    // key siempre la generamos nosotros (tenantId/eventId/filename), pero
    // igual normalizamos para no depender de eso si en algún momento cambia.
    const safe = key.replace(/\.\./g, '');
    return path.join(STORAGE_ROOT, safe);
  }

  async save(key: string, buffer: Buffer): Promise<void> {
    const filePath = this.resolve(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

export const contractStorage: ContractStorage = new LocalFsContractStorage();
