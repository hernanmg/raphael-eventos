# Raphael Eventos — contexto para Claude Code

Plataforma web para un salón de fiestas en Córdoba (landing comercial + portal de
clientes + panel administrador), diseñada desde el día uno como **multi-tenant**
para venderse a otros salones más adelante. El contexto completo de producto
(decisiones del cliente, reuniones, costos) vive en `docs/` — leerlo antes de
tocar cualquier decisión de negocio no cubierta acá.

## Alcance: Fase 1 completa, Fase 2 en construcción

De las 4 fases descritas en `docs/01-propuesta-plataforma-digital.md`, la
**Fase 1 (Base)** está completa y cerrada:

- Landing comercial (referencia de diseño/contenido: `docs/landing/landing.html`).
- Login/registro del cliente, vinculado a sus eventos por email.
- Portal cliente: eventos, saldo, tarjetas por tipo (adulto/adolescente/menor/brindis
  según el tipo de evento), valor actualizado por IPC.
- Panel admin básico: dashboard, alta de eventos, vista de estado del IPC.

Ahora en construcción la **Fase 2 ("Cobrar y vender mejor")** — ver las
secciones de abajo para el detalle de cada módulo y su estado real. Sigue
**explícitamente fuera de alcance** (no implementar sin preguntar antes,
aunque esté documentado en `docs/`): directorio de proveedores, rol invitado

- QR, cualquier cosa de pagos/facturación real (gateway de cobro). Esos son
  Fase 3/4, no se adelantan sin que el usuario lo pida.

## Fase 2 — costeo y personal (implementado)

Se suman dos módulos nuevos al alcance ya planeado de Fase 2 (CRM de consultas,
calendario de disponibilidad, recordatorios automáticos, contratos digitales —
esos siguen en pie, estos dos no los reemplazan). Salieron de analizar el Excel
real de costeo de Fede (`docs/raphael_eventos_costos.xlsx`: hojas `COSTOS`,
`PRECIOS.`, `HORAS SALON.`) y de una reunión posterior a
`docs/03-reunion-cami-fede.md` — ese doc puede estar desactualizado en los
puntos donde difiere de esta sección, que es la fuente más reciente.

**Ambos módulos completos de punta a punta**: migración
(`20260908120000_costeo_personal`, con RLS/GRANT incluidos), backend
(`apps/api/src/modules/costing/`, `apps/api/src/modules/staff/`,
middleware nuevo `requirePlan.ts` que consulta el plan del tenant fresco en
cada request igual que `requireRole`), schemas compartidos
(`packages/shared/src/costing.ts`, `staff.ts`) y frontend
(`/admin/costeo/config`, `/admin/personal`,
`/admin/personal/:employeeId/liquidacion`, más las secciones de costeo y
personal embebidas en `AdminEventDetailPage`). `GET /me` ahora devuelve
también `tenantPlan` (`auth.service.ts#getTenantPlan`) para que el frontend
gatee las pantallas Pro sin un round-trip extra. El tenant seed
(`prisma/seed.ts`) quedó en Plan PRO con los 3 catálogos reales del Excel de
Fede precargados (13 rubros de insumo, 8 de servicio, 13 gastos fijos con
Alquiler marcado `guestScaled`) y dos empleados de ejemplo (Pao con comisión,
Adri con fijo + variable por evento), uno de ellos ya asignado al evento
demo para poder probar la auto-generación de `EventServiceCost` sin pasos
manuales previos.

**Gotcha real encontrado en el smoke test**: `Event.minGuests` es `null`
para QUINCE/BODA/EMPRESARIAL a propósito (Fase 1: ese campo es específico
del "mínimo contratado" de EGRESO) — usarlo como default de `guestCount`
para el costeo dejaba "Costo x 100 invitados"/"Costo tarjeta" en $0 para los
otros 3 tipos de evento. Fix: `EventCostingSection` tiene un input de
"Invitados para el cálculo" que sobreescribe el default vía
`GET /admin/events/:id/costing?guestCount=`; con 0 invitados muestra un aviso
en vez de números en cero silenciosos.

