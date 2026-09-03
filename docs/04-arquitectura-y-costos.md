# Raphael Eventos — Arquitectura multi-tenant, planes y costos

*Sigue a `reunion-cami-fede.md`. Resuelve las preguntas abiertas de esa reunión y fija el modelo de negocio (Básica/Pro) y la arquitectura multi-tenant. Modelo de costos completo en `costos-raphael-eventos.xlsx` entregado al usuario (todas las celdas de supuestos son editables).*

## Resolución de las preguntas abiertas
1. **Desglose de tarjetas:** igual para los cuatro tipos de evento (15 años, egresos, bodas, empresariales) — es importante que se puedan diferenciar entre sí, pero la estructura del componente es una sola.
2. **QR de invitados:** individual por invitado, generado a medida que confirman asistencia — decidido por menor riesgo de falsificación frente al lote de QR sin cuenta.
3. **Excel de costeo:** pendiente, Hernán se lo pide a Fede.
4. **Directorio de proveedores:** arranca curado por Fede (su lista actual de fotógrafo/decoración/sonido), con posibilidad de sumar más por ABM manual o importación estándar más adelante.
5. **Venta a otros salones:** es un negocio en sí mismo. Fede está en un grupo de ~60 salones — se aprovecha esa relación para robustecer el producto primero (piloto + feedback real) y después vender al resto del grupo.
6. **Fuente del valor de IPC (actualización, definida durante la propuesta de esquema de Claude Code):** deja de ser carga manual desde Excel. El sistema busca el valor automáticamente, en el momento de cada cálculo, contra la API oficial de datos.gob.ar (`https://apis.datos.gob.ar/series/api/series/?ids=145.3_INGNACUAL_DICI_M_38&limit=2&sort=desc`), tomando los últimos 2 valores de la serie para calcular la variación a aplicar. El índice aplicado se guarda con historial (fecha, valores tomados, índice resultante) — no se recalcula hacia atrás, solo queda registrado. Esto reemplaza la mención de "valores de IPC cargados a mano desde Excel" de `01-propuesta-plataforma-digital.md` (que describía cómo lo hacía Fede *antes* de la plataforma) y saca del panel admin la tarea de carga manual de IPC — el admin ya no tiene que tipear el valor cada mes.
   - Punto para la implementación (a definir con Claude Code, no cerrado todavía): una API de gobierno como paso obligado dentro de una pantalla que un cliente puede abrir en cualquier momento (su saldo) es un punto de falla nuevo. Conviene que el fetch tenga timeout corto + fallback al último índice guardado si la API no responde, en vez de bloquear la pantalla del cliente esperando a datos.gob.ar.

## Decisión de arquitectura: multi-tenant en la nube
Justificado por el tamaño de la oportunidad (grupo de ~60 salones de Fede). Se modela como una sola aplicación con `tenant_id` en cada tabla (esquema compartido), no una instancia separada por salón — es lo más barato y simple de operar a esta escala. Stack de referencia usado para los costos: Vercel (hosting/PWA) + Supabase (base de datos, auth, storage) + Meta WhatsApp Business API (recordatorios, Fase 2) + Resend (emails transaccionales).

**Actualización de auth (post-costeo):** se decidió no usar Supabase Auth — login y sesión son un módulo propio (`argon2` + `express-session`/`connect-pg-simple`), Supabase queda solo para Postgres y Storage. Detalle en la sección de login propio del prompt de Claude Code. Simplifica un poco el costeo (ya no aplica la parte de la planilla atada a MAU de Supabase Auth), no cambia el orden de magnitud de los números de la tabla de abajo.

## Modelo de negocio: Básica vs. Pro
- **Básica:** todo lo que usa el salón día a día — landing, portal cliente (eventos, saldo, tarjetas por tipo, IPC), multi-evento, calendario de disponibilidad, CRM de consultas, rol invitado con QR, directorio de proveedores, reportes de ocupación.
- **Pro:** todo lo de Básica + el módulo de costeo/stock que pidió Fede (importación de Excel, costo real por evento, reportes de margen, estructura configurable). Va del lado administrativo/dueños, no del cliente final.
- Precio propuesto (a validar con Fede y Cami, son supuestos editables en el Excel): Básica US$29/mes + US$300 de alta; Pro US$69/mes + US$600 de alta.

