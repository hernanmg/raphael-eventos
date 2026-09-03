# Raphael Eventos — contexto para Claude Code

Plataforma web para un salón de fiestas en Córdoba (landing comercial + portal de
clientes + panel administrador), diseñada desde el día uno como **multi-tenant**
para venderse a otros salones más adelante. El contexto completo de producto
(decisiones del cliente, reuniones, costos) vive en `docs/` — leerlo antes de
tocar cualquier decisión de negocio no cubierta acá.

## Alcance actual: SOLO Fase 1

De las 4 fases descritas en `docs/01-propuesta-plataforma-digital.md`, hoy se
construye **únicamente la Fase 1 (Base)**:

- Landing comercial (referencia de diseño/contenido: `docs/landing/landing.html`).
- Login/registro del cliente, vinculado a sus eventos por email.
- Portal cliente: eventos, saldo, tarjetas por tipo (adulto/adolescente/menor/brindis
  según el tipo de evento), valor actualizado por IPC.
- Panel admin básico: dashboard, alta de eventos, vista de estado del IPC.

**Explícitamente fuera de esta etapa** (no implementar sin preguntar antes, aunque
estén documentadas en `docs/`): módulo de costeo/stock (plan Pro), directorio de
proveedores, rol invitado + QR, recordatorios por WhatsApp, CRM de consultas,
calendario de disponibilidad, cualquier cosa de pagos/facturación. Si en el medio
del desarrollo algo de esto parece trivial de sumar, **preguntar primero** — el
objetivo es una Fase 1 sólida, no varias fases a medio hacer.

## Arquitectura

Monorepo con `npm workspaces` (sin Turborepo/Nx — overhead innecesario para 2 apps
con un solo desarrollador):

```
apps/
  web/      React + Vite + TypeScript (landing/portal/admin, PWA instalable)
  api/      Node + Express + TypeScript (API propia, sin BaaS de auth)
packages/
  shared/   Zod schemas + tipos TS compartidos entre web y api
docs/       Documentos de producto/negocio (no tocar sin que el usuario lo pida)
```

**Frontend (`apps/web`):** React Router, TanStack Query, React Hook Form + Zod,
Tailwind CSS v4 (paleta y tipografía tomadas de `docs/landing/landing.html`:
ink `#141414` / cream `#f7f5f0` / gold `#a3813f`, Playfair Display en títulos,
Inter en texto — tokens definidos en `apps/web/src/index.css` vía `@theme`).
PWA instalable con `vite-plugin-pwa` (sin apps de tienda, decisión ya tomada).

Estructura: `src/routes/` (una pantalla por archivo, export default),
`src/components/` (compartidos: `Layout`, `SiteHeader`, `AuthCard`,
`FormField`), `src/hooks/` (`useSession`, `useLogout` — TanStack Query sobre
`src/lib/api.ts`), `src/help/features.ts` (ver "Sección de Ayuda" abajo).
`RequireAuth` (`src/routes/RequireAuth.tsx`) es el guard de rutas
autenticadas — envuelve con `<Route element={<RequireAuth />}>` en `App.tsx`,
redirige a `/login` si `useSession()` no devuelve usuario.

**Sección de Ayuda (`/ayuda`):** pedida explícitamente por el usuario como una
página que crece con el proyecto — buscador de funcionalidades + intro de la
solución. La lista ES la fuente de verdad: **cada vez que se termina una
funcionalidad de cara al usuario, agregarla a
`apps/web/src/help/features.ts`** (título, propósito en una oración, `path`
de la ruta) en el mismo cambio que la implementa, no después. No agregar
entradas de funcionalidades a medio hacer.

