# Raphael Eventos — Landing page

*Entregada como `landing/landing.html` (autocontenida, sin dependencias externas salvo Google Fonts). Mismo estilo visual que la app (logo circular "R.", tipografía serif para títulos, negro/crema/dorado).*

## Contenido
Hero con slogan real ("Hacemos que tu evento sea inolvidable"), sección de servicios (15 años / Egresados / Bodas / Empresariales), sección "El espacio", teaser del portal de clientes con botón de login (modal demostrativo, sin backend), galería con placeholders, formulario de cotización que arma un mensaje y abre WhatsApp con el texto precargado, y footer con contacto.

## Datos usados
- Slogan: "Hacemos que tu evento sea inolvidable" (confirmado por el cliente).
- WhatsApp: 351 318-0810 → enlaces `wa.me/5493513180810` (confirmado por el cliente, se prefirió sobre el teléfono de directorios online).
- Instagram: https://www.instagram.com/raphael.eventos/ (confirmado).
- Fotos: placeholders elegantes (marcados como "Foto X") — no se pudo acceder al Instagram para traer fotos reales (bloqueado por robots.txt), y el cliente prefirió avanzar con placeholders por ahora.

## Pendiente para cuando se suba a producción
- Reemplazar los placeholders de foto por imágenes reales del salón (galería + fotos de cada tipo de evento).
- Confirmar y agregar la dirección física exacta (se encontró en directorios "Av. Rafael Núñez 5241, Argüello, Córdoba" pero no fue confirmada por el cliente, así que quedó fuera de la landing).
- El botón "Iniciar sesión" hoy abre un modal de demostración sin backend — conectar al login real del portal cuando esté desarrollado.
- El formulario de cotización hoy solo abre WhatsApp con el mensaje precargado (sin guardar nada) — cuando exista el CRM de la Fase 2 de la propuesta, conectar este formulario para que además cree la consulta en el panel del vendedor.

## Mockups v2 (carpeta `mockups/`)
`mockups-v2.html` / `mockups-v2.png` — 7 pantallas nuevas sobre la misma línea visual del mockup original del cliente: dashboard y calendario del rol Vendedor, alta de evento con carga de Excel, lista de alumnos con estado de invitación, pantalla de vinculación de cuenta a evento, home con etiqueta de rol por evento, y vista de egreso acotada a un solo alumno (privacidad). Sirven como referencia de UI/UX, no como especificación pixel-perfect.
