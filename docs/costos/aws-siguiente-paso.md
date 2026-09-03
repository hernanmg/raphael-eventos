## Siguiente paso de infraestructura: AWS (para escalar y mayor robustez)

*Sección para agregar a `arquitectura-y-costos.md`. Complementa el modelo Vercel + Supabase ya armado — no lo reemplaza: es la migración a considerar cuando el volumen, la necesidad de control fino (VPC, compliance, multi-región) o un cliente puntual lo justifiquen.*

### Arquitectura de referencia

En vez del stack "serverless/BaaS" (Vercel + Supabase), en AWS el equivalente "robusto" clásico es:

- **Cómputo:** ECS Fargate (contenedores sin administrar servidores) detrás de un **Application Load Balancer** — mínimo 2 tareas para no tener downtime en cada deploy y tolerar la caída de una.
- **Base de datos:** RDS para PostgreSQL. Single-AZ alcanza para arrancar; **Multi-AZ** (una réplica en otra zona, failover automático) es el upgrade recomendado cuando ya hay clientes pagando y no se puede tener el sistema caído.
- **Storage:** S3 (contratos, QR, adjuntos — igual que Supabase Storage/R2 hoy).
- **Emails transaccionales:** Amazon SES — mucho más barato que Resend a este volumen.
- **DNS:** Route 53.
- **Networking:** tareas de Fargate en subnets públicas con Security Groups (no NAT Gateway) para evitar un costo fijo extra de ~US$55-70/mes que no aporta nada a esta escala — se puede sumar más adelante si un cliente lo exige por seguridad.
- **WhatsApp Business API:** no cambia — es un servicio de Meta, independiente de qué nube lo hostee.

Alternativa más económica a esta escala, si "robusto" no exige contenedores dedicados: reemplazar Fargate + RDS por **Lambda + API Gateway + Aurora Serverless v2**, que sí escala a casi cero cuando no hay tráfico (más parecido en costo al modelo actual). Queda como nota — la tabla de abajo es para la arquitectura clásica con contenedores, que es la que normalmente se entiende por "más robusta y escalable".

### Región: São Paulo (sa-east-1) vs. Virginia (us-east-1)

Para usuarios en Argentina conviene `sa-east-1` (São Paulo) por latencia, pero **AWS cobra más caro en Sudamérica que en EE. UU.** No hay tabla pública de Fargate/RDS específica para `sa-east-1`; se estimó el sobreprecio comparando el mismo tipo de instancia EC2 en ambas regiones (`t4g.micro`: US$0.0084/h en us-east-1 vs. US$0.0134/h en sa-east-1 → **~60% más caro**) y se aplicó esa proporción a Fargate y RDS. Es una estimación razonable, no una tarifa oficial — conviene confirmar los números finales con la [AWS Pricing Calculator](https://calculator.aws) antes de comprometerse.

### Costo mensual estimado, por escenario (región São Paulo)

| Servicio | Escenario A — piloto (1 salón) | Escenario B — crecimiento (15 salones) | Escenario C — grupo completo (60 salones) |
|---|---|---|---|
| ECS Fargate (2-4 tareas, según escala) | ~US$58 | ~US$115 | ~US$231 |
| RDS PostgreSQL Single-AZ + storage gp3 | ~US$22 | ~US$47 | ~US$102 |
| Application Load Balancer | ~US$30 | ~US$36 | ~US$46 |
| S3 (storage + requests) | ~US$1 | ~US$2 | ~US$3 |
| Route 53 (hosted zone + queries) | ~US$1.5 | ~US$1.5 | ~US$2 |
| SES (emails transaccionales) | ~US$0.02 | ~US$0.30 | ~US$1.20 |
| WhatsApp Business API (Fase 2) | US$0 | US$0 | ~US$9.60 |
| Dominio | ~US$1.25 | ~US$1.25 | ~US$1.25 |
| CloudWatch (logs/monitoreo) | ~US$5 | ~US$8 | ~US$15 |
| **Total mensual** | **~US$119** | **~US$211** | **~US$411** |
| **Costo por salón / mes** | **~US$119** | **~US$14.1** | **~US$6.9** |

Sumar **Multi-AZ en RDS** (recomendado en producción con clientes reales pagando) agrega aproximadamente el costo de una segunda instancia + storage — en el Escenario C serían unos **+US$130/mes** (total ~US$540, ~US$9/salón).

### Cómo se compara con el modelo actual (Vercel + Supabase)

| Escenario | Vercel + Supabase | AWS (Fargate + RDS Single-AZ) | Diferencia |
|---|---|---|---|
| A — 1 salón | ~US$21 | ~US$119 | ~5.7x más caro |
| B — 15 salones | ~US$46 | ~US$211 | ~4.6x más caro |
| C — 60 salones | ~US$146 | ~US$411 | ~2.8x más caro |

La razón no es que AWS sea "peor" — es que el modelo actual (Vercel + Supabase) es serverless/consumo, así que a poca escala casi no cobra nada; el patrón clásico de AWS (contenedores + load balancer + base de datos dedicada, todo corriendo 24/7) tiene un piso fijo más alto, sin importar cuánto tráfico haya. Ese piso se diluye a medida que se suman salones, pero en esta comparación nunca deja de ser más caro que la alternativa serverless, incluso a los 60 salones.

### Cuándo tiene sentido dar este paso

- Cuando un cliente grande (o el propio grupo de 60 salones) pide garantías de infraestructura, aislamiento o compliance que Vercel/Supabase no ofrecen directamente.
- Cuando el volumen de tráfico o datos empieza a generar overages en Supabase/Vercel que se acercan al costo de tener infraestructura propia.
- Cuando se necesita control fino de red (VPC, IPs fijas, integraciones privadas con otros sistemas de un salón grande).

Hasta que aparezca una de esas razones concretas, el modelo Vercel + Supabase sigue siendo la opción más barata y con menos operación para el volumen actual.

### Fuentes consultadas (agosto 2026)
- Fargate: [aws.amazon.com/fargate/pricing](https://aws.amazon.com/fargate/pricing/) — tarifa oficial us-east-1.
- RDS PostgreSQL: [instances.vantage.sh/aws/rds/db.t4g.micro](https://instances.vantage.sh/aws/rds/db.t4g.micro) — tarifa us-east-1.
- Comparación regional (proxy sa-east-1): [aws-pricing.com/sa-east-1.html](https://aws-pricing.com/sa-east-1.html) — tarifas EC2 t4g por región, usadas para estimar el sobreprecio de São Paulo.
- SES, S3, ALB, Route 53: tarifas de lista conocidas de AWS (us-east-1), ajustadas con el mismo proxy regional.

*Nota: son precios de lista en dólares de agosto de 2026, y la estimación regional es una aproximación propia, no una tarifa oficial de Fargate/RDS para São Paulo. Igual que con el modelo anterior, conviene confirmar los números antes de tomarlos como cotización final.*