**Gotcha real ya corregido — los tests de `apps/api` corren contra el mismo
Postgres/tenant que usa el seed.** `auth.test.ts` hacía `user.deleteMany({})`
sin filtro en `beforeEach`/`afterAll` — como corre contra el tenant real
"raphael-eventos" (no uno aislado), cada corrida de la suite borraba también
al usuario demo sembrado por `prisma/seed.ts`, rompiendo el login local hasta
volver a sembrar. Fix aplicado: el cleanup solo borra usuarios con email
`@example.com` (el dominio que usan todos los fixtures del archivo, RFC 2606)
— nunca un `deleteMany({})` sin scope sobre `user` en ese archivo. Si se
agregan tests nuevos que crean usuarios, usar ese mismo dominio o extender el
filtro; no volver a un `deleteMany({})` sin condición.

**Testing del frontend:** `src/test/setup.ts` stubea `fetch` global antes de
cada test para simular "deslogueado" por default (`SiteHeader` dispara
`useSession()` → `GET /me` en cualquier pantalla) — tests que necesitan una
sesión activa o un login exitoso pisan el stub con
`vi.stubGlobal('fetch', vi.fn(...))` dentro del test. `src/test/renderWithProviders.tsx`
envuelve con `QueryClientProvider` + `MemoryRouter` (con `route` inicial
configurable) — usarlo en vez de armar los providers a mano en cada test.

**Backend (`apps/api`):** Express + Prisma contra Postgres. Zod valida payloads
compartiendo schemas con el frontend vía `packages/shared`.

**Auth propia (NO Supabase Auth):** login y sesión son un módulo propio dentro de
`apps/api` (`src/modules/auth/`) — hasheo con `@node-rs/argon2` (Argon2id,
parámetros OWASP m=19456/t=2/p=1; se usó esta implementación en vez del paquete
`argon2` clásico porque sus binarios prebuilt vía napi-rs son más confiables de
instalar en Node recientes), sesión con cookies `httpOnly` + `secure` +
`sameSite=lax` vía `express-session` + `connect-pg-simple`. Rate limiting con
`express-rate-limit` sobre `/api/v1/auth/login`. Verificación de email y
recupero de contraseña comparten un único modelo `AuthToken` con campo
`purpose` (todavía sin endpoints — solo está registrado el modelo).