**Verificado con Playwright (skill `webapp-testing`)**: login admin, catálogos
de costeo cargados desde el seed, ABM de personal con Pao/Adri, detalle de
evento con "Personal asignado" (Pao ya asignado) y "Costeo (Plan Pro)"
mostrando la línea de servicio auto-generada (`auto (personal)`), alta de una
línea de insumo de prueba recalculando costo neto/costo tarjeta en vivo, y
liquidación de Adri (carga de hora + liquidar mes) en
`/admin/personal/:id/liquidacion`. Matemática del costeo verificada a mano
contra los números mostrados (costo x100 invitados y costo tarjeta con
ganancia/rotura/IVA aplicados correctamente).

No tocar `schema.prisma` de estos dos módulos salvo que se pida un cambio
explícito — el diseño ya está construido y probado, no es un borrador.

**Cami y Fede son dueños del salón y acceden por igual a todo el panel admin,
incluido personal/nómina** — no hay ninguna restricción VENDEDOR vs ADMIN
dentro de estos dos módulos nuevos (a diferencia de otras decisiones de
acceso que sí puedan existir en el resto de la app).

### Módulo de costeo (Plan Pro)

Rehace en la app el cálculo que Fede hoy hace a mano en Excel. Modelos
propuestos:

- `TenantCostConfig` (fila única por tenant): `gananciaPct` (0.40),
  `roturaPct` (0.15), `ivaPct` (0.21), `insumoRenegotiationPct` (0.10),
  `advanceDepositCapPct` (0.30) — todos editables, no hardcodeados.
- `SupplyCategory` — catálogo de rubros de insumo configurable por tenant
  (Verdulería, Pollo, Carnicería, Pescadería, Macro, Panadería, Fiambre,
  Golosinas, Alcohol, Descartables/Limpieza, Repostería, Sushi, Lavandería).
- `EventSupplyLine` — línea de insumo cargada **contra un evento puntual**,
  no un catálogo de productos persistente: el menú (y por lo tanto la lista
  de insumos) cambia evento a evento, tal cual el Excel real (`PRECIOS.` se
  rehace desde cero cada vez). Columnas fijas: `productName`, `presentation`,
  `quantity`, `unitCost`, más `categoryId`. El admin la completa vía form o
  plantilla `.xlsx` de columnas fijas — **no** un importador genérico que
  intente leer cualquier Excel (la estructura real de Fede cambia mes a mes:
  orden de columnas, tipos de dato, unidades — se rompería seguido).
- `ServiceCostCategory` + `EventServiceCost` — gasto de servicio por evento
  (Mozos, Barra, Bacha, DJ, Fotógrafo, Seguridad, Flecha, Baño...).
  `EventServiceCost.employeeId` es opcional: cuando el gasto corresponde a un
  empleado dado de alta en el módulo de personal, se vincula ahí (ver
  "Personal ↔ costeo" abajo).
- `FixedCostCategory` — gasto fijo de salón (Luz, Gas, Alquiler, Piletero,
  Jardinero, Limpieza, Horas semanales, Comisiones, Lavandería, Canva, Meta,
  Contador, Seguro), con `monthlyAmount` (el valor "celda amarilla" que Fede
  pisa cada 2-3 meses, sin historial versionado — a diferencia de
  `IpcIndexValue` no hay una fuente externa que auditar) y `guestScaled`
  (bool, default false, true solo en Alquiler hoy: prorrateo extra por cada
  100 invitados, configurable por si otro rubro lo necesita en otro salón).

Fórmula (computada en runtime a partir de estas tablas + `TenantCostConfig`,
mismo criterio que ya usa `indexFactor()` para el IPC — no se snapshotea el
resultado en una tabla de "cierre" del costeo):

```
costo_neto_evento = Σ(EventSupplyLine) + Σ(EventServiceCost)
                     + Σ(FixedCostCategory.monthlyAmount / eventos_del_mes,
                         con el ajuste extra /(invitados/100) si guestScaled)
costo_por_100_invitados = costo_neto_evento / (invitados / 100)
costo_tarjeta = costo_por_100_invitados × (1 + ganancia) × (1 + rotura) × (1 + iva)
```

**Renegociación de insumos (>10% configurable) y tope de seña (30%
configurable): decisión cerrada — solo alerta visual, nunca bloquean nada.**
Si un insumo cargado supera `insumoRenegotiationPct` respecto a su valor
anterior, el evento muestra un aviso; si un pago supera
`advanceDepositCapPct` del total, el form de carga de pago avisa pero permite
igual registrarlo. Ningún flujo queda bloqueado por estos umbrales.

