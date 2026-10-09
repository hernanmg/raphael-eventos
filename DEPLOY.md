# Deploy a producción — Raphael Eventos (piloto)

Stack: **web** (`apps/web`, estática) en **Vercel** · **API** (`apps/api`,
servidor persistente con crons) en **Render, plan free** · **Postgres +
Storage** en **Supabase**. Ningún secreto queda commiteado: todas las
credenciales van en los dashboards de cada servicio.

## Cómo encaja (sin dominio propio)

```
navegador ──https──▶ <web>.vercel.app ─┬─ /api/*  ──rewrite──▶ raphael-eventos-api.onrender.com
                                       └─ resto   ──▶ index.html (SPA)
```

La sesión es una cookie `httpOnly; Secure; SameSite=Lax`. `*.vercel.app` y
`*.onrender.com` son sitios distintos (Public Suffix List), así que la cookie
no viajaría entre ellos. Con el rewrite de `apps/web/vercel.json`, el
navegador habla **solo con Vercel** (mismo origen) y Vercel reenvía `/api/*` a
Render → la cookie queda en el dominio de Vercel y funciona. Cuando se compre
dominio propio se puede pasar a `app.` + `api.` del mismo dominio sin cambiar
código (solo `VITE_API_URL` y `WEB_ORIGIN`).

## 1. Supabase

1. Proyecto `raphael eventos` (región São Paulo).
2. **Storage:** bucket `raphael-eventos-files`, **privado**. Los archivos los
   sirve siempre la API.
3. **Settings → API → Data API:** deshabilitarla (la app no la usa). La
   migración `20261009130000_supabase_hardening` igual le quita todo permiso
   a `anon`/`authenticated` (sin eso, la tabla `session` — sin RLS a
   propósito — sería legible con la clave pública).
4. **Claves:** el proyecto usa el sistema nuevo (`sb_publishable_…` /
   `sb_secret_…`). La **secret key** va en `SUPABASE_SERVICE_ROLE_KEY` (es el
   equivalente del legacy `service_role`; el legacy se apaga a fin de 2026).
5. **Conexión a la base — usar el _Session pooler_, no la conexión directa.**
   `db.<ref>.supabase.co` solo resuelve por IPv6 (verificado) y Render no
   sale por IPv6. En el botón **Connect → Session pooler** está la URL IPv4
   (puerto 5432):
   `postgresql://<usuario>.<ref>:<pass>@aws-…-sa-east-1.pooler.supabase.com:5432/postgres`.
   El usuario va con el sufijo `.<ref>` (ej. `postgres.qifkqhoojktjgsxwrryk`,
   `app_user.qifkqhoojktjgsxwrryk`). **No** el _Transaction pooler_ (6543):
   la app usa transacciones interactivas con `set_config(..., true)` para RLS.

Dos URLs distintas, no confundirlas:

| Variable           | Usuario                          | Para qué                           | Dónde se usa                      |
| ------------------ | -------------------------------- | ---------------------------------- | --------------------------------- |
| `DATABASE_URL`     | `postgres.<ref>` (dueño)         | migraciones, alta del salón        | **solo** en tu máquina, pasos 2–4 |
| `APP_DATABASE_URL` | `app_user.<ref>` (sin BYPASSRLS) | la API en runtime, backfill de IPC | Render + paso 5                   |

Si la API corriera con el usuario `postgres`, se saltearía el aislamiento por
RLS — nunca poner la URL del dueño en Render.

## 2. Migraciones (desde tu máquina, con el dueño)

```bash
cd apps/api
DATABASE_URL="<session pooler, usuario postgres.<ref>>" npx prisma migrate deploy
```

Siempre `migrate deploy`, nunca `migrate dev` (ver CLAUDE.md).

## 3. Rotar la contraseña de `app_user` (OBLIGATORIO, antes de usar la base)

La migración inicial crea `app_user` con una contraseña de desarrollo que está
en el repo (`app_user_dev_only`). En **Supabase → SQL Editor**, con una
contraseña larga generada por vos (que no pase por ningún chat):

```sql
ALTER ROLE app_user WITH PASSWORD '<secreto largo y aleatorio>';
```

Verificar: `SELECT rolname, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'app_user';`
→ `f`, `f`. Con esa contraseña se arma `APP_DATABASE_URL`.

## 4. Alta del salón y de los admins (una sola vez)

```bash
cd apps/api
DATABASE_URL="<dueño>" npm run tenant:bootstrap -- \
  --config prisma/bootstrap/raphael-eventos.json \
  --admin "Fede <fbucarey56@gmail.com>" --admin "Cami <camimanzur@gmail.com>"
```