Rutas activas: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`,
`POST /api/v1/auth/logout`, `GET /api/v1/auth/me`. El registro además ejecuta
el matching por email (titular/participante) descrito abajo, dentro de la
misma transacción que crea el usuario.

**Portal cliente (`src/modules/portal/`):** `GET /api/v1/portal/events`
(resumen de todos los eventos del usuario logueado — nombre, tipo, rol, saldo,
% abonado) y `GET /api/v1/portal/events/:eventId` (detalle). Ambas rutas
requieren `requireAuth` y calculan el "scope" según `EventAccount.beneficiaryId`
(ver el modelo de datos abajo):

- `scope: "own"` (titular de QUINCE/BODA/EMPRESARIAL, o participante de un
  alumno en EGRESO) → el detalle trae el desglose de tarjetas por tipo
  (`cards`, con `unitValue` ya ajustado por IPC) y la lista de `payments`.
- `scope: "aggregate"` (titular de EGRESO) → el detalle trae SOLO totales
  agregados de todos los beneficiaries del evento (`aggregate.totalValue`,
  etc.) y `beneficiaryCount` — nunca el desglose de cada familia. El listado
  (`GET /events`) nunca expone `cards`/`payments` en ninguno de los dos
  scopes, ni siquiera para el propio — eso es privativo del detalle; hubo que
  corregir esto una vez porque `computeBeneficiaryFinancials()` se spreadeaba
  entero por error (TypeScript no marca "excess property" en spreads, así que
  el tipo `EventSummary` no lo agarró — hay que revisar esto a mano en
  cualquier endpoint nuevo que arme una respuesta a partir de un spread).

El cálculo del valor de tarjeta "actualizado por IPC" vive en
`portal.service.ts` (`indexFactor()`): toma el `IpcIndexValue` más reciente
cargado en el tenant y el más cercano (hacia atrás) al `basePeriod` de la
tarjeta, y aplica `baseValue × (índice_actual / índice_en_basePeriod)`. Sin
ningún `IpcIndexValue` cargado el factor es 1 (no rompe la pantalla) — hoy
esos valores los pone el seed a mano (`prisma/seed.ts`, dos períodos), porque
el job programado contra datos.gob.ar (ver el modelo de datos) todavía no
está construido — eso es Fase 1 "panel admin: vista de estado del IPC", una
pieza distinta y posterior a esta.

Tipos de respuesta compartidos con el frontend en
`packages/shared/src/portal.ts` (`EventSummary`, `EventDetail`,
`CardSummary`, `PaymentSummary`) — TS interfaces, no Zod, porque el backend
genera estos datos él mismo, no hay input de usuario que validar.

**Panel admin (`src/modules/admin/`):** todas las rutas van detrás de
`requireRole('ADMIN', 'VENDEDOR')` (`middleware/requireRole.ts` — a
diferencia de `requireAuth`, hace una query porque el rol no viaja en la
sesión; deja el usuario en `req.currentUser`). No hay alta de admin
self-service — esas cuentas se siembran a mano (`prisma/seed.ts`), nunca por
`/registro` (sería un agujero de seguridad).

- `GET /api/v1/admin/dashboard` — total de eventos por tipo + **la lista
  completa de eventos del tenant** (no solo próximos — el frontend arma la
  vista "Próximos eventos" y el filtro por card de tipo a partir de esa
  lista completa, así clickear una card puede mostrar eventos pasados/de
  cualquier fecha de ese tipo, no solo los próximos 5).
- `GET /api/v1/admin/events/:eventId` — detalle de evento para el panel
  admin. Reutiliza `computeBeneficiaryFinancials` de `lib/financials.ts`
  (extraído ahí porque `portal.service.ts` también lo necesita) pero, a
  diferencia del portal cliente, **no aplica el recorte de privacidad
  titular/participante** — el staff ve el desglose de cada beneficiary
  (cada familia de un egreso incluida), con un flag `linked` indicando si
  ya hay una cuenta de cliente vinculada a esa fila.
- `POST /api/v1/admin/events` — alta de evento. Para QUINCE/BODA/EMPRESARIAL
  crea un único `EventBeneficiary`; para EGRESO crea uno por alumno, todos
  con la MISMA plantilla de tarjetas (simplificación de Fase 1 — ajustar
  valores por alumno individual queda para después). `basePeriod` de las
  tarjetas es siempre el primer día del mes actual, no un campo del form.
  Si el email del titular (o el de un alumno) ya tiene cuenta en el tenant,
  el alta lo vincula al instante (`linkExistingAccountByEmail` en
  `admin.service.ts`) — es el caso simétrico de
  `auth.service.ts#linkPendingEvents` (usuario nuevo, evento ya cargado);
  mismas reglas de negocio (beneficiaryId null para titular de egreso, etc.),
  disparadas desde el otro lado. Si se toca una, revisar la otra.
- `GET /api/v1/admin/ipc` / `POST /api/v1/admin/ipc` — historial y carga
  manual de IPC. **Deliberadamente NO llama a datos.gob.ar** — eso sigue sin
  construirse (es trabajo de infra/cron, no de este panel). La carga manual
  le pide al admin los mismos dos valores que usaría el job
  (`sourcePreviousValue`/`sourceLatestValue`) y encadena la variación sobre
  el último índice del tenant, igual mecanismo que se documentó para el
  automático — el día que el job exista, puede escribir en la misma tabla
  sin tocar esta lógica.

No hay "alta de evento" ni "IPC" excel/API real todavía como se imaginó
originalmente en `docs/` (import de Excel para egresados, fetch real de
datos.gob.ar) — son simplificaciones deliberadas de Fase 1, marcadas en el
código. No agregarlas sin que el usuario lo pida explícitamente.

