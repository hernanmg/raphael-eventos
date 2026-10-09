# Raphael Eventos — Propuesta de plataforma digital

*Landing comercial + portal de clientes y panel administrador. Documento preparado a partir del mockup y la nota de voz enviados por el cliente (agosto 2026). Versión completa entregada como .docx en la conversación.*

## 1. Resumen ejecutivo
La idea original: una app donde cada cliente ve sus eventos contratados (15 años o egresos), cuánto pagó, cuánto debe y a qué valor está su tarjeta hoy (actualizada por IPC), sin llamar para preguntar. Del lado del salón, un panel para ver eventos, cobros y saldos. Esta propuesta suma más músculo administrativo (vender y cobrar mejor, no solo mostrar info) y una capa interactiva para invitados. Sin presupuesto para apps nativas → PWA instalable (resuelve el pedido de "anclar al escritorio" sin costo de tiendas).

## 2. Lo ya definido (mockup + audio)
**Portal cliente:** login/registro propio, home con eventos contratados, ficha de 15 años (invitados, pagos/pendientes, saldo, % abonado, actualización por IPC con historial mensual), ficha de egreso (lista de alumnos, tarjetas adulto/menor/brindis, mínimo de invitados vs. actual), contacto directo WhatsApp/Instagram.
**Panel admin:** dashboard (eventos totales, 15 años, egresos, próximos), tabla de eventos contratados con saldo, valores de IPC (hoy cargados a mano desde Excel). El dueño fue explícito: NO quiere ver pagos de plataforma ni gastos internos en el panel.

## 3. Arquitectura: una plataforma, tres capas
Landing comercial pública (no existe hoy) + Portal cliente (login) + Panel administrador (login, permisos elevados). Un solo desarrollo/mantenimiento, cada quien ve lo suyo.

## 4. Potencial administrativo a sumar
- Cobros: recordatorios automáticos de vencimiento (WhatsApp/email), plan de pagos con alertas de atraso, carga rápida de entregas con timestamp/autor.
- Ventas: CRM de consultas desde la landing (estados: nuevo/contactado/con seña/perdido), calendario de disponibilidad del salón, usuario propio para el vendedor (Fede).
- Datos: importación automática de Excel de egresados (reemplaza carga manual), reportes (ocupación, ingresos comprometidos vs cobrados, comparativa interanual), exportación a PDF/Excel, contratos digitales adjuntos por evento, trazabilidad de cambios (quién/cuándo).

## 5. Interactividad para invitados
Micrositio liviano por evento (sin cuenta completa, acceso por link/QR): cuenta regresiva + ubicación, mural de fotos colaborativo (alternativa simple a crear un Instagram por fiesta), RSVP digital (alimenta el mínimo de invitados), playlist colaborativa (Spotify), QR de invitación, botones de Instagram/WhatsApp del salón en cada micrositio — convierte a cada invitado en cliente potencial futuro.

## 6. Landing comercial
Institucional (capacidad, servicios), galería de fotos/videos, formulario de cotización que alimenta el CRM, testimonios/FAQ, SEO local. Hoy el salón solo tiene Instagram y WhatsApp.

## 7. Roles de usuario
Invitado (sin cuenta) → Cliente (login) → Vendedor/Fede (usuario interno, CRM + calendario) → Administrador (todo + reportes + configuración de IPC).

## 8. Por qué PWA y no app nativa
Se instala como app (ícono en pantalla de inicio/escritorio) sin pasar por App Store/Play Store, sin costo de tienda, un solo código para las tres capas, soporta notificaciones push, y deja abierta la puerta a migrar a nativa el día que el volumen lo justifique.

