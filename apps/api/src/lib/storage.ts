import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../env';

/**
 * Storage de archivos que no van en Postgres: contratos digitales y logos de
 * sponsors. Dos implementaciones detrás de la misma interfaz:
 *
 *  - SupabaseStorage (producción): Supabase Storage vía su API REST, con la
 *    service role key — el bucket es PRIVADO, los archivos los sirve siempre
 *    la API (que chequea permisos), nunca una URL pública del bucket.
 *  - LocalFsStorage (solo desarrollo): disco local, gitignored. En un PaaS
 *    (Render) el disco se pierde en cada redeploy — por eso env.ts
 *    exige las variables de Supabase cuando NODE_ENV=production.
 *
 * Claves: las genera siempre el código (ASCII seguro). Supabase rechaza
 * claves con caracteres no ASCII ("Contrato Núñez.pdf" fallaría), así que el
 * nombre original de un archivo vive en la base, no en la clave.
 */
export interface FileStorage {
  save(key: string, buffer: Buffer, contentType: string): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

/** Nombre histórico — los contratos fueron el primer uso de esta interfaz. */
export type ContractStorage = FileStorage;

export class StorageError extends Error {}

class LocalFsStorage implements FileStorage {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    const safe = key.replace(/\.\./g, '');
    return path.join(this.root, safe);
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

/**
 * Supabase Storage (API REST v1). Cada "carpeta" (contracts/, sponsors/) es
 * un prefijo dentro del mismo bucket privado.
 */
class SupabaseStorage implements FileStorage {
  constructor(
    private readonly baseUrl: string,
    private readonly serviceKey: string,
    private readonly bucket: string,
    private readonly prefix: string,
  ) {}

  private objectUrl(key: string): string {
    const objectPath = `${this.prefix}/${key}`.split('/').map(encodeURIComponent).join('/');
    return `${this.baseUrl.replace(/\/+$/, '')}/storage/v1/object/${encodeURIComponent(this.bucket)}/${objectPath}`;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.serviceKey}`, apikey: this.serviceKey, ...extra };
  }

  async save(key: string, buffer: Buffer, contentType: string): Promise<void> {
    const res = await fetch(this.objectUrl(key), {
      method: 'POST',
      headers: this.headers({ 'Content-Type': contentType, 'x-upsert': 'true' }),
      body: buffer,
    });
    if (!res.ok) {
      throw new StorageError(
        `Supabase Storage: no se pudo subir (${res.status}) ${await res.text()}`,
      );
    }
  }

  async read(key: string): Promise<Buffer> {
    const res = await fetch(this.objectUrl(key), { headers: this.headers() });
    if (!res.ok) {
      throw new StorageError(`Supabase Storage: no se pudo leer (${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const res = await fetch(this.objectUrl(key), { method: 'DELETE', headers: this.headers() });
    // Borrar algo que ya no existe no es un error (mismo criterio que rm --force).
    if (!res.ok && res.status !== 404 && res.status !== 400) {
      throw new StorageError(`Supabase Storage: no se pudo borrar (${res.status})`);
    }
  }
}

const LOCAL_BASE = path.join(__dirname, '..', '..', 'storage');

function createStorage(folder: string): FileStorage {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    return new SupabaseStorage(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      env.SUPABASE_STORAGE_BUCKET,
      folder,
    );
  }
  return new LocalFsStorage(path.join(LOCAL_BASE, folder));
}

export const storageDriver: 'supabase' | 'local' =
  env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'local';

export const contractStorage: FileStorage = createStorage('contracts');
export const sponsorLogoStorage: FileStorage = createStorage('sponsors');