### Módulo de personal (Básica: ABM + asignación · Pro: horas/liquidación)

No estaba en ningún doc anterior — sale de la hoja real `HORAS SALON.`
(registro diario de horas de Pao/Adri + pago mensual + notas de "comisiones
adelantadas").

- `Employee`: `contractType` (`EN_BLANCO` / `MONOTRIBUTO` / `INFORMAL` — solo
  clasificación/etiqueta, **sin ninguna lógica impositiva**, mismo criterio
  que ya rige para no meterse con pagos/facturación formal de clientes) +
  estructura de compensación (`fixedMonthlyAmount`, puede ser 0; `variableType`
  `NINGUNO`/`MONTO_POR_EVENTO`/`COMISION_PCT` + `variableValue`, puede ser 0)
  para representar sueldo fijo puro, por evento puro, o mixto (caso real de
  Pao y Adri). ABM (alta/edición/baja vía `active`) es Plan Básica.
- `EventStaffAssignment` (Básica): solo quién trabajó en qué evento, sin
  montos.
- `EmployeeTimeEntry`, `PayrollEntry`, `EmployeeCommissionAdvance` (Pro):
  registro de horas por día (`hours` nullable — Fede a veces anota texto en
  vez de un número: "Evento", "feriado", "-"), liquidación por período
  (`fixedComponent` + `variableComponent`), y comisiones adelantadas a cuenta
  registradas individualmente (reconciliables contra un `PayrollEntry`
  posterior) — mismo espíritu que la decisión ya tomada de "sin pagos en la
  app" para clientes (es dinero real hacia terceros, registro para uso
  interno de Fede/Cami, no generación de recibos válidos ni transferencias
  reales).

**Personal ↔ costeo: decisión cerrada — auto-completar.** Cuando se asigna a
un evento un empleado con `variableType` distinto de `NINGUNO`, esa
asignación (`EventStaffAssignment`) genera sola la línea correspondiente en
`EventServiceCost` (vinculada por `employeeId`) en vez de cargarse a mano dos
veces; el admin puede editar el monto igual si el real difiere del calculado.

## Fase 2 — CRM de consultas + Calendario de disponibilidad (implementado)

Comparten un único modelo, `Lead` (migración `20260908130000_crm_calendario`,
con RLS), porque una consulta "con seña" es justamente lo que reserva
tentativamente una fecha en el calendario antes de que exista un `Event`
real. `LeadStatus` = `NUEVO / CONTACTADO / CON_SENA / GANADO / PERDIDO`.
Mismo criterio de acceso que el resto de Fase 2: `requireRole('ADMIN',
'VENDEDOR')`, sin diferenciar Cami de Fede.

- **Alta pública sin auth**: `POST /api/v1/leads` (`apps/api/src/modules/crm/`),
  detrás de `express-rate-limit` (20 cada 15 min) igual criterio que
  `/auth/login` — es un endpoint público expuesto a abuso. Lo llama
  `QuoteForm.tsx` de la landing, que ahora hace dos cosas al enviarse: crea el
  lead vía este endpoint (si falla, no bloquea nada) y sigue abriendo
  WhatsApp con el mensaje armado, que sigue siendo el canal real de
  conversación. El campo "Fecha tentativa" pasó de texto libre a
  `<input type="date">` para que el dato sea usable en el calendario.
- **Gestión admin**: `GET/PATCH /api/v1/admin/leads` (`/admin/consultas`,
  `LeadsPage.tsx`) — filtro por estado, notas internas editables inline.
- **Calendario**: `GET /api/v1/admin/calendar?from&to` junta `Event` por
  `eventDate` (confirmado) + `Lead` por `interestedDate` con status
  `NUEVO/CONTACTADO/CON_SENA` (tentativo — se excluye `GANADO`/`PERDIDO` para
  no duplicar contra el `Event` real una vez convertido, ni mostrar fechas ya
  descartadas). `/admin/calendario` (`AvailabilityCalendarPage.tsx`) es una
  grilla mensual simple, confirmado en sólido vs. tentativo en punteado.
