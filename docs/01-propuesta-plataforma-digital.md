# Raphael Eventos — Propuesta de plataforma digital

*Landing comercial + portal de clientes y panel administrador. Documento preparado a partir del mockup y la nota de voz enviados por el cliente (agosto 2026). Versión completa en `propuesta-raphael-eventos.docx`.*

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

## 9. Fases sugeridas
1. **Base:** landing + login/registro + portal cliente + panel admin básico (lo ya diseñado), como PWA.
2. **Cobrar y vender mejor:** CRM de consultas, calendario de disponibilidad, recordatorios automáticos, importación de Excel, contratos digitales.
3. **Invitados:** micrositio por evento, RSVP, mural de fotos, QR.
4. **Escala:** reportes avanzados, usuario vendedor, playlist colaborativa, exportaciones, trazabilidad.

## 10. Próximos pasos
Presentar la propuesta y ajustar prioridades, definir contenido de la landing, acordar alcance y cronograma de la Fase 1, y conseguir el Excel actual de valores de tarjetas para diseñar la importación automática.

## Estado
Propuesta entregada al usuario en .docx el 19/08/2026. Pendiente de feedback del cliente (dueño del salón) para definir alcance final de Fase 1.
