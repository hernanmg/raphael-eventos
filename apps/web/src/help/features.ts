// Esta lista ES la sección de Ayuda (/ayuda): cada vez que se termina una
// funcionalidad, se agrega acá con su propósito, cómo funciona, los pasos
// para usarla y un ejemplo concreto. No documentar features a medio hacer.
//
// El buscador mira solo título, propósito y keywords (no el texto largo:
// con "contraseña" matchearía media lista).

export type HelpGroup =
  'cliente' | 'publico' | 'eventos' | 'ventas' | 'costeo' | 'control' | 'puerta';

export const HELP_GROUPS: { id: HelpGroup; title: string; intro: string }[] = [
  {
    id: 'cliente',
    title: 'Para clientes',
    intro: 'Lo que ve quien contrató un evento (o la familia de un alumno) desde su portal.',
  },
  {
    id: 'publico',
    title: 'Landing e invitados',
    intro: 'Páginas públicas: no hace falta cuenta.',
  },
  {
    id: 'eventos',
    title: 'Panel del salón: eventos y cobros',
    intro: 'Solo para Fede, Cami y vendedores.',
  },
  {
    id: 'ventas',
    title: 'Panel del salón: ventas y proveedores',
    intro: 'Solo para Fede, Cami y vendedores.',
  },
  {
    id: 'costeo',
    title: 'Panel del salón: costeo y personal',
    intro: 'Solo para Fede, Cami y vendedores. Lo marcado "Plan Pro" requiere ese plan.',
  },
  {
    id: 'control',
    title: 'Panel del salón: reportes y control',
    intro: 'Solo para Fede, Cami y vendedores.',
  },
  {
    id: 'puerta',
    title: 'Personal de la puerta',
    intro: 'Para los empleados con acceso de puerta (y también el staff del salón).',
  },
];

export interface HelpFeature {
  id: string;
  group: HelpGroup;
  title: string;
  /** Resumen de una o dos oraciones: para qué sirve. */
  purpose: string;
  path: string;
  keywords?: string[];
  /** Cómo funciona por dentro, en criollo (párrafos). */
  details?: string[];
  /** Pasos para usarlo. */
  steps: string[];
  /** Un caso concreto, de punta a punta (párrafos/líneas). */
  example: string[];
}

