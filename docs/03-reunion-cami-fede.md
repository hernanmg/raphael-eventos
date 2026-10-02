Sigue a propuesta-plataforma-digital.md, decisiones-roles-y-cuentas.md y landing-page.md. Versión completa en reporte-reunion-cami-fede.docx entregado al usuario. Fecha de la reunión: agosto 2026.

Resumen

La reunión confirma el rumbo ya definido (alta de evento a cargo del salón, PWA, multi-evento por cliente, titular = quien paga, landing+portal en una sola web) y agrega precisión en varios puntos, más un pedido nuevo importante de Fede (costeo interno).

Confirmaciones

Admin crea el evento al firmar contrato y carga al cliente (no hay autoregistro libre) · no es app nativa, es PWA anclada al inicio · un cliente puede tener 2+ eventos (validado por Cami: "mucha gente tiene más de dos eventos con nosotros") · la cuenta la crea el adulto que paga/firma · el copy de la landing ("la cuenta se crea cuando contratás") coincide con lo que describen.

Novedades del portal cliente
Tipos de tarjeta también en 15 años/bodas: no solo egresados — hay que generalizar el desglose (adulto/adolescente/menor) a los 4 tipos de evento (a nivel evento en 15/boda, a nivel alumno en egreso). Ambiguo en el audio si aplica igual a boda — confirmar.
Alta de cuenta por email, no por link de invitación: simplificación respecto a lo diseñado antes. El admin carga el email del titular al crear el evento; al registrarse con ese email, el cliente ve automáticamente todos sus eventos asociados. Válido para su escala; sugerido agregar una confirmación simple al registrarse para evitar mismatches.
Rol invitado (nuevo detalle)

Tres niveles de acceso confirmados: administrativo, titular (padre que compra), invitado (limitado). El invitado busca el evento (link del titular), confirma asistencia y recibe un QR de entrada — no ve datos financieros. El titular administra altas/bajas de la lista de invitados. Ingreso después de las 12: entrada aparte, a resolver. Sin pagos asociados al QR (ver más abajo).

Decisión pendiente: QR individual por invitado (con confirmación de asistencia — más fricción pero hace crecer la base de instalaciones que quieren como activo) vs. lote de QR entregado al titular (sin fricción, sin necesidad de cuenta por invitado). Recomendado: configurable por evento, con individual como default.

Fotos y playlist — alcance más simple para v1

En vez de mural colaborativo nativo: cada evento tiene su página, y el admin carga a mano el link externo que le pasa el fotógrafo contratado (Google Fotos, web propia, etc.). Playlist colaborativa: posiblemente vía Instagram, no nativa por ahora. Ninguna idea se descarta, solo se posponen como mejora futura.

Decisión de alcance: sin pagos en la app

Confirmado explícitamente y por un motivo de fondo (no técnico): la facturación de Fede no puede blanquearse del todo, así que formalizar cobros por sistema rompería ese equilibrio. El panel admin no incluye pagos ni gastos (ya estaba en la propuesta original) — ahora se sabe que es definitivo.

Módulo de costeo interno (nuevo, pedido fuerte de Fede)

Hoy lo lleva en Excel: insumos (por rubro: carnes, pescado, limpieza, etc.), gastos del salón, gastos de personal. Se actualiza cada 2-3 meses (el alquiler varía según cantidad de invitados: ej. $12.000/persona). Pide: importación del Excel tal cual lo arma (no reingreso manual), estructura configurable por salón (pensando en la venta a terceros), y tener en cuenta reglas de negocio existentes (cláusula de renegociación si un insumo sube >10%, tope de 30% de seña anticipada). Es exclusivo del panel admin — no se cruza con lo que ve Cami ni con el portal cliente.

Excel real recibido y analizado (raphael_eventos_costos.xlsx)

Confirma la estructura general de arriba y agrega el detalle real de rubros y de la fórmula de precio:

Rubros de insumos (recurrentes en las hojas mensuales Costo Mayo / Costo Sept / MARZ, una por mes, rehecha desde cero cada vez con la lista de ingredientes del menú): Verdulería, Pollo, Carnicería, Pescadería, Macro (supermercado mayorista), Panadería, Fiambre, Golosinas, Alcohol, Descartables/Limpieza, Repostería, Sushi, Lavandería — coincide con "por rubro: carnes, pescado, limpieza, etc." de la reunión, con más detalle del que se había documentado.
Gastos de servicio por evento: Mozos, Barra, Bacha, DJ, Fotógrafo, Seguridad, Pao (vendedor/comisión), Flecha, Baño, más personal nombrado individualmente (Adri, Miriam, Flor, Mili, Trini) cobrando por "producción + evento".
Gastos fijos de salón (hoja COSTOS, la más ordenada — funciona como plantilla): Luz, Gas, Alquiler, Piletero, Jardinero, Limpieza, Horas semanales, Comisiones, Lavandería, Canva, Meta (publicidad), Contador, Seguro — cada uno con su valor "por mes", prorrateado "por evento" y "cada 100 invitados". Confirma textualmente el mecanismo de alquiler variable por cantidad de invitados que ya estaba documentado.
Fórmula de precio de tarjeta, ahora explícita: costo neto del evento → se divide cada 100 invitados → se le aplica un margen de Ganancia (40%) más un colchón de Rotura (15%) más IVA (21%) → el resultado es el "Costo tarjeta", el valor que termina pagando cada invitado. Esta hoja (COSTOS) es un cálculo maestro reutilizable — a diferencia de las hojas mensuales de ingredientes, que se rehacen a mano cada vez.
Convención visual que ya usa Fede: celdas amarillas = valores que él carga a mano, celdas verdes = se calculan solas (hoja PRECIOS.). Vale la pena llevar esa misma distinción visual al panel admin (qué campos son input vs. cuáles son de solo lectura/calculados) para que la pantalla le resulte familiar.
Hallazgo nuevo, fuera de lo ya documentado — horas y comisiones de personal: hay una hoja aparte (HORAS SALON.) con calendarios mes a mes donde Fede registra horas trabajadas por dos personas (Pao, Adri) día por día y el pago mensual resultante, con notas de "comisiones adelantadas". Es una necesidad real de Fede que no estaba en el alcance de ningún documento anterior (ni Básica ni Pro la mencionan). Queda como pregunta abierta si esto debe sumarse al módulo Pro (llevaría el costeo un paso más allá de insumos/salón hacia nómina/comisiones del personal) o si queda deliberadamente afuera, en la misma línea que la decisión de "sin pagos en la app" — es dinero real hacia terceros, no de clientes, pero la lógica de fondo (formalización parcial) podría aplicar igual.
Advertencia técnica sobre "importar el Excel tal cual": las hojas mensuales de ingredientes no tienen una estructura estable — el orden de columnas cambia entre Costo Mayo y Costo Sept, hay celdas con texto donde debería haber un número (por ejemplo una cantidad cargada como fecha), unidades escritas de formas distintas mes a mes, filas vacías o corridas. Un importador genérico que lea "cualquier Excel que suba Fede" se va a romper seguido. Lo que sí es viable y fiel al pedido: replicar en el módulo Pro los rubros y la fórmula de precio identificados arriba, con una plantilla fija (columnas fijas: producto, presentación, cantidad, costo unitario) que Fede complete hacia adelante — este archivo sirve como referencia de qué rubros y qué cálculo tiene que soportar esa plantilla, no como el formato exacto a parsear de forma genérica.
Las reglas de negocio mencionadas en la reunión (renegociación si un insumo sube >10%, tope de 30% de seña) no aparecen como tal en ninguna hoja — son reglas verbales de Fede, no algo que hoy calcule el Excel. Quedan igual de pendientes de definir en el diseño del módulo Pro.
El archivo también tiene una hoja IPC con el valor mensual cargado a mano como texto libre (ej. "2,1% SEPTIEMBRE") — confirma que el reemplazo por la fetch automática a la API de datos.gob.ar (ver arquitectura-y-costos.md) elimina una tarea manual real y ya identificada como tal por el propio archivo de Fede.
Hay además una hoja NO OLVIDAR que es más una libreta de notas personal de Fede (comisiones a pagar por evento/cliente) que una tabla estructurada — no aporta estructura de datos reutilizable, se menciona solo para que quede registrado que se revisó.
Directorio de proveedores aliados (nuevo)

Espacio en landing + portal con proveedores recomendados (fotógrafo, decoración, sonido) por tipo de evento, formalizando el esquema informal que ya usan (referencia sin cobrar, con reciprocidad). Comisión de referencia sugerida ~10%, sección de sponsors como monetización adicional.

Modelo de negocio para vender la plataforma a otros salones (confirmado)

No hay competencia directa conocida. Plan: piloto interno en Raphael Eventos hasta fin de año, salida a la venta el año que viene (probablemente con alguien vendiendo puerta a puerta). Costo de infraestructura estimado ~USD 100/mes por instancia. Precio de venta todavía informal (~USD 1.500 + mantenimiento mensual a definir). La base de invitados que instalan la app (miles hacia fin de año) se piensa como activo para publicidad/sponsors a futuro. Es un negocio paralelo — no debería sumarle complejidad al producto que usan día a día Cami y Fede.

Preguntas abiertas

Desglose de tarjetas por tipo de evento (confirmar boda) · QR individual vs. lote (y si se decide por evento) · alcance inicial del directorio de proveedores · si la venta a otros salones es una fase de este desarrollo o un producto derivado aparte · si el registro de horas/comisiones de personal (hallado en el Excel real) entra al módulo Pro o queda fuera de alcance · reglas de renegociación de insumos (>10%) y tope de seña (30%) siguen sin estar definidas en ningún artefacto, solo mencionadas verbalmente.

Próximos pasos

Cerrar las preguntas abiertas antes de tocar el diseño de datos de tarjetas y del rol invitado · pedir el Excel de costeo (recibido y analizado, ver sección de arriba) · sumar a los mockups v2 la pantalla de "confirmar asistencia → QR" · mantener fotos/playlist simples (link externo) para no demorar el resto del desarrollo · definir con Fede la plantilla fija de carga de insumos para el módulo Pro, y si suma o no el registro de horas/comisiones de personal.