**Base de datos:** Postgres, con **Row-Level Security activa desde la primera
migración** (no es un plan a futuro — ver la regla obligatoria más abajo). En
producción, Supabase (solo Postgres + Storage, no su Auth). En desarrollo
local, Postgres propio vía Docker en el puerto **5450** (`docker-compose.yml`
en la raíz) — no pega contra Supabase.

El servidor corre con **dos roles de Postgres distintos**, definidos en
`apps/api/src/env.ts`:

- `DATABASE_URL` (owner, `postgres`): solo para Prisma CLI (`migrate`,
  `generate`) y `prisma/seed.ts`. Nunca lo usa el servidor para responder
  requests.
- `APP_DATABASE_URL` (`app_user`, sin `BYPASSRLS` ni privilegios de DDL): el
  único rol con el que corre `apps/api/src/index.ts` en runtime. Es lo que
  hace que RLS se aplique de verdad — si el server corriera como el owner,
  Postgres lo dejaría bypassear las policies sin importar que existan.

Toda query a una tabla con `tenant_id` tiene que pasar por
`withTenant(tenantId, fn)` (`apps/api/src/db/withTenant.ts`), que abre una
transacción y hace `set_config('app.tenant_id', tenantId, true)` antes de
correr `fn` — las policies leen ese valor con
`current_setting('app.tenant_id', true)`. Sin pasar por `withTenant`, cualquier
query a esas tablas devuelve cero filas (o falla el `WITH CHECK` en un
insert/update), porque `app_user` no tiene bypass.

Fase 1 = un solo tenant por deploy. `apps/api/src/middleware/tenantContext.ts`
resuelve el tenant una vez al arrancar (por `TENANT_SLUG`) y lo cachea en
memoria — todavía no hay resolución de tenant por subdominio/header por
request. Eso es trabajo de la etapa de venta a otros salones, no de Fase 1.

### Regla obligatoria: RLS en cada migración, no "después"

**Toda migración que crea una tabla con `tenant_id` tiene que habilitar RLS,
crear su policy y otorgarle permisos a `app_user` EN LA MISMA migración.**
Nunca en una migración posterior. La razón por la que esto importa de verdad:
"después" significa agregar RLS tabla por tabla con datos reales ya adentro —
mucho más riesgoso y fácil de olvidarse que hacerlo en el mismo momento en que
la tabla nace vacía.

Patrón a repetir (ver el bloque final de
`apps/api/prisma/migrations/20260903123050_init/migration.sql` como referencia
completa, incluye la creación de `app_user` la primera vez):

```sql
ALTER TABLE "nombre_tabla" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "nombre_tabla" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "nombre_tabla"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "nombre_tabla" TO app_user;
```

Cómo generar y aplicar una migración con esto en cuenta:

1. `npx prisma migrate dev --create-only --name algo` (desde `apps/api`, con
   `npm run db:up` corrido antes) — genera el SQL del diff sin aplicarlo.
2. Editar `migration.sql` a mano: agregar el bloque de arriba para cada tabla
   nueva con `tenant_id`.
3. Aplicar con `npx prisma migrate deploy` (no `migrate dev` — ver la nota de
   la siguiente sección).

Excepciones ya resueltas y por qué: `tenants` no lleva RLS (no tiene columna
`tenant_id`, cada fila ES un tenant; `app_user` solo tiene `GRANT SELECT`, el
alta de tenants es tarea de operación, no de la app). `session`
(express-session/connect-pg-simple) tampoco lleva RLS — no hay columna
tenant_id y sus queries son siempre por `sid` exacto, nunca listados
filtrados por tenant; su DDL está versionado a mano en la migración inicial
(no vía `createTableIfMissing` de connect-pg-simple, precisamente para poder
otorgarle permisos a `app_user` sin darle `CREATE` en el schema).