- `Event.titularPhone` (nuevo campo, mismo criterio que `titularEmail`) se
  sumó en esta misma migración porque hacía falta para el módulo de
  recordatorios (siguiente) — antes no existía ningún teléfono de contacto
  del titular en el modelo.

No hay conversión automática lead→evento: el admin sigue dando de alta el
evento por el flujo normal (`/admin/eventos/nuevo`) y opcionalmente marca el
lead como `GANADO` con `convertedEventId` — evita duplicar la lógica de alta
de evento (matching por email, tarjetas, etc.) en un segundo lugar.

Verificado con Playwright de punta a punta: envío de una consulta desde la
landing (queda creada Y sigue abriendo WhatsApp con el texto correcto),
aparece en `/admin/consultas`, cambio de estado a "Con seña" sin error, y la
fecha tentativa aparece marcada (punteado) en `/admin/calendario` en el mes
correcto junto al evento confirmado del seed (sólido).

## Fase 2 — Importación de Excel de alumnos (implementado)

No suma modelos nuevos — es un modo de carga alternativo sobre `POST
/admin/events` que ya existía (`CreateEventSchema.alumnos`), mismo criterio
que el resto de Fase 2: plantilla de columnas fijas, no un parser genérico
(`apps/api/src/modules/admin/importAlumnos.ts`, con `exceljs`):

- `GET /admin/events/import-alumnos/template` genera y sirve un `.xlsx` con
  columnas fijas (`nombre`, `email de contacto`, `teléfono`) + una fila de
  ejemplo.
- `POST /admin/events/import-alumnos` (multipart, `multer` en memoria)
  parsea el `.xlsx` subido **sin crear nada todavía** — devuelve las filas
  parseadas + un error por fila si falta el nombre o el email es inválido.
  Las columnas se ubican por nombre de encabezado (no por posición fija), así
  que tolera que el admin reordene columnas en su propia copia de la
  plantilla.
- `CreateEventPage.tsx`: cuando `type === 'EGRESO'`, los botones "Descargar
  plantilla" / "Importar desde Excel" hacen `replace()` sobre el
  `useFieldArray` de alumnos con las filas devueltas — el admin sigue viendo
  y editando cada fila antes de mandar el alta real, la importación solo
  evita la carga manual repetitiva.
- De paso se sumó `contactPhone` a `AlumnoInputSchema`/`EventBeneficiary`
  (la columna ya existía en el modelo desde Fase 1 pero no estaba conectada a
  ningún input) — hacía falta para que el módulo de recordatorios pueda
  mandarle un WhatsApp a la familia de cada alumno.

**Gotcha de tipos real:** `exceljs` declara `Workbook.xlsx.load()` contra su
propia copia de `@types/node` (hoisting en `node_modules`), nominalmente
distinta de la de este workspace — ni `Buffer.from()` ni un cast `as unknown
as Buffer` conforman, hace falta `as any` puntual (con
`eslint-disable-next-line`, mismo criterio que `validate.ts`). El buffer en
sí es válido en runtime, es un choque de tipos entre paquetes, no un bug real.

Verificado con Playwright: descarga de la plantilla real desde el form, subida
del mismo archivo sin modificar (round-trip), y la fila de ejemplo
("Juan Pérez") aparece cargada en el form de alta con nombre/email/teléfono
correctos.

## Fase 2 — Contratos digitales (implementado)

Adjunto simple — decisión cerrada, sin firma electrónica real (el admin sube
un PDF ya firmado por otro medio). Modelo `EventContract` (migración
`20260908140000_contratos`, `eventId` único: un contrato por evento,
re-subir reemplaza el anterior).

- `apps/api/src/lib/storage.ts`: interfaz `ContractStorage` +
  `LocalFsContractStorage` (filesystem local bajo `apps/api/storage/`,
  gitignored) — no hay Supabase Storage conectado (el dev usa Postgres
  propio en Docker, no Supabase). Swap a Supabase Storage pendiente para
  cuando se configure el deploy real; el resto del código no cambia porque
  todo pasa por la interfaz.
