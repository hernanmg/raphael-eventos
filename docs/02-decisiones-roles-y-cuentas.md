# Raphael Eventos — Roles, ownership de eventos y vinculación de cuentas

*Sigue a `01-propuesta-plataforma-digital.md`. Repaso hecho a partir de las preguntas del cliente sobre el rol Vendedor y la dinámica de cuentas para 15 años y egresos. Incluye los mockups v2 (ver carpeta `mockups/`).*

## 1. Fede, Cami y el rol "Vendedor"
Fede y Cami son los dueños y hacen todo — no hay un equipo de ventas separado hoy. El rol "Vendedor" propuesto no representa a una tercera persona: es un tipo de acceso interno que cualquiera de los dos puede usar para la parte comercial (consultas nuevas, seguimiento, calendario de disponibilidad) sin mezclarla con la vista operativa de eventos ya contratados. Se mantiene la idea.

Nota aparte: cuando en el audio se habla de "salir a vender", el dueño se refería a vender **la plataforma en sí** a otros salones chicos (que hoy no tienen nada así), no a vender más eventos propios. Es una oportunidad de negocio distinta y más grande (productizar esto como SaaS) — vale la pena tenerla anotada como posible fase futura, pero es un producto aparte del que se está construyendo para Raphael Eventos.

## 2. Modelo de cuentas y ownership de eventos

**Problema:** una cuenta no puede ser 1 evento = 1 cuenta, porque (a) en un egreso el "cliente" real es el colegio/comisión, no cada familia, y (b) una misma persona puede tener más de un evento con el salón (dos hijas con 15 años distintos, un hijo en un egreso y una hija con 15 años, etc.), en el mismo mes o en meses distintos.

**Modelo propuesto — relación muchos a muchos entre cuentas y eventos, con un rol por vínculo:**

- Una cuenta (usuario y contraseña) es una persona. Un evento puede tener uno o varios vínculos a cuentas, y cada vínculo tiene un rol.
- **Titular / contratante:** quien firmó el contrato. En un 15 años, la familia que contrata. En un egreso, el colegio o la comisión organizadora (no cada familia). Ve el evento completo.
- **Participante** (solo aplica a egresos): la familia/alumno vinculado a un egreso puntual. Ve el detalle de pagos de **su propio alumno** (tarjetas adulto/menor/brindis) y el avance compartido del mínimo de invitados del evento — no ve el detalle de pago de otras familias, por privacidad.
- El home del cliente (ya diseñado en el mockup original) no cambia de estructura: sigue siendo una lista de eventos por cuenta. Lo único que se agrega es una etiqueta de rol debajo de cada evento ("Titular del evento" / "Padre de Juan Pérez"), para que quede claro en qué carácter participa de cada uno.
- Esto ya resuelve el caso de "mismo usuario en 2 eventos": no hay conflicto porque el vínculo es independiente por evento; el mes o la fecha no importan, simplemente se acumulan en la lista.

## 3. ¿Quién crea la cuenta?

- **15 años:** el admin (Cami/Fede) da de alta el evento en el panel al firmar el contrato, y envía a la familia un link de invitación (WhatsApp) que abre la pantalla de "Crear cuenta" ya vinculada a ese evento. Se evita que alguien se registre "a ciegas" y quede sin vincular.
- **Egreso:** el admin carga el Excel de alumnos al crear el evento (nombre + valores de tarjeta, y teléfono de contacto si está disponible). El sistema genera un link de invitación individual por alumno. Ese link se comparte por WhatsApp (por el salón o por la comisión del colegio) y cuando la familia lo abre: si no tiene cuenta, la crea y queda vinculada como participante de ese alumno; si ya tiene cuenta (por ejemplo porque tiene otro evento con el salón), el evento simplemente se suma a su lista con el mismo login.
- **Fallback:** si una familia no tiene el link (dato de contacto faltante, error, etc.), el admin puede vincular manualmente un cliente existente a un alumno desde el panel, buscándolo por nombre o teléfono.

> **Actualización de la reunión con Cami y Fede (ver `03-reunion-cami-fede.md`):** en la práctica, en vez de un link de invitación por evento, decidieron algo más simple — el admin carga el email del titular al crear el evento, y el cliente ve automáticamente todos sus eventos asociados a ese email al registrarse. El link de invitación individual (arriba) queda como diseño alternativo/más seguro, no como lo que se va a construir primero.

## 4. Resuelto en la reunión siguiente
- Desglose de tarjetas: igual para los 4 tipos de evento.
- QR de invitados: individual por invitado, generado al confirmar asistencia.
- Ver `04-arquitectura-y-costos.md` para el detalle completo de las resoluciones.