**Deploy (todavía no configurado):** `apps/web` en Vercel. `apps/api`, al ser un
servidor persistente y no funciones serverless, en Railway o Render.

## Modelo de datos (resumen — ver `apps/api/prisma/schema.prisma` para el detalle)

- `tenant_id` en **todas** las tablas, incluidas las hijas, para que RLS filtre
  por columna propia sin depender de joins.
- `User` unifica staff y clientes (`role`: ADMIN/VENDEDOR/CLIENTE). Email único
  por `(tenantId, email)`, no global.
- `EventBeneficiary` es la abstracción clave: "a quién se factura" dentro de un
  evento. En QUINCE/BODA/EMPRESARIAL hay una sola fila (el evento entero). En
  EGRESO hay una fila por alumno (import de Excel). `EventCard` y `Payment`
  siempre cuelgan de acá, nunca del evento directo — un solo código de cálculo
  de saldo sin importar el tipo de evento.
- `EventAccount` (many-to-many cuenta↔evento con rol titular/participante) tiene
  `beneficiaryId` opcional: `null` = titular de EGRESO (colegio/comisión, ve solo
  el agregado del evento — mínimo de invitados/totales, no el detalle de pago de
  cada familia). Seteado = participante de EGRESO (su alumno) o titular de
  QUINCE/BODA/EMPRESARIAL (el único beneficiary del evento).
- Alta de cuenta por **email**, no por link de invitación: `Event.titularEmail`
  para el contratante, `EventBeneficiary.contactEmail` solo para matching de
  alumnos en egreso. Al registrarse/loguearse se buscan coincidencias por
  tenant+email y se auto-crean los `EventAccount` correspondientes.
- `EventType` es un enum fijo (QUINCE/EGRESO/BODA/EMPRESARIAL), no una tabla
  catálogo por tenant — estos 4 tipos están cerrados con el cliente.
- **IPC ya no se carga a mano.** Se obtiene automáticamente desde la API de
  datos.gob.ar (serie `145.3_INGNACUAL_DICI_M_38`, últimos 2 valores → variación
  encadenada sobre el índice anterior), guardado con historial en
  `IpcIndexValue`. Ver `docs/costos/Arquitectura y costos.md`. **Decisión de
  robustez:** el fetch corre en un job programado que escribe en la tabla — las
  pantallas de saldo del cliente/admin siempre leen ese último valor guardado,
  nunca llaman a datos.gob.ar en el momento de servir una pantalla (saca por
  completo la API de gobierno del path de cualquier pantalla client-facing).
- **Sin pagos/facturación por sistema** (decisión de fondo del cliente, no
  técnica). `Payment` es un registro manual de abonos que carga el admin, no un
  gateway de cobro — el saldo se calcula, no se procesa.

Primera migración (`20260903123050_init`) aplicada contra el Postgres local,
con RLS + roles incluidos (ver la regla obligatoria arriba). Cualquier cambio
de ahí en más sigue esa misma regla.

## Convenciones de código

- TypeScript estricto en todo el repo (`tsconfig.base.json`: `strict`,
  `noUncheckedIndexedAccess`, `noImplicitOverride`, etc.) — cada workspace
  extiende esa base.
- ESLint (flat config, `eslint.config.mjs` en la raíz) + Prettier
  (`.prettierrc.json`). `docs/` está excluido de Prettier a propósito — son
  entregables del cliente, no tocar su formato.
- Vitest en las tres carpetas (`packages/shared`, `apps/api`, `apps/web`).
  `apps/web` usa Testing Library + jsdom.
- `packages/shared` se compila con `tsc` a `dist/` (no hay bundler ahí). Si se
  edita, correr `npm run build:shared` (o `npm run dev -w packages/shared` para
  watch) antes de que `web`/`api` vean los cambios — no hay Turborepo que lo
  encadene automáticamente.
