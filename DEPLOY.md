# Deploy a producción — Raphael Eventos (piloto)

Arquitectura: **web** (`apps/web`, estática) en Vercel · **API** (`apps/api`,
servidor persistente con crons) en Railway/Render · **Postgres + Storage** en
Supabase. Nada de esto queda commiteado con secretos: todas las credenciales
van en los dashboards de cada servicio.

## 0. Decisión previa: dominio (bloqueante)

La sesión es una cookie `httpOnly` + `Secure` + `SameSite=Lax`. Para que el
navegador la mande desde la web a la API, **las dos tienen que estar en el
mismo sitio (mismo dominio registrable)**:

- ✅ **Recomendado:** dominio propio con subdominios, ej.
  `raphaeleventos.com.ar` (web) + `api.raphaeleventos.com.ar` (API). Cero
  cambios de código.
- ❌ `*.vercel.app` + `*.up.railway.app` sin dominio propio: son sitios
  distintos (están en la Public Suffix List) → la cookie no viaja → **el
  login no funciona**.
- ❌ `SameSite=None`: Safari (todos los iPhone) bloquea cookies de terceros →
  el login fallaría en iOS. No es una opción.

## 1. Supabase

1. Crear el proyecto (región São Paulo).
2. **Database → Connection string**: usar la conexión **directa / session
   mode (puerto 5432)** — no el pooler en transaction mode (6543): la app usa
   transacciones interactivas con `set_config(..., true)` para RLS.
3. **Storage → New bucket**: nombre `raphael-eventos`, **privado** (no
   público). Los archivos los sirve siempre la API.
4. **Settings → API → Data API**: deshabilitarla (la app no la usa). Además,
   la migración `20261009130000_supabase_hardening` le quita todo permiso a
   `anon`/`authenticated` — sin eso, la tabla `session` (sin RLS a propósito)
   sería legible con la clave pública del proyecto.

## 2. Migraciones (con el rol dueño, una vez por release)

```bash
cd apps/api
DATABASE_URL="postgresql://postgres:<pass>@<host>:5432/postgres" npx prisma migrate deploy
```

Siempre `migrate deploy`, nunca `migrate dev` (ver CLAUDE.md).

## 3. Rotar la contraseña de `app_user` (una sola vez, OBLIGATORIO)

La migración inicial crea `app_user` con una contraseña de desarrollo
(`app_user_dev_only`, está en el repo). En el SQL editor de Supabase:

```sql
ALTER ROLE app_user WITH PASSWORD '<secreto largo y aleatorio>';
```

## 4. Alta del salón y de los admins (una sola vez)

```bash
cd apps/api
DATABASE_URL="<dueño>" npm run tenant:bootstrap -- \
  --config prisma/bootstrap/raphael-eventos.json \
  --admin "Fede <email-de-fede>" --admin "Cami <email-de-cami>"
```

Crea el tenant con el perfil público real, los rubros de costeo (montos en 0,
los completa Fede) y las dos cuentas ADMIN con **contraseña temporal generada
en el momento** (se imprime una sola vez; al entrar les pide cambiarla). No
crea eventos, empleados ni proveedores. Idempotente; para regenerar la
contraseña de un admin: `--reset-password <email>`.

## 5. Historial de IPC (una sola vez)

```bash
cd apps/api
APP_DATABASE_URL="<app_user>" npm run ipc:backfill
```

La base de producción es nueva: el backfill que se corrió en desarrollo no
viaja solo. Trae la serie real de datos.gob.ar; idempotente. Después los
meses nuevos los trae el cron diario.

## 6. API (Railway/Render)

- Root: raíz del repo. Build: `npm ci && npm run build:shared && npm run build -w apps/api`.
  Start: `npm run start -w apps/api`. Health check: `GET /health`.
- **Una sola instancia** (crons en proceso + rate limit en memoria).

| Variable                    | Valor                                                      | Notas                                                    |
| --------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| `NODE_ENV`                  | `production`                                               | Activa las validaciones de abajo.                        |
| `PORT`                      | (lo pone el host)                                          |                                                          |
| `APP_DATABASE_URL`          | `postgresql://app_user:<pass rotada>@<host>:5432/postgres` | Único rol que usa la API.                                |
| `SESSION_SECRET`            | ≥ 32 caracteres aleatorios                                 | Ej. `openssl rand -base64 48`.                           |
| `TENANT_SLUG`               | `raphael-eventos`                                          |                                                          |
| `WEB_ORIGIN`                | `https://<dominio-web>`                                    | Varios separados por coma (apex + www). Solo `https://`. |
| `TRUST_PROXY`               | `1`                                                        | Proxy del host.                                          |
| `SUPABASE_URL`              | `https://<proyecto>.supabase.co`                           |                                                          |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key                                           | **Secreta**, solo en la API.                             |
| `SUPABASE_STORAGE_BUCKET`   | `raphael-eventos`                                          |                                                          |

`DATABASE_URL` (dueño) **no** va en el servicio web — solo en los pasos 2 y 4.
Con `NODE_ENV=production` la API **no arranca** si falta Supabase, si
`SESSION_SECRET` es corto, si `TRUST_PROXY` es 0 o si `WEB_ORIGIN` no es
https (mejor fallar al deployar que degradar en silencio). Al arrancar loguea
`Entorno: production · storage: supabase · CORS: …` — verificarlo.

## 7. Web (Vercel)

- Root directory: `apps/web` (`vercel.json` ya define install/build y la
  redirección de rutas a `index.html` — sin eso, abrir directo un link de
  invitación `/i/…` daba 404).
- Variable: `VITE_API_URL=https://<dominio-api>`.

## 8. Prueba de punta a punta

1. Landing: WhatsApp, Instagram, email, dirección y mapa correctos.
2. Login de Fede con la temporal → pide cambiarla → panel.
3. Cargar un evento real → subir un contrato PDF → descargarlo (prueba
   Supabase Storage de verdad).
4. Alta de Pao/Adri → "Dar acceso a la puerta" → login de puerta → check-in.
5. Link de invitación desde el portal → confirmar desde un celular → QR.
6. Reporte del año con interanual (requiere el paso 5).
7. Recordatorios: hasta el alta en Meta quedan `FAILED`/`SKIPPED` (esperado).

## Pendientes conocidos (no bloquean el piloto, decidir)

- **Email transaccional (Resend): no hay nada construido.** No existe
  verificación de email ni "olvidé mi contraseña" (solo el modelo
  `AuthToken`). Hoy un cliente que olvida la contraseña no tiene cómo
  recuperarla.
- `npm audit`: vulnerabilidades en dependencias transitivas de `exceljs`/
  `multer` sin revisar.
