# Raphael Eventos — Reunión con Cami y Fede (segunda ronda)

*Sigue a `01-propuesta-plataforma-digital.md` y `02-decisiones-roles-y-cuentas.md`. Versión completa en `reporte-reunion-cami-fede.docx`. Fecha de la reunión: agosto 2026.*

## Resumen
La reunión confirma el rumbo ya definido (alta de evento a cargo del salón, PWA, multi-evento por cliente, titular = quien paga, landing+portal en una sola web) y agrega precisión en varios puntos, más un pedido nuevo importante de Fede (costeo interno).

## Confirmaciones
Admin crea el evento al firmar contrato y carga al cliente (no hay autoregistro libre) · no es app nativa, es PWA anclada al inicio · un cliente puede tener 2+ eventos (validado por Cami: "mucha gente tiene más de dos eventos con nosotros") · la cuenta la crea el adulto que paga/firma · el copy de la landing ("la cuenta se crea cuando contratás") coincide con lo que describen.

## Novedades del portal cliente
- **Tipos de tarjeta también en 15 años/bodas:** no solo egresados — hay que generalizar el desglose (adulto/adolescente/menor) a los 4 tipos de evento (a nivel evento en 15/boda, a nivel alumno en egreso). **Resuelto:** igual para los 4 tipos, importante que se diferencien entre sí.
- **Alta de cuenta por email, no por link de invitación:** simplificación respecto a lo diseñado antes. El admin carga el email del titular al crear el evento; al registrarse con ese email, el cliente ve automáticamente todos sus eventos asociados. Válido para su escala; sugerido agregar una confirmación simple al registrarse para evitar mismatches.

## Rol invitado (nuevo detalle)
Tres niveles de acceso confirmados: administrativo, titular (padre que compra), invitado (limitado). El invitado busca el evento (link del titular), confirma asistencia y recibe un QR de entrada — no ve datos financieros. El titular administra altas/bajas de la lista de invitados. Ingreso después de las 12: entrada aparte, a resolver. Sin pagos asociados al QR (ver más abajo).

**Decisión pendiente → Resuelta:** QR individual por invitado (con confirmación de asistencia), no lote de QR — menor riesgo de falsificación.

## Fotos y playlist — alcance más simple para v1
En vez de mural colaborativo nativo: cada evento tiene su página, y el admin carga a mano el link externo que le pasa el fotógrafo contratado (Google Fotos, web propia, etc.). Playlist colaborativa: posiblemente vía Instagram, no nativa por ahora. Ninguna idea se descarta, solo se posponen como mejora futura.

## Decisión de alcance: sin pagos en la app
Confirmado explícitamente y por un motivo de fondo (no técnico): la facturación de Fede no puede blanquearse del todo, así que formalizar cobros por sistema rompería ese equilibrio. El panel admin no incluye pagos ni gastos (ya estaba en la propuesta original) — ahora se sabe que es definitivo.

## Módulo de costeo interno (nuevo, pedido fuerte de Fede)
Hoy lo lleva en Excel: insumos (por rubro: carnes, pescado, limpieza, etc.), gastos del salón, gastos de personal. Se actualiza cada 2-3 meses (el alquiler varía según cantidad de invitados: ej. $12.000/persona). Pide: importación del Excel tal cual lo arma (no reingreso manual), estructura configurable por salón (pensando en la venta a terceros), y tener en cuenta reglas de negocio existentes (cláusula de renegociación si un insumo sube >10%, tope de 30% de seña anticipada). Es exclusivo del panel admin — no se cruza con lo que ve Cami ni con el portal cliente. **Va en el plan Pro** (ver `04-arquitectura-y-costos.md`).

## Directorio de proveedores aliados (nuevo)
Espacio en landing + portal con proveedores recomendados (fotógrafo, decoración, sonido) por tipo de evento, formalizando el esquema informal que ya usan (referencia sin cobrar, con reciprocidad). Comisión de referencia sugerida ~10%, sección de sponsors como monetización adicional. **Resuelto:** arranca curado por Fede, con ABM/importación estándar para sumar más después.

## Modelo de negocio para vender la plataforma a otros salones (confirmado)
No hay competencia directa conocida. Plan: piloto interno en Raphael Eventos hasta fin de año, salida a la venta el año que viene (probablemente con alguien vendiendo puerta a puerta). Fede está en un grupo de ~60 salones — ese es el mercado inicial. Es un negocio paralelo — no debería sumarle complejidad al producto que usan día a día Cami y Fede. Ver `04-arquitectura-y-costos.md` para el modelo Básica/Pro y los costos reales.

## Preguntas abiertas → todas resueltas en `04-arquitectura-y-costos.md`