export const helpFeatures: HelpFeature[] = [
  // ───────────────────────────── Clientes ─────────────────────────────
  {
    id: 'registro',
    group: 'cliente',
    title: 'Crear cuenta',
    purpose:
      'Te registrás con el mismo email que el salón cargó al crear tu evento y tus eventos quedan vinculados solos.',
    path: '/registro',
    keywords: ['registro', 'cuenta', 'alta', 'crear cuenta', 'email'],
    details: [
      'El salón no te manda una invitación: lo que te conecta con tu evento es el email. Cuando el salón carga el evento anota el email del titular (y, en un egreso, el de la familia de cada alumno). Al registrarte con ese mismo email, la plataforma encuentra tus eventos y te los vincula en el momento.',
      'Si te registrás con otro email (por ejemplo uno del trabajo), la cuenta se crea igual pero vacía. En ese caso pedile al salón que corrija el email del evento.',
    ],
    steps: [
      'Entrá a "Crear cuenta".',
      'Completá tu nombre y el email que le diste al salón.',
      'Elegí una clave y confirmá: entrás directo a "Mis eventos".',
    ],
    example: [
      'Laura contrató los 15 de su hija Martina y le dio al salón laura@gmail.com. Se registra con laura@gmail.com y al entrar ya ve "15 de Martina" con su saldo, sin hacer nada más.',
    ],
  },
  {
    id: 'login',
    group: 'cliente',
    title: 'Iniciar sesión',
    purpose: 'Accedé con tu email y contraseña para entrar a tu portal.',
    path: '/login',
    keywords: ['login', 'ingresar', 'iniciar sesion', 'contraseña', 'entrar'],
    details: [
      'Si el salón te generó una contraseña temporal (porque te olvidaste la tuya, o porque sos empleado o admin nuevo), al entrar con ella el sistema te pide elegir una propia antes de dejarte seguir.',
      'Después de varios intentos fallidos seguidos la cuenta se traba 15 minutos para frenar a quien quiera adivinar claves; se libera sola.',
    ],
    steps: [
      'Entrá a "Iniciar sesión".',
      'Poné tu email y tu contraseña.',
      'Según quién seas, te lleva a tu portal, al panel del salón o a la pantalla de la puerta.',
    ],
    example: [
      'Fede le generó a Laura una contraseña temporal desde el panel. Laura entra con ella, la app le pide una nueva, la elige y sigue a su portal. La temporal ya no sirve más.',
    ],
  },
  {
    id: 'mis-eventos',
    group: 'cliente',
    title: 'Mis eventos',
    purpose:
      'Lista de todos tus eventos contratados con el salón, con tu rol en cada uno (titular o participante) y el saldo pendiente de un vistazo.',
    path: '/portal',
    keywords: ['eventos', 'mis eventos', 'portal', 'lista'],
    details: [
      'Una misma persona puede tener varios eventos: por ejemplo, ser titular del casamiento de un hijo y participante del egreso de otro. Acá aparecen todos juntos.',
      '"Titular" es quien contrató el evento. "Participante" es la familia de un alumno en un egreso: ve solo lo de su alumno.',
    ],
    steps: [
      'Iniciá sesión: la lista aparece apenas entrás.',
      'Tocá un evento para ver el detalle de tarjetas, pagos e invitados.',
    ],
    example: [
      'Laura ve dos eventos: "15 de Martina" (titular, saldo $1.200.000, 45% abonado) y "Egresados Colegio X" (participante, por su hijo Tomás).',
    ],
  },
  {
    id: 'saldo-y-tarjetas',
    group: 'cliente',
    title: 'Saldo y tarjetas de un evento',
    purpose:
      'El detalle de tus tarjetas por tipo (adulto, adolescente, menor, brindis) con su valor actualizado por IPC, tus pagos y tu saldo pendiente.',
    path: '/portal',
    keywords: [
      'saldo',
      'tarjetas',
      'ipc',
      'inflacion',
      'pagos',
      'abonado',
      'adulto',
      'adolescente',
      'menor',
      'brindis',
    ],
    details: [
      'El precio de las tarjetas que todavía no pagaste se actualiza todos los meses con la inflación oficial (IPC del INDEC). Las tarjetas que ya pagaste quedan fijas al valor del día en que las pagaste: no suben más. Por eso conviene adelantar pagos.',
      'La columna "Pagas" muestra cuántas tarjetas de cada tipo ya están cubiertas, cuando el salón indicó a qué tarjetas corresponde cada pago.',
      'Si tu evento tiene un mínimo de invitados (por ejemplo 100) y todavía cargaste menos, aparece una fila "Faltan N para el mínimo": esas tarjetas se cobran a valor adulto. A medida que confirmás la cantidad real, la fila se achica.',
      'Si sos titular de un egreso (colegio o comisión), ves solo los totales del evento: lo que debe o pagó cada familia es privado.',
    ],
    steps: [
      'Entrá a "Mis eventos" y tocá el evento.',
      'Arriba ves total, abonado y saldo; abajo, la tabla de tarjetas y la lista de pagos.',
    ],
    example: [
      'Laura contrató 100 tarjetas de adulto a $20.000 en julio y en julio pagó 50 ($1.000.000). En agosto la inflación fue 1,66%: las 50 impagas pasan a $20.332 cada una.',
      'Las 50 pagas siguen valiendo $20.000. Su saldo pasó de $1.000.000 a 50 × $20.332 = $1.016.600.',
    ],
  },
  {
    id: 'portal-invitados',
    group: 'cliente',
    title: 'Invitados de tu evento',
    purpose:
      'Compartí tu link de invitación, mirá quién confirmó, cargá invitados vos mismo y da de baja a quien no va.',
    path: '/portal',
    keywords: ['invitados', 'rsvp', 'confirmar asistencia', 'link', 'qr', 'lista'],
    details: [
      'Tu evento tiene un link de invitación propio. Quien lo abre ve el micrositio del evento y confirma con su nombre, sin crear cuenta; al confirmar recibe su entrada con un QR.',
      'Las confirmaciones por link se cierran 2 días antes del evento. Después de eso, si alguien se suma a último momento, lo cargás vos desde acá (eso no tiene cierre).',
      'Si cargás a alguien como "entrada después de las 12", su entrada lo indica y la puerta lo ve.',
      'En un egreso, cada familia tiene su propio link y maneja la lista de su alumno.',
    ],
    steps: [
      'Entrá al evento desde "Mis eventos" y bajá hasta "Invitados".',
      'Compartí el link: copialo, mandalo por WhatsApp o mostrá el QR.',
      'Para cargar a alguien a mano, completá su nombre y confirmá: le queda su entrada para que se la reenvíes.',
      'Para dar de baja a alguien, tocá "Dar de baja": su QR deja de servir en la puerta.',
    ],
    example: [
      'Laura manda el link al grupo de la familia: 80 personas confirman solas. La tía Ana avisa el día anterior que va: el link ya está cerrado, así que Laura la carga a mano y le reenvía la entrada por WhatsApp.',
    ],
  },
  {
    id: 'portal-proveedores',
    group: 'cliente',
    title: 'Proveedores recomendados',
    purpose:
      'En tu portal ves los proveedores de confianza del salón para el tipo de evento que contrataste.',
    path: '/portal',
    keywords: ['proveedores', 'recomendados', 'fotografo', 'decoracion'],
    steps: [
      'Entrá a tu portal: la sección aparece debajo de tus eventos si hay proveedores cargados.',
    ],
    example: [
      'Laura contrató un 15: ve el fotógrafo, la decoradora y el DJ que el salón recomienda para 15 años, con su WhatsApp para contactarlos.',
    ],
  },

  // ─────────────────────────── Landing / invitados ───────────────────────────
  {
    id: 'cotizar',
    group: 'publico',
    title: 'Cotizar un evento',
    purpose:
      'Formulario de la landing para pedir una cotización: abre WhatsApp con el mensaje armado y queda cargado como consulta en el CRM del salón.',
    path: '/',
    keywords: ['cotizar', 'consulta', 'presupuesto', 'landing'],
    steps: [
      'En la landing, completá el formulario de cotización (tipo de evento, fecha tentativa, cantidad de invitados, contacto).',
      'Al enviar se abre WhatsApp con el mensaje listo para mandar al salón.',
    ],
    example: [
      'Una mamá pide presupuesto para un 15 el 20 de marzo con 120 invitados. Le escribe al salón por WhatsApp y, aunque no mande el mensaje, Cami ya la ve en "Consultas" como nueva y el 20 de marzo aparece en el calendario como fecha tentativa.',
    ],
  },
  {
    id: 'micrositio-invitados',
    group: 'publico',
    title: 'Micrositio y entrada con QR (para invitados)',
    purpose:
      'El invitado abre el link, ve la cuenta regresiva, el lugar y las fotos, confirma con su nombre y recibe su entrada con QR.',
    path: '/portal',
    keywords: ['micrositio', 'invitacion', 'qr', 'entrada', 'cuenta regresiva', 'confirmar'],
    details: [
      'La entrada tiene un QR y un código corto de 6 caracteres. En la puerta escanean el QR; si la cámara no lo lee, buscan por el código o por el nombre.',
      'Conviene guardar el link de la entrada (o una captura): es lo que se muestra al llegar.',
    ],
    steps: [
      'Abrí el link que te pasó quien te invitó.',
      'Poné tu nombre y confirmá.',
      'Guardá tu entrada y mostrala en la puerta el día del evento.',
    ],
    example: [
      'Juan recibe el link de los 15 de Martina, ve que faltan 12 días, confirma y le aparece su entrada con el código "K7P2QX". La noche del evento muestra el QR desde el celular y entra en un segundo.',
    ],
  },

  // ─────────────────────────── Panel: eventos y cobros ───────────────────────────
  {
    id: 'admin-dashboard',
    group: 'eventos',
    title: 'Panel admin: dashboard',
    purpose:
      'Total de eventos por tipo y los próximos eventos, de un vistazo, con todas las secciones del panel agrupadas por área.',
    path: '/admin',
    keywords: ['admin', 'dashboard', 'panel', 'eventos totales', 'menú', 'secciones'],
    details: [
      'Las tarjetas de arriba (total, 15 años, egresados, bodas, empresariales) son filtros: al tocar una, la lista muestra todos los eventos de ese tipo, incluidos los pasados.',
      'En la computadora, debajo de los eventos están todas las secciones como tarjetas, agrupadas en Operación, Comercial, Finanzas, Equipo y red y Sistema. Algunas muestran un dato al día, como las consultas nuevas o si el IPC está actualizado.',
      'Dentro de cada sección, arriba aparece dónde estás (por ejemplo "Inicio › Finanzas › Gastos") y pestañas para saltar a las otras secciones del mismo grupo sin volver al inicio.',
      'En el celular, el inicio muestra lo pendiente de cobrar de los eventos del año, las consultas nuevas, el estado del IPC y la ocupación por mes. Abajo hay una barra fija con Inicio, Calendario, el botón dorado para cargar un evento, Consultas y "Más", que abre el resto de las secciones, la Ayuda, tu portal y Salir.',
      'Si el IPC del mes no se pudo actualizar solo, aparece un aviso acá arriba.',
    ],
    steps: [
      'Entrá a "Panel admin".',
      'Tocá una tarjeta de tipo para filtrar, o un evento para abrir su detalle.',
      'Para ir a otra sección, tocá su tarjeta (computadora) o usá la barra de abajo y "Más" (celular).',
    ],
    example: [
      'Fede toca "Egresados" y ve los 6 egresos del año, incluido el de marzo que ya pasó, para revisar cuál quedó con saldo.',
      'Desde el celular, Cami ve el punto dorado en "Consultas", entra y responde las 2 consultas nuevas. Después toca "Más" → "Gastos" para cargar un ticket.',
    ],
  },
  {
    id: 'admin-alta-evento',
    group: 'eventos',
    title: 'Cargar un evento nuevo',
    purpose:
      'Da de alta un evento con su titular, las tarjetas y, si es un egreso, la lista de alumnos. El email vincula el evento a la cuenta del cliente.',
    path: '/admin/eventos/nuevo',
    keywords: [
      'admin',
      'alta',
      'crear evento',
      'cargar evento',
      'titular',
      'egreso',
      'alumnos',
      'excel',
    ],
    details: [
      'El valor de las tarjetas que cargues queda tomado como "valor de este mes": desde ahí se actualiza solo con el IPC de cada mes siguiente.',
      'Todo evento tiene tarjetas de adulto, adolescente y menor, aunque las dejes en 0: se completan después desde el detalle con "Ajustar". Si falta otro tipo (por ejemplo brindis), en el detalle está "+ Agregar tipo de tarjeta".',
      'La cantidad de cada tarjeta es opcional: al firmar casi nunca saben cuántos invitados van a ser. Cargá solo el valor y dejá la cantidad en 0: sube sola cada vez que registrás un pago que cubre tarjetas.',
      'El mínimo de invitados (100 por defecto) aplica a todos los tipos. En 15, bodas y empresariales, si las tarjetas cargadas (adultos, adolescentes y menores; el brindis no cuenta) no llegan al mínimo, lo que falta se cobra a valor adulto. En un egreso es solo informativo.',
      'El email del titular es clave: si el cliente ya tiene cuenta, el evento aparece en su portal al instante; si no, en cuanto se registre con ese email.',
      'En un egreso se carga un alumno por familia (con el email de contacto de esa familia). Los alumnos se pueden cargar a mano o importar desde Excel con la plantilla que se descarga ahí mismo.',
      '"Vendido por" indica qué empleado cerró la venta: si tiene comisión por venta, se genera sola como gasto del evento y entra en su liquidación del mes de la venta.',
    ],
    steps: [
      'Entrá a "Panel admin" → "Cargar evento".',
      'Elegí el tipo, poné el nombre y la fecha.',
      'Completá los datos del titular (nombre, email, teléfono).',
      'Revisá el mínimo de invitados (viene en 100).',
      'Cargá el valor de cada tarjeta. La cantidad, si ya la saben; si no, dejala en 0.',
      'Si es egreso: cargá los alumnos (o "Importar desde Excel").',
      'Opcional: elegí quién lo vendió y la fecha de venta.',
      'Tocá "Cargar evento".',
    ],
    example: [
      'Cami carga "15 de Martina", 12/12/2026, titular Laura Pérez (laura@gmail.com), mínimo 100, adulto a $20.000 y menor a $12.000, sin cantidades todavía, vendido por Pao.',
      'Resultado: total $2.000.000 (los 100 del mínimo a valor adulto). Laura ya tenía cuenta, así que lo ve en su portal en el momento. A Pao se le genera la comisión en el costeo del evento.',
    ],
  },
  {
    id: 'admin-editar-evento',
    group: 'eventos',
    title: 'Editar evento y ajustar tarjetas',
    purpose:
      'Editá nombre, fecha, titular y estado de un evento, y ajustá tarjetas con un motivo que queda registrado.',
    path: '/admin',
    keywords: [
      'editar',
      'titular',
      'ajuste',
      'renegociacion',
      'tarjetas',
      'finalizado',
      'agregar tipo de tarjeta',
      'menores',
    ],
    details: [
      'Estados: "Activo" es lo normal. "Finalizado" es un evento que ya pasó (sigue ocupando su fecha en el calendario). Para dar de baja un evento se usa el botón "Cancelar evento" (ver "Cancelar un evento"); desde acá solo se puede reactivar uno cancelado.',
      'Si cambiás el email del titular, el titular anterior deja de ver el evento y el nuevo lo ve (si ya tiene cuenta, al instante).',
      'Ajustar una tarjeta es distinto del IPC: es un cambio de precio o cantidad acordado con el cliente (una renegociación). El valor que pongas rige desde este mes y sigue actualizándose por IPC desde ahí. El motivo es obligatorio y queda en el historial.',
      'Si al evento le falta un tipo de tarjeta (por ejemplo brindis, o menores en un evento cargado antes), tocá "+ Agregar tipo de tarjeta" debajo de las tarjetas. Cantidad y valor pueden quedar en 0. En un egreso se agrega a todos los alumnos que no lo tengan.',
      'No se puede bajar la cantidad por debajo de las tarjetas que ya están marcadas como pagas. Ajustar el valor no cambia las tarjetas ya pagas: quedan al valor al que se pagaron.',
    ],
    steps: [
      'Abrí el evento desde el panel.',
      'Para editar datos: usá la sección de edición, cambiá lo que haga falta y guardá.',
      'Para sumar un tipo que falta: tocá "+ Agregar tipo de tarjeta", elegí el tipo, la cantidad y el valor (opcionales) y tocá "Agregar".',
      'Para ajustar una tarjeta: tocá "Ajustar" en su fila, poné la cantidad y el "valor vigente desde hoy", escribí el motivo y tocá "Guardar ajuste".',
    ],
    example: [
      'Laura pide sumar 10 adultos y Fede le hace precio: en la fila de adultos toca "Ajustar", pasa de 100 a 110, deja el valor en $20.332 y escribe "Suma 10 adultos, acordado con Laura por WhatsApp". El saldo se recalcula y el cambio queda en el historial del evento con el nombre de Fede.',
    ],
  },
  {
    id: 'admin-pagos',
    group: 'eventos',
    title: 'Registrar un pago',
    purpose:
      'Registrá cada pago cobrado en persona (efectivo o transferencia) con monto, fecha y nota, y opcionalmente qué tarjetas cubre.',
    path: '/admin/eventos',
    keywords: [
      'pago',
      'cobro',
      'abono',
      'seña',
      'efectivo',
      'transferencia',
      'asignacion',
      'congelada',
    ],
    details: [
      'La plataforma no cobra: registra lo que ya cobraron. El saldo se calcula solo a partir de las tarjetas (con IPC) menos los pagos.',
      'Indicar qué tarjetas cubre un pago es opcional, pero conviene: cada tarjeta marcada queda fija al valor de hoy y deja de subir con el IPC. Un pago sin marcar tarjetas baja el saldo en $, pero todas las tarjetas siguen actualizándose.',
      'Si marcás más tarjetas de las que tiene cargadas el evento (por ejemplo, la cantidad estaba en 0 porque al firmar no la sabían), la cantidad sube sola y queda registrado en el historial.',
      'Si un pago supera el tope de seña (30% del total, configurable), la app avisa pero deja registrarlo igual.',
      'Borrar un pago ("Quitar") queda registrado en la auditoría con el monto borrado.',
    ],
    steps: [
      'Abrí el evento y buscá la familia o el titular.',
      'En "Pagos" completá monto, fecha y nota.',
      'Opcional: activá "¿Este pago cubre tarjetas puntuales?" y poné cuántas de cada tipo.',
      'Tocá "Registrar pago".',
    ],
    example: [
      'La familia de Tomás (egreso) paga $60.000 en efectivo por 2 adultos y 1 menor. Cami registra $60.000, marca "2 Adulto" y "1 Menor": la columna "Pagas" de esa familia pasa a "2 / 5" y "1 / 2", y su saldo baja $60.000. Esas 3 tarjetas ya no suben con la inflación.',
      'En los 15 de Martina las cantidades estaban en 0. Laura paga 40 adultos: Cami los marca y la cantidad de adultos pasa sola de 0 a 40.',
    ],
  },
  {
    id: 'admin-historial-tarjeta',
    group: 'eventos',
    title: 'Historial de una tarjeta',
    purpose:
      'Tocá "Pagas" (ej. 18 / 40) en la tabla de tarjetas de un evento para ver qué pagos cubren esas 18, a qué valor quedó cada una y cómo cambió el valor mes a mes.',
    path: '/admin',
    keywords: ['historial', 'pagas', 'valor', 'cuota', 'tarjeta', 'evolucion', 'ipc'],
    details: [
      'La parte de pagos lista cada pago que marcó tarjetas de ese tipo: fecha, cantidad, valor fijo por tarjeta y monto del pago.',
      'La evolución muestra el valor al cargar el evento, el de cada mes con su IPC y los ajustes manuales con su motivo.',
      'Arriba de la tabla de tarjetas ves con qué IPC están actualizadas y cuándo será la próxima actualización (el INDEC publica alrededor del 15 de cada mes).',
    ],
    steps: [
      'Abrí el evento desde el panel.',
      'En la tabla de tarjetas, tocá el número de la columna "Pagas".',
      'Tocá "Cerrar" para ocultarlo.',
    ],
    example: [
      'Adultos muestra "18 / 40". Fede toca y ve: 10 pagadas el 5/8 a $20.000 y 8 pagadas el 3/10 a $20.700. Las 22 que faltan valen hoy $20.950 cada una.',
    ],
  },
  {
    id: 'admin-cancelar-evento',
    group: 'eventos',
    title: 'Cancelar un evento',
    purpose:
      'Da de baja un evento cuando el cliente cancela, con el motivo y, si se le devuelve algo, el monto devuelto.',
    path: '/admin',
    keywords: ['cancelar', 'baja', 'devolucion', 'reintegro', 'seña'],
    details: [
      'Un evento cancelado sale del calendario, de los reportes, de los recordatorios, del micrositio y de la puerta, y se le quita la comisión de venta.',
      'Los pagos quedan registrados como historial. La devolución es opcional (la seña no se devuelve): si se devuelve algo, se resta de la cobranza del mes de la baja en Reportes.',
      'No se puede devolver más de lo cobrado. Si fue un error, el evento se puede reactivar desde "Editar evento" → Estado.',
    ],
    steps: [
      'Abrí el evento desde el panel.',
      'Tocá "Cancelar evento".',
      'Escribí el motivo y, si corresponde, el monto devuelto.',
      'Tocá "Confirmar baja".',
    ],
    example: [
      'Un cliente llama para cancelar su boda. Había pagado $500.000 de seña más $300.000 de cuotas, y se acuerda devolverle las cuotas. Fede cancela con motivo "Cancelación del cliente por teléfono" y devolución $300.000: el evento muestra "Cobrado $800.000 · Devuelto $300.000 · Quedó para el salón $500.000".',
    ],
  },
  {
    id: 'admin-reporte-pagos',
    group: 'eventos',
    title: 'Reporte de pagos para un cliente',
    purpose:
      'Vista imprimible del detalle de tarjetas y pagos de una familia o evento, para cuando un cliente pide el detalle.',
    path: '/admin/eventos',
    keywords: ['reporte', 'imprimir', 'pdf', 'detalle de pagos'],
    details: [
      'En el portal, el titular de un egreso no ve lo de cada familia (es privado). Si una familia o el colegio piden un detalle, lo generás desde acá y lo compartís vos.',
    ],
    steps: [
      'Abrí el evento y, en la familia que corresponda, tocá "Ver reporte".',
      'Tocá "Imprimir / Guardar PDF" y elegí "Guardar como PDF".',
      'Mandá el PDF por WhatsApp o email.',
    ],
    example: [
      'La mamá de Tomás pregunta cuánto le falta y qué pagó. Cami abre su reporte, lo guarda como PDF y se lo manda por WhatsApp.',
    ],
  },
  {
    id: 'admin-ipc',
    group: 'eventos',
    title: 'Estado del IPC',
    purpose:
      'La inflación de cada mes (IPC del INDEC) que actualiza el valor de las tarjetas, con el acumulado del año y un gráfico de los últimos 12 meses. Llega sola; si no llega, se carga a mano.',
    path: '/admin/ipc',
    keywords: [
      'admin',
      'ipc',
      'inflacion',
      'variacion mensual',
      'acumulado',
      'indice',
      'datos.gob.ar',
      'actualizacion',
    ],
    details: [
      'Arriba ves la inflación del último mes publicado (ej. agosto 2026: +1,66%), el acumulado en lo que va del año y el de los últimos 12 meses. Debajo, un gráfico con la variación de cada mes y el historial completo.',
      'Cada tarjeta guarda su valor y el mes en que se cargó. Todos los meses posteriores se le suma la inflación de ese mes, una sobre la otra: lo que ya se pagó no cambia, sube lo que falta pagar.',
      'Todos los días a las 8:00 la app consulta datos.gob.ar. El INDEC publica alrededor del 14 de cada mes, así que el dato suele entrar el 15. Si el día 16 todavía no entró, aparece un aviso acá y en el dashboard. Mientras tanto las tarjetas siguen con el último mes cargado: nada se rompe.',
      'Al corregir o borrar un mes cargado a mano se recalculan solos los meses siguientes y el valor de las tarjetas impagas. Las tarjetas ya pagas no cambian.',
      'Para hacer la cuenta la app encadena las variaciones en un índice interno que arrancó en 100. Si alguna vez hace falta explicar un valor a mano, está en "Ver índice técnico", al final de la pantalla.',
    ],
    steps: [
      'Entrá a "Panel admin" → "Estado del IPC" para ver la inflación del último mes, el acumulado y el historial.',
      'Solo si aparece el aviso: buscá en el INDEC el % de variación del mes que falta.',
      'En "Cargar un mes a mano" elegí cualquier día de ese mes, poné el % y tocá "Cargar mes".',
      'Si te equivocaste: en el historial, tocá "Corregir" en ese mes, cambiá el % y guardá, o tocá "Borrar mes". Solo se pueden corregir los meses cargados a mano.',
    ],
    example: [
      'Una tarjeta de $50.000 cargada en julio 2026. Agosto da +1,66%: pasa a valer 50.000 × 1,0166 = $50.830. Si septiembre da +2%: 50.830 × 1,02 = $51.847.',
      'Una tarjeta cargada en agosto no cambia con el dato de agosto: se ajusta recién con septiembre.',
      'Carga a mano: si el 16 de octubre sigue el aviso, Fede elige un día de septiembre 2026, pone el % que publicó el INDEC (ej. 2) y guarda. Si en vez de 2 puso 20, toca "Corregir" en septiembre y lo cambia a 2.',
    ],
  },
  {
    id: 'contratos',
    group: 'eventos',
    title: 'Contrato digital',
    purpose:
      'Subí el PDF del contrato ya firmado al evento; el cliente lo ve y lo descarga desde su portal.',
    path: '/admin/eventos',
    keywords: ['contrato', 'pdf', 'firma', 'adjunto'],
    details: [
      'Es un adjunto: la firma se hace por fuera (en papel o con otra herramienta). Hay un contrato por evento; subir otro reemplaza al anterior. Máximo 10 MB.',
    ],
    steps: [
      'Escaneá o exportá el contrato firmado como PDF.',
      'Abrí el evento, en "Contrato" elegí el archivo y subilo.',
    ],
    example: [
      'Laura firmó el contrato en papel. Cami lo escanea y lo sube; Laura ve "Ver contrato" en su portal y lo descarga cuando quiera.',
    ],
  },
  {
    id: 'admin-invitados',
    group: 'eventos',
    title: 'Invitados y micrositio (panel)',
    purpose:
      'Hora de inicio y fotos del micrositio, links de invitación por familia, avance de confirmados y alta/baja de invitados.',
    path: '/admin',
    keywords: ['invitados', 'micrositio', 'fotos', 'link', 'minimo', 'confirmados', 'exportar'],
    details: [
      'El avance compara los confirmados contra el mínimo contratado (egresos) o contra la cantidad de tarjetas (resto).',
      'La hora de inicio alimenta la cuenta regresiva del micrositio; el link de fotos lo pasa el fotógrafo después del evento.',
      'La lista de invitados se puede exportar a Excel o CSV.',
    ],
    steps: [
      'Abrí el evento y bajá a "Invitados y micrositio".',
      'Cargá la hora de inicio y guardá.',
      'Copiá el link de invitación de cada familia para pasárselo, o cargá invitados a mano.',
    ],
    example: [
      'Para el egreso del Colegio X, Fede carga hora 21:30 y copia el link de la familia de Tomás para mandárselo. Faltando una semana ve "312 de 350 confirmados" y avisa al colegio.',
    ],
  },
  {
    id: 'admin-clientes',
    group: 'eventos',
    title: 'Clientes',
    purpose: 'Todos los eventos de un mismo cliente y el saldo de cada uno en un solo lugar.',
    path: '/admin/clientes',
    keywords: ['cliente', 'clientes', 'cuenta', 'buscar cliente'],
    steps: [
      'Entrá a "Clientes" y buscá por nombre o email.',
      'Abrí la ficha: ves sus eventos con saldo; tocá uno para ir al detalle.',
    ],
    example: [
      'Laura llama para preguntar por sus dos eventos. Cami la busca por "laura", ve el 15 de Martina y el egreso de Tomás con sus saldos y le responde en el momento.',
    ],
  },
  {
    id: 'admin-reset-cliente',
    group: 'eventos',
    title: 'Contraseña temporal para un cliente',
    purpose:
      'Si un cliente no puede entrar, le generás una contraseña temporal desde su ficha y al entrar elige una propia.',
    path: '/admin/clientes',
    keywords: ['contraseña', 'olvidé', 'reset', 'cliente', 'acceso'],
    details: [
      'La temporal se muestra una sola vez: copiala o mandala con "Enviar por email" antes de cerrar. La anterior del cliente deja de funcionar.',
    ],
    steps: [
      'En "Clientes", abrí la ficha del cliente.',
      'Tocá "Generar contraseña temporal".',
      'Copiala o tocá "Enviar por email" y después "Listo, ocultar".',
    ],
    example: [
      'Laura se olvidó la clave. Cami genera una temporal, se la manda por WhatsApp, Laura entra y elige una nueva.',
    ],
  },

  // ─────────────────────────── Panel: ventas ───────────────────────────
  {
    id: 'admin-consultas',
    group: 'ventas',
    title: 'Consultas (CRM)',
    purpose:
      'Las consultas que llegan del formulario de cotización, con su estado (nuevo, contactado, con seña, ganado, perdido) y notas.',
    path: '/admin/consultas',
    keywords: ['crm', 'consultas', 'leads', 'cotizacion', 'ventas'],
    details: [
      'Las consultas nuevas, contactadas y con seña marcan su fecha como tentativa en el calendario. Las ganadas o perdidas dejan de marcarla.',
      'Ganar una consulta no crea el evento solo: el evento se carga por "Cargar evento" como siempre.',
    ],
    steps: [
      'Entrá a "Consultas" y filtrá por estado.',
      'Cambiá el estado a medida que avanza y anotá lo hablado en las notas.',
      'Cuando cierra, cargá el evento y marcá la consulta como ganada.',
    ],
    example: [
      'Llega la consulta del 15 del 20 de marzo. Cami la llama (pasa a "Contactado", nota: "quiere menú con sushi"). La familia deja seña (pasa a "Con seña"): el 20 de marzo ya figura tentativo en el calendario para que nadie lo ofrezca.',
    ],
  },
  {
    id: 'admin-calendario',
    group: 'ventas',
    title: 'Calendario de disponibilidad',
    purpose:
      'Vista mensual con los eventos confirmados y las fechas tentativas de consultas, para no comprometer una fecha dos veces.',
    path: '/admin/calendario',
    keywords: ['calendario', 'disponibilidad', 'fechas', 'agenda'],
    details: [
      'Sólido = evento confirmado (tocalo para abrirlo). Punteado = consulta con fecha tentativa (te lleva a Consultas). Los eventos cancelados no aparecen.',
    ],
    steps: ['Entrá a "Calendario" y movete entre meses con las flechas.'],
    example: [
      'Un cliente pregunta por el sábado 20 de marzo. Fede ve que está punteado (consulta con seña) y le ofrece el 27, que está libre.',
    ],
  },
  {
    id: 'admin-recordatorios',
    group: 'ventas',
    title: 'Recordatorios automáticos',
    purpose:
      'Configura cada cuánto recordarle el saldo pendiente a cada familia y muestra el registro de cada recordatorio.',
    path: '/admin/recordatorios',
    keywords: ['recordatorios', 'whatsapp', 'saldo pendiente', 'cobranza'],
    details: [
      'Todos los días a las 9:00 la app revisa quién tiene saldo pendiente y, según la configuración, le corresponde un recordatorio: cada N días, y uno de urgencia si faltan pocos días para el evento.',
      'Hoy WhatsApp Business no está conectado, así que los mensajes no salen solos: el registro muestra a quién le tocaba y el texto armado, para que lo mandes a mano. Si falta el teléfono, figura como omitido con el motivo.',
    ],
    steps: [
      'Entrá a "Recordatorios", habilitalos y poné cada cuántos días recordar y cuántos días antes del evento insistir.',
      'Tocá "Guardar". Si querés correrlo en el momento, tocá "Enviar ahora".',
      'Revisá el registro y mandá a mano los mensajes que correspondan.',
    ],
    example: [
      'Con "cada 15 días" y "10 días antes": la familia de Tomás debe $80.000 y el egreso es en 9 días. El registro muestra el mensaje "Hola, te recordamos que el saldo de Tomás es $80.000…" listo para copiar y mandar.',
    ],
  },
  {
    id: 'admin-proveedores',
    group: 'ventas',
    title: 'Proveedores y sponsors',
    purpose:
      'Proveedores con su rubro de costeo y contacto: los del directorio se muestran en la landing y el portal; los de compras se usan solo en gastos. Más los sponsors de la landing.',
    path: '/admin/proveedores',
    keywords: [
      'proveedores',
      'fotografo',
      'decoracion',
      'sonido',
      'sponsors',
      'directorio',
      'compras',
    ],
    details: [
      'El rubro es el mismo de costeo: así, al cargar un gasto, al elegir el rubro aparecen primero sus proveedores.',
      '"Mostrar en el directorio público" decide si el proveedor aparece en la landing y en el portal (filtrado por tipo de evento). Un proveedor de compras (Macro, Kristal) lo dejás sin marcar.',
      'La comisión de referencia y la nota interna son solo para ustedes: nunca se muestran al público.',
    ],
    steps: [
      'Entrá a "Proveedores", completá nombre y rubro.',
      'Si es para recomendar: marcá "Mostrar en el directorio público" y elegí los tipos de evento.',
      'Guardá. Para sponsors: subí el logo (PNG/JPG/WEBP) y su link.',
    ],
    example: [
      'Fede carga "Foto Lucas", rubro Fotógrafo, visible para 15 y bodas, comisión ref. 10%: aparece en la landing y en el portal de Laura. Carga "Macro", rubro Macro, sin marcar el directorio: solo lo ve al cargar gastos.',
    ],
  },

  // ─────────────────────────── Panel: costeo y personal ───────────────────────────
  {
    id: 'admin-costeo',
    group: 'costeo',
    title: 'Configuración de costeo (Plan Pro)',
    purpose:
      'Porcentajes de ganancia, rotura e IVA, impuestos bancarios, avisos, y los rubros de insumos, servicios y gastos fijos del salón.',
    path: '/admin/costeo/config',
    keywords: [
      'costeo',
      'costos',
      'ganancia',
      'rotura',
      'iva',
      'impuestos',
      'rubros',
      'gastos fijos',
      'pro',
    ],
    details: [
      'Ganancia, rotura e IVA se suman, igual que en el Excel: 40% + 15% + 21% = el costo se multiplica por 1,76.',
      'Impuestos bancarios: créditos y débitos (0,06% cada uno) se aplican sobre el costo del evento, más el monto de transferencia una vez por evento. Con 0 no se aplican.',
      'Rubros: insumos (Verdulería, Carnicería…), servicios (Mozos, DJ…) y gastos fijos del salón (Luz, Alquiler…). Cada gasto fijo tiene un estimado mensual: se usa mientras no cargues el gasto real de ese mes.',
      'Avisos (nunca bloquean): renegociación si un producto subió más del 10% respecto de su compra anterior, y tope de seña si un pago supera el 30% del total.',
    ],
    steps: [
      'Entrá a "Panel admin" → "Costeo".',
      'Revisá los porcentajes (se escriben como %) y guardá.',
      'En cada lista de rubros, agregá, renombrá o borrá; en los fijos, completá el estimado por mes.',
    ],
    example: [
      'Fede carga Luz con un estimado de $120.000/mes. En un mes con 3 eventos, cada uno suma $40.000 de luz a su costo. Cuando llega la factura real de $150.000 y la carga en Gastos, ese mes cada evento pasa a sumar $50.000.',
    ],
  },
  {
    id: 'admin-gastos',
    group: 'costeo',
    title: 'Gastos (Plan Pro)',
    purpose:
      'Cargá cada gasto (un ticket) con rubro, proveedor, monto, detalle, ítems opcionales y foto del ticket. Se totalizan solos por rubro.',
    path: '/admin/gastos',
    keywords: ['gastos', 'ticket', 'factura', 'compras', 'proveedor', 'rubro', 'costeo', 'pro'],
    details: [
      'Un gasto va contra un evento (lo que se compró para ese evento), contra un mes del salón (luz, gas, sueldos) o es una compra para stock. Los del evento suman a su costeo; los del mes se reparten entre los eventos de ese mes; los de stock esperan a que los asignes (ver "Compras para stock").',
      'Los ítems son opcionales: producto, presentación (x6, 5L…), cantidad, unidad y precio. Si cargás ítems, el monto es la suma. Si no, ponés el total directamente.',
      'La foto o PDF del ticket es solo respaldo: no se lee automáticamente.',
      'Algunos gastos se crean solos: lo que cobra un empleado por evento trabajado (al asignarlo), las comisiones de venta y las liquidaciones del mes.',
    ],
    steps: [
      'Entrá a "Gastos" y elegí el mes con las flechas.',
      'Tocá "+ Cargar gasto": elegí si es de un evento o del mes del salón, la fecha del ticket, el rubro y el proveedor.',
      'Poné el monto, o cargá los ítems uno por uno.',
      'Opcional: detalle y foto del ticket. Guardá.',
    ],
    example: [
      'Fede compra en Macro para el 15 de Martina: 10 cajas de gaseosa x6 a $9.000 y 5 bidones de jugo de 5L a $4.500. Elige el evento, rubro Macro, proveedor Macro, carga los 2 ítems (total $112.500) y saca foto al ticket.',
      'Al pie de "Gastos" de octubre, Macro suma $112.500 más, y el costeo de los 15 de Martina sube esa cifra.',
    ],
  },
  {
    id: 'admin-stock',
    group: 'costeo',
    title: 'Compras para stock (Plan Pro)',
    purpose:
      'Para lo que se compra a futuro (ej. carne en oferta) sin un evento ni un mes definido: queda en stock y, cuando se usa, se asigna a un evento todo o una parte.',
    path: '/admin/gastos',
    keywords: ['stock', 'deposito', 'oferta', 'a futuro', 'compra', 'asignar', 'carne'],
    details: [
      'Una compra para stock no cuenta en el costeo de ningún evento ni se prorratea en ningún mes hasta que la asignás.',
      'Al asignar, elegís el evento y cuánto (en $) se usó. Queda como un gasto de ese evento, con el mismo rubro y proveedor, marcado "del stock". Lo que no asignaste sigue disponible.',
      'Si te equivocaste de evento, quitá ese gasto del evento: el monto vuelve al stock. Una compra que ya tiene partes asignadas no se puede borrar ni bajar por debajo de lo usado.',
    ],
    steps: [
      'En "Gastos", tocá "+ Cargar gasto" y elegí "Compra para stock". Completá rubro, proveedor, monto (o ítems) y ticket.',
      'Cuando la uses, bajá hasta "Stock" en la misma pantalla y tocá "Asignar a un evento".',
      'Elegí el evento, poné el monto usado y tocá "Asignar".',
    ],
    example: [
      'Fede compra 40 kg de vacío en oferta por $400.000 sin saber para qué evento. Lo carga como compra para stock. En diciembre usa la mitad en los 15 de Martina: asigna $200.000 a ese evento y el stock muestra "Queda $200.000".',
    ],
  },
  {
    id: 'admin-costeo-evento',
    group: 'costeo',
    title: 'Costeo de un evento (Plan Pro)',
    purpose:
      'En el detalle del evento: sus gastos por rubro y proveedor, el prorrateo de los gastos del salón del mes, los impuestos y el costo neto, por 100 invitados y de tarjeta.',
    path: '/admin/eventos',
    keywords: ['costeo', 'costo tarjeta', 'costo neto', 'insumos', 'servicios', 'prorrateo', 'pro'],
    details: [
      'Costo neto = gastos del evento + su parte de los gastos del salón del mes + impuestos bancarios.',
      'La parte del salón se reparte entre los eventos no cancelados del mes. Por cada gasto fijo se usa el real si lo cargaste ese mes, o el estimado si no (en la tabla se ve "real" o "estimado").',
      'Costo x 100 invitados = costo neto ÷ (invitados ÷ 100). Costo tarjeta = eso × 1,76 (ganancia + rotura + IVA).',
      'Los invitados salen de la suma de las tarjetas; podés poner otra cantidad para simular.',
    ],
    steps: [
      'Abrí el evento y bajá a "Costeo".',
      'Revisá los gastos por rubro; cargá los que falten con "+ Cargar gasto".',
      'Abrí "Gastos del salón prorrateados e impuestos" para ver el detalle.',
    ],
    example: [
      '15 de Martina, 120 invitados: gastos del evento $900.000 + parte del salón $100.000 = $1.000.000.',
      'Impuestos: 0,12% de $1.000.000 = $1.200 + $1.000 de transferencia = $2.200. Costo neto: $1.002.200.',
      'Costo x 100 invitados: 1.002.200 ÷ 1,2 = $835.167. Costo tarjeta: 835.167 × 1,76 = $1.469.893.',
    ],
  },
  {
    id: 'admin-personal',
    group: 'costeo',
    title: 'Personal',
    purpose:
      'Alta y edición de empleados con todo lo que cobran: sueldo fijo, valor hora, monto por evento trabajado y comisión por evento vendido.',
    path: '/admin/personal',
    keywords: ['personal', 'empleados', 'staff', 'asignacion', 'nomina', 'comision'],
    details: [
      'Cada concepto es independiente (0 si no aplica): se puede tener solo fijo, solo por evento o una mezcla.',
      'Por evento trabajado: al asignar al empleado a un evento (desde el detalle del evento), se crea solo el gasto en el costeo de ese evento.',
      'Comisión por venta: se genera cuando el empleado figura como "Vendido por" en un evento, en el mes de la fecha de venta.',
      'El "rubro de costeo" decide en qué rubro suman sus gastos.',
      'Dar de baja a un empleado le corta también el acceso a la puerta.',
    ],
    steps: [
      'Entrá a "Personal" y completá el formulario de nuevo empleado (el email es obligatorio).',
      'Para editarlo, tocá "Editar" en su fila, cambiá lo necesario y tocá "Guardar".',
      'Para asignarlo a un evento: en el detalle del evento, "Personal asignado" → elegí → "Asignar".',
    ],
    example: [
      'Pao: fijo $0, valor hora $5.000, $55.000 por evento trabajado, $100.000 por evento vendido. Fede la asigna al 15 de Martina: en el costeo aparece $55.000 de Pao. Como ella lo vendió, aparece además $100.000 en "Comisiones de venta".',
    ],
  },
  {
    id: 'admin-liquidacion',
    group: 'costeo',
    title: 'Liquidación de personal (Plan Pro)',
    purpose:
      'Horas, adelantos y la liquidación del mes: la app arma una línea por concepto con su cálculo y la editás antes de confirmar.',
    path: '/admin/personal',
    keywords: ['liquidacion', 'horas', 'comisiones', 'sueldo', 'adelantos', 'pro'],
    details: [
      'Al elegir el mes, la app arma un borrador: sueldo fijo, horas × valor hora, eventos trabajados × monto, comisiones de los eventos vendidos ese mes y los adelantos a descontar. No guarda nada hasta que confirmás.',
      'Cada línea se puede editar o quitar, y podés agregar otras (un bono, un descuento).',
      'Al confirmar, el fijo + las horas + las líneas extra pasan a ser un gasto del mes del salón (se reparte en el costeo). Lo por evento y las comisiones no se suman de nuevo: ya estaban en el costeo de cada evento.',
      'Volver a liquidar el mismo mes reemplaza la liquidación anterior.',
    ],
    steps: [
      'En "Personal", tocá "Liquidación →" del empleado.',
      'Cargá las horas de cada día y los adelantos que se le dieron.',
      'Elegí el mes: revisá el borrador, editá lo que haga falta.',
      'Tocá "Confirmar liquidación" (o "Re-liquidar mes" si ya estaba): queda en "Liquidaciones confirmadas".',
    ],
    example: [
      'Adri en octubre: fijo $200.000 + 20 h × $5.000 = $100.000 + 3 eventos × $55.000 = $165.000 − adelanto $50.000. Total a pagar: $415.000.',
      'Al costeo de octubre entran $300.000 (fijo + horas) como gasto del salón. Los $165.000 ya estaban en los 3 eventos.',
    ],
  },
  {
    id: 'admin-acceso-puerta',
    group: 'costeo',
    title: 'Acceso de empleados a la puerta',
    purpose:
      'Dale a un empleado acceso al check-in de invitados con una contraseña temporal; al entrar elige una propia.',
    path: '/admin/personal',
    keywords: ['puerta', 'check-in', 'acceso', 'contraseña', 'empleado', 'login'],
    details: [
      'El empleado solo ve los eventos a los que está asignado, y solo la pantalla de la puerta.',
      'La temporal se muestra una vez. Para cortarle el acceso, das de baja al empleado.',
    ],
    steps: [
      'En "Personal", tocá "Acceso puerta" en el empleado.',
      'Copiá la contraseña o "Enviar por email", y "Listo, ocultar".',
      'Asignalo al evento desde su detalle para que lo vea en la puerta.',
    ],
    example: [
      'Adri va a estar en la puerta del egreso. Fede le da acceso, le pasa la temporal en persona y lo asigna al evento. Adri entra desde su celular, cambia la clave y ve solo "Egresados Colegio X".',
    ],
  },

  // ─────────────────────────── Panel: control ───────────────────────────
  {
    id: 'admin-reportes',
    group: 'control',
    title: 'Reportes y exportaciones',
    purpose:
      'Ocupación por mes, comprometido vs. cobrado, tarjetas y comparación con el año anterior ajustada por IPC. Exportable a Excel, CSV o PDF.',
    path: '/admin/reportes',
    keywords: [
      'reportes',
      'ocupacion',
      'cobranza',
      'excel',
      'csv',
      'pdf',
      'exportar',
      'interanual',
    ],
    details: [
      'Comprometido = lo que valen las tarjetas de los eventos del año; cobrado = lo que ya pagaron. La cobranza del año muestra además de cuántos eventos sale.',
      'La comparación interanual se muestra nominal y ajustada por IPC: así se ve si se vendió más de verdad o solo subieron los precios.',
      'La tarjeta "Eventos" es un filtro: elegí uno o varios eventos y todo el reporte se recalcula solo con esos.',
      'Son reportes informativos, no contables.',
    ],
    steps: [
      'Entrá a "Reportes" y elegí el año.',
      'Opcional: filtrá por eventos.',
      'Exportá con "Excel" o "CSV", o "Imprimir / Guardar PDF".',
    ],
    example: [
      'Fede filtra los 6 egresos del año: ve comprometido $18M, cobrado $12M, y que de 1.900 tarjetas hay 1.250 pagas. Exporta a Excel para mandárselo al contador.',
    ],
  },
  {
    id: 'admin-auditoria',
    group: 'control',
    title: 'Auditoría',
    purpose:
      'Quién cambió qué y cuándo: tarjetas, pagos (incluidas las bajas), IPC, costeo, personal, eventos y contratos.',
    path: '/admin/auditoria',
    keywords: ['auditoria', 'historial', 'trazabilidad', 'cambios', 'quien'],
    details: [
      'Cada cambio guarda el antes y el después, con el nombre de quien lo hizo. Nadie (ni un error de la app) puede editarlo ni borrarlo.',
      'Cada evento tiene además su propio "Historial" en su detalle.',
    ],
    steps: [
      'Entrá a "Auditoría" y filtrá por fecha, usuario o área.',
      'O abrí un evento y bajá a "Historial".',
    ],
    example: [
      'El saldo de una familia bajó y nadie sabe por qué. Cami filtra por "Pagos" y ve que el martes Fede borró un pago de $40.000 cargado dos veces.',
    ],
  },

  // ─────────────────────────── Puerta ───────────────────────────
  {
    id: 'checkin',
    group: 'puerta',
    title: 'Check-in en la puerta',
    purpose:
      'Escaneá el QR del invitado con la cámara (o buscalo por código o nombre) y admitilo con un toque.',
    path: '/checkin',
    keywords: ['check-in', 'puerta', 'escanear', 'qr', 'ingreso', 'reingreso'],
    details: [
      'Escanear o buscar solo consulta: nada queda registrado hasta tocar "Admitir" o "Rechazar". Si la cámara falla y reintentás, no pasa nada.',
      'Si la persona ya había entrado, aparece "YA INGRESÓ a las…": para dejarla pasar de nuevo hay que verificar (DNI o con el titular) y anotar cómo. Si no se puede verificar, se rechaza.',
      'Una entrada dada de baja no es válida: solo se puede rechazar. Un QR de otro evento avisa que es de otro evento.',
      'La etiqueta "Entrada después de las 12" indica invitados que tienen permitido llegar tarde.',
    ],
    steps: [
      'Iniciá sesión y elegí el evento de esta noche.',
      'Activá la cámara y apuntá al QR, o escribí el código o el nombre y tocá "Buscar".',
      'Revisá la tarjeta del invitado y tocá "Admitir" (o "Rechazar").',
    ],
    example: [
      'Juan muestra su QR: Adri lo escanea y toca "Admitir". A las 2:00 Juan sale y vuelve: al escanearlo aparece "YA INGRESÓ a las 22:14", Adri le pide el DNI, elige la nota "Reingreso verificado con DNI" y toca "Admitir reingreso".',
    ],
  },
];