- `apps/api/src/modules/contracts/`: `contracts.service.ts` (lógica
  compartida) + `contracts.routes.ts` con dos routers — `contractsAdminRouter`
  (`POST/GET/DELETE /admin/events/:eventId/contract`,
  `GET .../contract/file` con `multer` en memoria, valida
  `application/pdf`, 10MB máx.) y `contractsPortalRouter`
  (`GET /portal/events/:eventId/contract[/file]`, requiere algún
  `EventAccount` para ese evento — **sin** el recorte own/aggregate: el
  contrato es del evento entero, no hay dato financiero de otra familia en
  juego, así que cualquier rol vinculado lo puede ver).
- Frontend: `AdminContractSection.tsx` embebido en `AdminEventDetailPage`
  (subir/reemplazar/eliminar + link de descarga), `PortalContractLink.tsx`
  embebido en `EventDetailPage` del portal (solo aparece si hay contrato
  cargado). Los links de descarga son `<a href>` directos al endpoint de la
  API (no `fetch`+blob) — la cookie de sesión viaja igual en una navegación
  normal, no hace falta manejarlo a mano.

Verificado con Playwright: subida de un PDF de prueba desde el admin,
descarga con `Content-Type: application/pdf` correcto, y el mismo contrato
visible con "Ver contrato" desde el portal del cliente titular de ese evento.

## Fase 2 — Recordatorios automáticos (implementado)

Cadencia fija configurable por tenant, sin plan de cuotas/vencimientos nuevo
(decisión cerrada) — canal WhatsApp Business API (sin credenciales todavía,
ver limitación abajo). Modelos `TenantReminderConfig` (fila única por
tenant) y `ReminderLog` (migración `20260908150000_recordatorios`, con RLS).

- `apps/api/src/lib/whatsapp.ts`: interfaz `WhatsAppSender` +
  `UnconfiguredWhatsAppSender`, que devuelve siempre `{ok:false, error:
'WhatsApp Business API no configurado todavía'}` — **explícito, no simula
  un envío exitoso**. Cuando exista la alta en Meta Business Manager, se
  agrega una implementación nueva y se swapea acá sin tocar
  `reminders.service.ts`.
- `apps/api/src/modules/reminders/reminders.service.ts#runReminderSweep`:
  recorre `EventBeneficiary` del tenant con saldo pendiente (reusa
  `computeBeneficiaryFinancials`), decide por beneficiary si corresponde
  recordatorio (sin `ReminderLog` previo → primer recordatorio; evento
  dentro de `daysBeforeEventIfUnpaid` días → recordatorio de urgencia
  independiente de la cadencia; si no, cadencia normal
  `cadenceDaysIfPendingBalance` desde el último log), arma el mensaje,
  intenta `WhatsAppSender.send` contra `EventBeneficiary.contactPhone`
  (egreso) o `Event.titularPhone` (resto) — sin teléfono cargado, la fila
  queda `SKIPPED` con el motivo explícito en vez de fallar en silencio.
- `apps/api/src/jobs/reminderCron.ts`: `node-cron` diario (09:00),
  `startReminderCron()` se llama solo dentro del `if (require.main ===
module)` de `index.ts` — nunca al importar `createApp()` desde los tests,
  que no necesitan un cron corriendo en paralelo. Itera todos los tenants
  con `TenantReminderConfig.enabled = true`.
- `GET/PUT /admin/reminder-config`, `GET /admin/reminders/log`,
  `POST /admin/reminders/run` (dispara el barrido manualmente,
  `trigger: MANUAL`) — `/admin/recordatorios` (`RemindersPage.tsx`): config +
  botón "Enviar ahora" + log completo, incluidos los `SKIPPED`/`FAILED` con
  el mensaje que le tocaba a cada contacto — usable a mano mientras no haya
  WhatsApp real conectado.

**Limitación real, no un bug**: sin alta en Meta Business Manager, todo
recordatorio termina en `FAILED` (si hay teléfono) o `SKIPPED` (si no hay
teléfono cargado) — nunca `SENT`. Verificado con Playwright disparando un
barrido manual contra el seed: 3 beneficiarios con saldo pendiente
revisados, los 3 `SKIPPED` por falta de teléfono cargado (ninguno de los
fixtures del seed tiene `contactPhone`/`titularPhone`), con el mensaje
completo (nombre, saldo, evento, fecha) visible en el log — confirma que el
pipeline completo funciona de punta a punta hasta el límite real de la
integración externa.