- Terminación de línea LF forzada vía `.gitattributes` (el repo se desarrolla en
  Windows pero deploya a Linux).
- Validación de payloads: usar `parseBody(Schema, req.body, res)`
  (`apps/api/src/lib/validate.ts`), no `Schema.parse(...)` + catch. Motivo
  concreto (no solo estilo): bajo el loader de Vitest, `instanceof ZodError`
  da falso cuando el schema se definió en `packages/shared` y el catch está en
  `apps/api`, aunque ambos resuelvan al mismo archivo de `node_modules/zod` —
  se comprobó en este repo (ver el commit del módulo de auth). `safeParse` en
  el punto de uso evita depender de esa comparación entre paquetes.
- Toda ruta que lea/escriba una tabla con `tenant_id` pasa por
  `withTenant(tenantId, fn)`, nunca por `prisma` directo (ver la sección de
  RLS arriba).
- `packages/shared` se buildea en **dos formatos** (`dist/cjs` y `dist/esm`,
  ver su `package.json` → `exports`), no uno solo. Motivo real, no
  preferencia: al ser un paquete de workspace symlinkeado, Vite resuelve
  `@raphael-eventos/shared` a su ruta real (fuera de `node_modules`) y lo
  procesa como si fuera código propio en vez de pasarlo por el interop
  CJS→ESM — con un solo build CJS, `vite build` fallaba en producción con "X
  is not exported by .../shared/dist/index.js" aunque `apps/api` (que sí
  resuelve por CJS normal) funcionaba bien. Si se agrega un tercer consumidor
  o cambia el bundler, revisar que este mismo problema no reaparezca.
- En `packages/shared/src/index.ts` los re-exports son **nombrados**
  (`export { X } from './mod'`), no `export * from './mod'` — TypeScript
  compila `export *` a un helper CJS (`__exportStar`) que Rollup no puede
  analizar estáticamente, mismo síntoma que el punto anterior. Mantener esta
  forma al agregar nuevos módulos a `packages/shared`.
- Un schema de Zod con `.transform()`/`.preprocess()` (Input ≠ Output, ver
  `RegisterSchema.phone` en `packages/shared/src/auth.ts`) rompe la inferencia
  de tipos si una función genérica lo tipa como `ZodSchema<T>` — TypeScript
  infiere `T` desde el lado "Input" en vez de "Output" (bug real: un campo
  opcional terminaba tipado `unknown`, no `string | undefined`). Fix aplicado
  en `apps/api/src/lib/validate.ts`: tipar el parámetro como
  `ZodType<T, ZodTypeDef, any>`, no `ZodSchema<T>`.

## Comandos habituales

```bash
npm install                  # una vez, o al sumar dependencias nuevas
npm run db:up                # levanta el Postgres local (docker, puerto 5450)
npm run db:seed -w apps/api  # crea el tenant "raphael-eventos" (idempotente)
npm run dev:web              # Vite dev server (http://localhost:5173)
npm run dev:api              # API con reload (http://localhost:3001)
npm run typecheck            # tsc --noEmit en las 3 carpetas
npm run test                 # vitest run en las 3 carpetas (apps/api pega contra la DB local real)
npm run lint                 # eslint .
npm run format                # prettier --write .
npm run build                 # build de shared → api → web, en ese orden
```

Migraciones (desde `apps/api`, con `npm run db:up` corrido antes):

```bash
npx prisma migrate dev --create-only --name algo   # genera el SQL sin aplicar
# ... editar migration.sql: agregar RLS/GRANT para cada tabla nueva ...
npx prisma migrate deploy                            # aplica sin prompts
```