Crea el tenant con su perfil público, los rubros de costeo (montos en 0) y
las cuentas ADMIN con **contraseña temporal** (se imprime una sola vez; al
entrar les pide cambiarla). No crea eventos, empleados ni proveedores.
Idempotente; regenerar la contraseña de un admin: `--reset-password <email>`.

## 5. Historial de IPC (una sola vez)

```bash
cd apps/api
APP_DATABASE_URL="<app_user>" npm run ipc:backfill
```

La base de producción es nueva: el backfill de desarrollo no viaja solo.

## 6. API en Render

**New → Blueprint** apuntando al repo (usa `render.yaml`): servicio
`raphael-eventos-api`, plan free, región Virginia, build/start ya definidos,
health check `/health`, `SESSION_SECRET` generado por Render. Cargar a mano
las variables marcadas `sync: false`:

| Variable                    | Valor                                                                 |
| --------------------------- | --------------------------------------------------------------------- |
| `APP_DATABASE_URL`          | session pooler con `app_user.<ref>` y la contraseña rotada del paso 3 |
| `WEB_ORIGIN`                | `https://<proyecto>.vercel.app` (el dominio de Vercel, paso 7)        |
| `SUPABASE_URL`              | `https://qifkqhoojktjgsxwrryk.supabase.co`                            |
| `SUPABASE_SERVICE_ROLE_KEY` | la secret key (`sb_secret_…`)                                         |

Ya definidas en `render.yaml`: `NODE_ENV=production`, `NODE_VERSION=22`,
`TENANT_SLUG=raphael-eventos`, `TRUST_PROXY=2`,
`SUPABASE_STORAGE_BUCKET=raphael-eventos-files`. `PORT` lo pone Render (la
API lee `PORT`, nada específico de un host). `DATABASE_URL` **no** va en
Render.

- Si Render le asigna otra URL al servicio (si `raphael-eventos-api` está
  tomado), actualizar el `destination` del rewrite en `apps/web/vercel.json`.
- Con `NODE_ENV=production` la API **no arranca** si falta Supabase, si
  `SESSION_SECRET` es corto, si `TRUST_PROXY` es 0 o si `WEB_ORIGIN` no es
  https. En el log de arranque: `Entorno: production · storage: supabase · CORS: …`.
- **Plan free:** se duerme a los 15 min sin tráfico; la primera request
  después tarda ~1 min. Mientras duerme **no corren los crons** — por eso la
  API se pone al día con el IPC al arrancar (idempotente). Los recordatorios
  no se recuperan así, pero sin el alta en Meta no envían nada igual. Si más
  adelante hace falta que corran puntual, un ping externo gratuito
  (cron-job.org cada 10 min a `/health`) lo mantiene despierto (744 h/mes,
  dentro de las 750 gratis).
- **Una sola instancia** (crons en proceso + rate limit en memoria).

## 7. Web en Vercel

- **New Project** → el repo → **Root Directory `apps/web`** (`vercel.json`
  define install/build desde la raíz del monorepo, el rewrite `/api/*` →
  Render y la redirección de rutas a `index.html`).
- Variable: `VITE_API_URL=same-origin` (rutas relativas a través del rewrite).
- Copiar el dominio asignado (`https://<proyecto>.vercel.app`) a `WEB_ORIGIN`
  en Render.

## 8. Prueba de punta a punta

0. **Proxy/IP:** abrir `https://<web>/api/v1/health` → `ip` tiene que ser tu
   IP pública (comparar con https://api.ipify.org) y `secure: true`. Si
   muestra una IP de Vercel/Render, ajustar `TRUST_PROXY` en Render. (Igual,
   el login tiene un límite por email que no depende de la IP.)
1. Landing: WhatsApp, Instagram, email, dirección y mapa correctos.
2. Login de Fede con la temporal → pide cambiarla → panel.
3. Cargar un evento real → subir un contrato PDF **de varios MB** →
   descargarlo (prueba Supabase Storage real y el límite de tamaño del
   rewrite de Vercel).
4. Alta de Pao/Adri → "Dar acceso a la puerta" → login de puerta → check-in.
5. Link de invitación desde el portal → confirmar desde un celular → QR.
6. Reporte del año con interanual; exportar a Excel (descarga a través del
   rewrite).
7. Cliente que no puede entrar → Clientes → "Generar contraseña temporal".
8. Recordatorios: hasta el alta en Meta quedan `FAILED`/`SKIPPED` (esperado).

## Pendientes conocidos (no bloquean el piloto)

- **Email transaccional:** no hay. Decisión del piloto: si un cliente olvida
  la contraseña, admin le genera una temporal desde su ficha en Clientes.
- `npm audit`: vulnerabilidades en dependencias transitivas de `exceljs`/
  `multer` sin revisar.
- Dominio propio (y con él, sacar el rewrite).