## Fase 2 — asignación de pagos por tarjeta + vista de cliente (implementado)

Feedback real post-entrega: el saldo en $ ya andaba bien, pero no había
forma de saber **qué tarjetas puntuales** cubre un pago (ej. "esta familia
pagó 2 adultos y 1 menor, faltan 2 adolescentes y 1 menor"), y revisar un
cliente con 2+ eventos significaba ir evento por evento a mano.

**Asignación de pagos — decisión cerrada: opcional, no obligatoria.** Un
pago rápido (típico de un 15 años, donde paga una sola persona) puede
seguir siendo solo un monto sin desglosar; el desglose se usa cuando aporta
(egresos, pagos parciales por tipo). Nuevo modelo `PaymentCardAllocation`
(migración `20260908170000_payment_allocations`, con RLS) —
`{paymentId, cardType, quantity}`, sin unique constraint (un pago puede
tener varias líneas, una por tipo). El saldo en $ sigue siendo la fuente de
verdad (los valores de tarjeta se actualizan por IPC, así que "cuánto falta
en $" y "cuántas unidades faltan" son dos lecturas complementarias, no la
misma cuenta — no siempre coinciden centavo a centavo).

- `admin.service.ts#recordPayment` valida cada línea de `input.allocations`
  contra lo que realmente falta de ese tipo (cantidad total del
  `EventCard` menos lo ya asignado en pagos previos de ese beneficiary) —
  rechaza con 400 (`InvalidAllocationError`) si se intenta marcar como
  pagas más unidades de las que existen o ya están cubiertas. Al borrar un
  pago (`deletePayment`), borra primero sus asignaciones (la FK es
  `RESTRICT`, no `CASCADE`, a propósito para no perder ese borrado en
  silencio si algún día se agrega otra lógica ahí).
- `lib/financials.ts`: `serializeCard()` ahora recibe `quantityPaid` (suma
  de asignaciones de ese tipo across todos los pagos del beneficiary, vía
  `quantityPaidByType()`) y lo devuelve en `CardSummary.quantityPaid`.
  `serializePayment()` nuevo — arma `PaymentSummary` con sus
  `allocations[]`, reusado por `admin.service.ts` y `portal.service.ts`
  para no duplicar el mapeo.
- UI: `BeneficiaryPaymentsSection.tsx` — al cargar un pago, un toggle
  opcional "¿Este pago cubre tarjetas puntuales?" muestra un input por tipo
  con cupo restante ya calculado. Columna "Pagas" (`X / Y`) agregada a la
  tabla de tarjetas en `AdminEventDetailPage`, `EventDetailPage` del portal
  (scope "own" — el propio dato del cliente, no cambia ninguna regla de
  privacidad existente) y `BeneficiaryReportPage` (reporte imprimible).

**Vista de cliente — un mismo cliente puede tener 2+ eventos.** Antes no
había forma de revisar el estado de un cliente sin ir evento por evento.
Nuevo: `admin.service.ts#listClients`/`getClientDetail` — junta todos los
`EventAccount` de un `User` (rol CLIENTE) con el resumen financiero de cada
uno (reusa `computeBeneficiaryFinancials` para vínculos "own",
`computeAggregateFinancials` para titulares de egreso "aggregate", mismo
criterio de scope que ya regía en el portal — no se inventó una regla de
privacidad nueva). `/admin/clientes` (buscador simple por nombre/email) +
`/admin/clientes/:userId` (lista de eventos con saldo, cada uno linkeando
al detalle real del evento para seguir operando ahí — esta vista es un
punto de entrada/resumen, no duplica la UI de pagos/costeo).

Verificado con Playwright: pago de $40.000 asignado a "2 Adulto" en el
evento demo — la tabla pasa a mostrar "2 / 80" tanto en el admin como en el
portal del cliente (mismo dato, dos pantallas), y `/admin/clientes` lista
al usuario demo con sus 2 eventos (uno "own" con saldo real, uno
"aggregate" marcado "ve solo el agregado del evento").

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

**Con esto se completó toda la Fase 2** ("Cobrar y vender mejor" + los dos
módulos nuevos de costeo/personal) — ver las secciones "Fase 2 — ..." de
arriba para el detalle de cada módulo. Cinco migraciones nuevas sobre la
base de Fase 1 (`20260908120000_costeo_personal`,
`20260908130000_crm_calendario`, `20260908140000_contratos`,
`20260908150000_recordatorios`, todas con RLS), dependencias nuevas en
`apps/api` (`exceljs`, `multer`, `node-cron`), y pantallas nuevas:
`/admin/costeo/config`, `/admin/personal`,
`/admin/personal/:id/liquidacion`, `/admin/consultas`, `/admin/calendario`,
`/admin/recordatorios`, más las secciones embebidas en
`AdminEventDetailPage` (personal asignado, costeo, contrato) y
`EventDetailPage` del portal (link de contrato). `typecheck` + `lint` +
`build` limpios en las 3 carpetas después de cada módulo, y cada uno
verificado de punta a punta con Playwright contra los dos dev servers
levantados juntos (no `npm run test`, por la preferencia de arriba).

No corrí `npm audit fix` sobre las dependencias nuevas (`exceljs`/`multer`
arrastran algunas vulnerabilidades moderadas/altas en transitivas, según
`npm install`) — quedó sin resolver a propósito para no arriesgar romper algo
sin poder correr la suite; revisar con `npm audit` antes de un deploy real.

Dos límites externos reales, no bugs, que quedan documentados en sus
secciones: WhatsApp Business API sin credenciales (recordatorios corren
completos pero terminan en `FAILED`/`SKIPPED`, nunca `SENT`) y Supabase
Storage sin conectar (contratos usan filesystem local en dev). Cuando el
usuario tenga esas credenciales/cuenta, son swaps acotados detrás de las
interfaces `WhatsAppSender`/`ContractStorage`, no un rediseño.

Resto de Fase 2 sin construir todavía, ninguno pedido en esta ronda:
micrositio de invitados + RSVP + mural de fotos + QR (Fase 3), directorio de
proveedores, reportes avanzados/exportaciones/trazabilidad (Fase 4).

## Fase 2 — ajustes de feedback real post-entrega

El usuario probó la app entregada y volvió con una ronda de feedback real —
un bug de cálculo real (IPC), un hueco funcional (alta de pagos, nunca
construido), y varios ajustes de UX. Todo lo de acá ya está implementado y
verificado con Playwright.

**Fix de cálculo real — el IPC se calculaba mal.** La fórmula heredada de
Fase 1 (`sourceLatestValue / sourcePreviousValue`) asumía que la serie de
datos.gob.ar devuelve niveles de índice. Consultando la API real
(`https://apis.datos.gob.ar/series/api/series/?ids=145.3_INGNACUAL_DICI_M_38&limit=2&sort=desc`)
se confirmó que en realidad es una serie de **variación intermensual**
(`"units":"Variación intermensual"` en la respuesta) — cada valor ya es un
% de variación (ej. `0.0211377...` = +2.11% en julio), no un nivel. Con la
fórmula vieja, dos meses reales de inflación (1.9% y 2.1%) daban una
"variación" de 2.1/1.9 ≈ 1.105 (un 10.5% en vez de 2.1%) — un error real
sobre plata de clientes. Corregido en `admin.service.ts#addIpcEntry`:
`índice_nuevo = índice_anterior × (1 + sourceLatestValue/100)`, usando solo
el valor más reciente (el anterior queda de referencia/auditoría).
`sourcePreviousValue`/`sourceLatestValue` (mismos nombres de columna, sin
migración) ahora son puntos porcentuales, no niveles — labels del form en
`/admin/ipc` actualizados a "% variación mes anterior/actual".

**IPC automático, implementado (no estaba construido pese a lo que decía
esta sección antes)**: `apps/api/src/lib/ipc.ts` —
`fetchLatestIpcPeriod()` llama la API real con timeout de 8s, nunca la llama
una pantalla de cliente/admin (mismo principio de robustez ya establecido:
solo el cron, `apps/api/src/jobs/ipcCron.ts`, diario a las 08:00). Si hay un
período más nuevo que el guardado, lo encadena y lo escribe
(`triggeredById: null` = automático). Si la API falla, no hace nada — las
pantallas siguen leyendo el último valor guardado, como siempre.
`getIpcStaleness()`: pasado el día 14 del mes (la serie se publica ese día)
sin que el período esperado esté guardado, devuelve un aviso — **decisión
cerrada: el aviso aparece solo en `/admin/ipc` y como banner en
`/admin` (dashboard), nunca en el portal cliente**, que sigue mostrando el
último valor guardado sin interrumpir la pantalla. `GET /admin/ipc` ahora
devuelve `{ history, staleness }`.

**Hueco real encontrado: no existía forma de cargar un pago.** Fase 1 solo
tenía lectura de `payments` (`getEventDetailForAdmin`) — nunca se construyó
el alta. Todo se cobra en persona (efectivo/transferencia) y siempre lo
carga Cami o Fede, nunca el cliente. Agregado
`admin.service.ts#recordPayment` (+ `deletePayment`) —
`POST/DELETE /admin/beneficiaries/:id/payments` — con el mismo aviso
informativo de tope de seña que ya estaba documentado para costeo pero
nunca conectado (`RecordPaymentResult.advanceDepositWarning`, comparado
contra `TenantCostConfig.advanceDepositCapPct`). UI:
`BeneficiaryPaymentsSection.tsx` embebida en cada card de beneficiary del
detalle de evento admin.

**Reporte imprimible para cuando un cliente pide el detalle.** La privacidad
titular/participante de un egreso (portal cliente) choca con poder rastrear
quién debe — decisión cerrada: **el detalle por familia sigue siendo
exclusivo de Cami/Fede** (ya lo era: `getEventDetailForAdmin` no aplica el
recorte de privacidad, a diferencia del portal). Lo nuevo es una vista
imprimible para cuando un cliente puntual lo pide:
`GET /admin/beneficiaries/:id/report` +
`/admin/beneficiarios/:beneficiaryId/reporte`
(`BeneficiaryReportPage.tsx`) — ruta standalone sin Layout/SiteHeader (es un
documento, no una pantalla de la app), con botón "Imprimir/Guardar PDF"
(`window.print()`, sin generación de PDF del lado del servidor). Cami/Fede
lo abren y se lo muestran/mandan a mano.

**Costeo — cantidad de invitados sale de las tarjetas, no de un campo
suelto.** `Event.minGuests` es `null` para QUINCE/BODA/EMPRESARIAL (Fase 1,
a propósito), así que costeo caía en 0 invitados cada vez que se reabría el
evento. Fix real en `computeEventCosting`: el default de `guestCount` ahora
es la suma de `EventCard.quantity` de todos los beneficiaries del evento
(dato que ya existe, cargado al crear el evento) vía
`tx.eventCard.aggregate(...)` — el input manual en la UI lo sigue pudiendo
pisar para simular otro escenario, pero ya no arranca en cero. Cuando de
todos modos da 0 (evento sin tarjetas todavía), el costo neto acumulado
sigue visible en una card aparte ("Costo neto acumulado hasta el momento")
en vez de mostrar $0 en todo sin contexto — costo x100/costo tarjeta se
ocultan con un aviso en vez de mostrar ceros engañosos.

**Insumos: unidad de medida real en vez de "presentación" libre.** El campo
`presentation` (texto libre, ej. "1L", "x 12") generaba confusión real sin
aportar nada que no cubriera ya `productName`. Sacado del modelo
(`EventSupplyLine`, migración `20260908160000_supply_unit`) y reemplazado
por `unit` (enum `SupplyUnit`: `KG` / `LITROS` / `UNIDAD`, dropdown en el
form) — cantidad + unidad alcanza para lo que Fede necesita cargar.

**Calendario: click en un evento confirmado navega a su detalle**
(`/admin/eventos/:id`); click en una consulta tentativa navega a
`/admin/consultas` (no hay pantalla individual por lead todavía).

**"Flecha" en los rubros de gasto de servicio**: viene tal cual del Excel
real de Fede (`docs/03-reunion-cami-fede.md`) — no se sabe con precisión a
qué servicio puntual se refiere en su operación, es un dato de su negocio,
no algo inventado en esta sesión. Queda como pregunta abierta para
confirmar con Fede/Cami — el rubro es editable desde
`/admin/costeo/config` así que se puede renombrar o borrar sin tocar código
si no aplica.