**Gotcha comprobado en este repo:** `npx prisma migrate dev` (sin
`--create-only`, para aplicar una migración ya creada) se quedó colgado sin
imprimir nada — el proceso de Node quedó vivo pero huérfano incluso después de
matar el shell que lo lanzó (verificar con
`Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"` en PowerShell y
`Stop-Process -Force` si aparece). Sospecha: `migrate dev` intenta un prompt
interactivo (posiblemente por drift detection sobre la tabla `session`, que a
propósito no está en el schema de Prisma) y la librería `prompts` no tiene
TTY para mostrarlo. **Usar siempre `prisma migrate deploy` para aplicar
migraciones ya generadas** — no prompta nunca, es exactamente para esto.

**Gotcha general de Windows, no solo de Prisma:** matar el proceso que lanzó un
server (`tsx watch`, `vite`, el wrapper `npm run dev`) no mata sus hijos —
quedan corriendo huérfanos y siguen ocupando el puerto. Pasó también
levantando `apps/api`+`apps/web` para un smoke test con Playwright. Si un
`npm run dev:*` no arranca por `EADDRINUSE` o algo similar no responde en el
puerto esperado, revisar procesos huérfanos antes de asumir otra causa:

```powershell
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like '*proyecto_eventos*' } | Select-Object ProcessId, CommandLine
# y para matarlos:
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like '*proyecto_eventos*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

`apps/api/.env` (gitignored) ya apunta al Postgres local de Docker con ambos
roles (`DATABASE_URL` owner, `APP_DATABASE_URL` app_user). Ver
`apps/api/.env.example` y `apps/web/.env.example` para las variables
esperadas. La contraseña de `app_user` en la migración inicial es un valor de
desarrollo (`app_user_dev_only`) — rotarla antes de aplicar esa migración
contra un ambiente real.

## Estado

Backend (auth + RLS) y frontend de login/registro verificados de punta a
punta:

- `install` + `typecheck` + `test` (27 tests: `packages/shared`, `apps/api`
  contra el Postgres local real, `apps/web` con Testing Library) + `lint` +
  `format` + `build` pasan limpio en las 3 carpetas.
- Smoke test real en navegador (Playwright vía la skill `webapp-testing`, los
  dos dev servers levantados juntos): registro → portal, logout → login,
  login → portal, mensaje de error con contraseña incorrecta, buscador de
  Ayuda filtrando y sin resultados. Encontró y corrigió un bug real que
  ningún test unitario había atrapado: el campo teléfono (opcional) llega
  como `""` desde el `<input>`, no `undefined`, y rompía la validación —
  arreglado con `z.preprocess` en `RegisterSchema.phone`.
- README.md en la raíz con instrucciones de puesta en marcha, y
  `apps/api/prisma/seed.ts` ahora también crea un usuario de prueba
  (`demo@raphaeleventos.com` / `Demo1234!`) además del tenant.

**Landing comercial portada a React** (`/`, `src/routes/landing/`) — mismo
contenido/diseño que `docs/landing/landing.html` (referencia original, no se
tocó), con dos diferencias intencionales: el botón "Iniciar sesión" ya no
abre el modal de demostración, es un `<Link to="/login">` real; y las fotos
siguen siendo placeholders (pendiente de fotos reales del salón). La landing
tiene su propio header/footer — **no** usa el `Layout`/`SiteHeader` de la app
(son dos experiencias distintas: sitio público vs. app autenticada). Ver
`routes/landing/LandingPage.tsx` para la lista de secciones.

**Portal cliente real** (`/portal`, `/portal/eventos/:eventId`,
`src/routes/portal/`) — reemplaza el placeholder anterior. Lista de eventos
(`PortalEventsPage.tsx` + `EventSummaryCard.tsx`) con saldo y % abonado, y
detalle por evento (`EventDetailPage.tsx`) que renderiza distinto según
`scope` ("own": tabla de tarjetas + pagos; "aggregate": solo totales +
invitados, con nota explícita de privacidad para el titular de un egreso).
Verificado con datos reales: `prisma/seed.ts` ahora además del tenant y el
usuario demo crea dos eventos de ejemplo vinculados a ese usuario — uno
QUINCE (scope own, con las 4 tarjetas cargadas y un pago parcial) y uno
EGRESO con 2 alumnos (scope aggregate) — para poder probar ambos casos sin
depender del panel admin (que todavía no existe). Confirmado por curl+psql
que el cálculo de IPC/saldo da los números esperados, y visualmente en
navegador (ambas vistas, más el filtro de Ayuda encontrando las 2 entradas
nuevas).

**Panel admin básico** (`/admin`, `/admin/eventos/nuevo`, `/admin/ipc`,
`src/routes/admin/`) — completa la Fase 1. Dashboard con totales por tipo +
próximos eventos; alta de evento (form único que cubre los 4 tipos, con lista
dinámica de alumnos solo para EGRESO vía `useFieldArray`); vista + carga
manual de IPC. Protegido por `RequireAdmin.tsx` (redirige a `/portal` si el
rol no es ADMIN/VENDEDOR) + `requireRole` en el backend. `SiteHeader` muestra
"Panel admin" solo a esos roles. Usuario admin sembrado
(`admin@raphaeleventos.com` / `AdminDemo1234!`) — no hay alta de admin
self-service, ver la nota de seguridad en la sección de arriba.

Verificado con curl (control de acceso 403 para CLIENTE, alta de evento con
titular ya registrado vinculando al instante, validaciones — sin tarjetas
cargadas, egreso sin alumnos —, encadenado correcto del IPC manual y su
propagación al valor que ve el cliente en el portal) y visualmente en
navegador (dashboard, alta de QUINCE y de EGRESO con alumnos, vista de IPC,
y que un CLIENTE normal queda afuera de `/admin`).

Pantallas existentes: `/` (landing real), `/login`, `/registro`, `/portal`,
`/portal/eventos/:id`, `/ayuda` (7 entradas), `/admin`, `/admin/eventos/nuevo`,
`/admin/eventos/:id`, `/admin/ipc`. **Con esto se completó la Fase 1** tal
como está descrita al principio de este archivo. Los eventos demo del seed
siguen ahí (útiles como fixture de desarrollo) — no hace falta borrarlos, el
alta real convive con ellos sin problema.

**Ajustes de UX post-Fase 1 (feedback directo del usuario):** `CreateEventPage`
e `IpcStatusPage` tienen link "← Panel admin" arriba (y `CreateEventPage`
además un botón "Cancelar" junto al submit) — antes no había forma de volver
sin editar la URL a mano. Las filas de "Próximos eventos"/"Eventos: X" son
`<Link>` a `/admin/eventos/:id`, no texto plano. Las stat cards del dashboard
son botones que filtran esa misma lista por tipo (o "Total" = todos los
eventos sin filtro de fecha) — por eso `getDashboard` pasó de devolver
`upcoming` (top 5) a devolver `events` (todos): filtrar client-side por tipo
sobre una lista ya recortada a "próximos 5" no tendría sentido.

**Otro bug del mismo patrón que el de `auth.test.ts` — cleanup de
`admin.test.ts` no borraba nada de lo que creaba.** `createEvent()` (a
diferencia de las fixtures directas de Prisma en `portal.test.ts`) genera
sus propios cuids, no acepta un id custom — el cleanup por prefijo de id
(`test-admin-`) nunca hizo match contra nada real y dejaba eventos huérfanos
en el tenant en cada corrida. Fix: el cleanup de ese archivo filtra por
`titularEmail` terminado en `@example.com` (dominio de todos los fixtures
del archivo) en vez de por prefijo de id — revisar esto si se agrega un
test nuevo ahí que cree eventos con otro criterio.

**Preferencia de workflow del usuario:** no correr `npm run test` /
`vitest` — lo corre él. Sí correr `typecheck`, `build`, migraciones y seed
cuando corresponda. Motivo: correr la suite reiteradas veces contra la base
de desarrollo compartida fue justamente lo que causó el bug de arriba.