## Costos reales de infraestructura (fuentes con fecha en el Excel, pestaña "Fuentes")
| Escenario | Salones | Costo infra total/mes | Costo por salón/mes |
|---|---|---|---|
| A — piloto | 1 (Raphael Eventos) | ~US$21 | ~US$21 |
| B — crecimiento | 15 | ~US$46 | ~US$3.1 |
| C — grupo completo | 60 | ~US$146 | ~US$2.4 |

Con los precios propuestos, el margen bruto (sin contar el tiempo de soporte de Hernán) da ~89% en Básica y ~95% en Pro sobre el costo de infraestructura del Escenario B. La proyección de ingresos completa (por cantidad de salones activos) está en el Excel.

## Pendiente
- Conseguir el Excel real de costeo de Fede para dimensionar el módulo Pro.
- Validar las tarifas de WhatsApp Business API directamente en Meta Business Manager antes de comprometer precios (la fuente usada es de un agregador, no la tabla oficial de Meta).
- Confirmar con Fede y Cami los precios propuestos de Básica/Pro y los fees de alta.
- Definir con Claude Code la estrategia de fallback del fetch de IPC (timeout + último valor guardado) antes de que quede fijada en el esquema.

---

## Siguiente paso de infraestructura: AWS (para escalar y mayor robustez)

*Complementa el modelo Vercel + Supabase de arriba — no lo reemplaza: es la migración a considerar cuando el volumen, la necesidad de control fino (VPC, compliance, multi-región) o un cliente puntual lo justifiquen. Para la Fase 1 de desarrollo (ver `01-propuesta-plataforma-digital.md`), usar Vercel + Supabase.*

### Arquitectura de referencia
En vez del stack "serverless/BaaS" (Vercel + Supabase), en AWS el equivalente "robusto" clásico es: ECS Fargate (contenedores) detrás de un Application Load Balancer (mínimo 2 tareas) · RDS PostgreSQL (Single-AZ para arrancar, Multi-AZ cuando haya clientes reales pagando) · S3 para storage · SES para emails transaccionales · Route 53 para DNS · tareas de Fargate en subnets públicas con Security Groups (sin NAT Gateway, para evitar ~US$55-70/mes de costo fijo que no aporta nada a esta escala). El WhatsApp Business API no cambia — es de Meta, independiente de la nube. Alternativa más económica: Lambda + API Gateway + Aurora Serverless v2 (escala a casi cero sin tráfico, más parecido en costo al modelo actual).

### Costo mensual estimado (región São Paulo / sa-east-1)
| Escenario | Vercel + Supabase | AWS (Fargate + RDS Single-AZ) | Diferencia |
|---|---|---|---|
| A — 1 salón | ~US$21 | ~US$119 | ~5.7x más caro |
| B — 15 salones | ~US$46 | ~US$211 | ~4.6x más caro |
| C — 60 salones | ~US$146 | ~US$411 | ~2.8x más caro |

AWS no es "peor" — el modelo actual es serverless/consumo (casi gratis a poca escala); el patrón clásico de AWS tiene contenedores y base de datos corriendo 24/7, con un piso fijo más alto que nunca deja de ser más caro que la alternativa serverless en este rango, aunque el costo por salón mejora mucho con la escala (~US$6.9/salón a los 60 salones).

### Cuándo dar este paso
Cuando un cliente grande (o el grupo de 60 salones) pida garantías de infraestructura/compliance que Vercel/Supabase no ofrecen, cuando el volumen genere overages que se acerquen al costo de infraestructura propia, o cuando se necesite control fino de red. Hasta entonces, Vercel + Supabase sigue siendo la opción más barata y con menos operación.

*Precios de lista en USD, agosto 2026. La estimación regional para São Paulo es una aproximación (no hay tarifa oficial pública de Fargate/RDS para sa-east-1) — confirmar con la AWS Pricing Calculator antes de comprometerse. Detalle completo de fuentes en `costos/aws-siguiente-paso.md`.*