## 9. Fases sugeridas — las 4 fases originales están terminadas
1. **Base — terminada.** Landing + login/registro propio (no Supabase Auth, ver `04-arquitectura-y-costos.md`) + portal cliente + panel admin básico, como PWA. Base de datos local con Docker, primera migración aplicada.
2. **Cobrar y vender mejor — terminada.** CRM de consultas, calendario de disponibilidad, recordatorios automáticos, importación de Excel, contratos digitales — más dos módulos nuevos que no estaban en el alcance original y se sumaron acá: **costeo interno** (Plan Pro, rubros + fórmula de precio real de Fede) y **personal/empleados** (Básica: ABM + asignación a evento; Pro: horas, liquidación, comisiones). Ver el detalle completo en `03-reunion-cami-fede.md`.
3. **Invitados — terminada.** Micrositio por evento, RSVP, QR individual, check-in en la puerta con rol "Puerta" para empleados. Mural de fotos y playlist colaborativa quedaron en su versión simple (link externo/Instagram), no la nativa — decisión confirmada más de una vez, no es un pendiente.
4. **Escala — terminada.** Directorio de proveedores + sponsors (landing/portal filtrados por tipo de evento, comisión de referencia nunca expuesta públicamente), edición de eventos (datos, estado, cambio de titular con transferencia real de acceso al portal), ajuste trazable de valores de tarjeta (motivo obligatorio, separado del ajuste automático por IPC), auditoría a nivel de base de datos (append-only, ni la propia app puede alterar el historial), reportes (ocupación, comprometido vs. cobrado, interanual) y exportaciones (Excel/CSV/PDF). El "usuario vendedor" del alcance original quedó resuelto sin cambios (se usa el rol tal cual está). La playlist colaborativa sigue diferida a propósito.

**Fuera de las 4 fases, a propósito:** el onboarding multi-tenant (alta de un salón nuevo, panel de superadmin, cobro de Básica/Pro) necesario para vender a los otros ~60 salones del grupo de Fede no entra en ninguna de las fases de arriba — son todas features para que Cami y Fede usen la plataforma, no para revenderla. Se decidió dejarlo como un proyecto aparte, para cuando se acerque la venta real (el plan de negocio habla de "el año que viene" después del piloto).

## 10. Próximos pasos
Presentar la propuesta y ajustar prioridades, definir contenido de la landing, acordar alcance y cronograma de la Fase 1, y conseguir el Excel actual de valores de tarjetas para diseñar la importación automática.

## Estado
Propuesta entregada al usuario en .docx el 19/08/2026. **Las 4 fases originales están construidas, cerradas y verificadas con Claude Code** (detalle de cada una en `03-reunion-cami-fede.md` y `04-arquitectura-y-costos.md`). `npm run test` corre completo en verde (50/50 — shared, API y web), incluyendo un bug real que encontró esa corrida: la limpieza de datos de test no filtraba por tenant y dependía por accidente de una FK para no borrar eventos reales — quedó resuelto con un helper (`src/test/dbCleanup.ts`) que descubre las tablas a limpiar desde el catálogo de FKs de Postgres, filtrado por marcas de test (emails @example.com, ids test-…), en vez de una lista mantenida a mano.

**Desde el 09/10/2026 está en marcha el plan de deploy de la primera versión** (piloto con Fede y Cami) — checklist completo en `checklist-deploy.md`, con los datos reales del tenant ya confirmados (Instagram, WhatsApp de contacto, email, link del mapa) y las decisiones de qué sembrar en la base de producción ya tomadas (cuentas de Fede/Cami por seed, sin eventos ni empleados de prueba migrados, Supabase Storage desde el día cero).

Pendientes generales a esta fecha (09/10/2026), ninguno bloqueante para que Fede y Cami empiecen a usarla como piloto:
- Alta ante Meta de la WhatsApp Business Platform (WABA) para que los recordatorios automáticos funcionen — distinto del número de WhatsApp de contacto, que ya está cargado. Ver detalle en `checklist-deploy.md`.
- Reglas de negocio del costeo Pro (renegociación de insumos >10%, tope de seña 30%) siguen sin definirse en ningún artefacto, solo mencionadas verbalmente por Fede.
- Validar tarifas de WhatsApp Business API directamente con Meta (hoy la referencia es de un agregador, no la fuente oficial).
- Confirmar con Fede y Cami los precios finales de Básica/Pro y los fees de alta.
- Onboarding multi-tenant (ver nota arriba) — deliberadamente fuera de alcance hasta que se acerque la venta a otros salones.