// Esta lista ES la sección de Ayuda (/ayuda): cada vez que se termina una
// funcionalidad, se agrega acá con su propósito y el link correspondiente
// dentro de la app. No documentar features a medio hacer.

export interface HelpFeature {
  id: string;
  title: string;
  purpose: string;
  path: string;
  keywords?: string[];
}

export const helpFeatures: HelpFeature[] = [
  {
    id: 'registro',
    title: 'Crear cuenta',
    purpose:
      'Te registrás con el mismo email que el salón cargó al crear tu evento (como titular, o como familia de un alumno si es un egreso). Al crear la cuenta, tus eventos quedan vinculados automáticamente — no hace falta ningún paso extra.',
    path: '/registro',
    keywords: ['registro', 'cuenta', 'alta', 'crear cuenta', 'email'],
  },
  {
    id: 'login',
    title: 'Iniciar sesión',
    purpose: 'Accedé con tu email y contraseña para entrar a tu portal.',
    path: '/login',
    keywords: ['login', 'ingresar', 'iniciar sesion', 'contraseña', 'entrar'],
  },
  {
    id: 'mis-eventos',
    title: 'Mis eventos',
    purpose:
      'Lista de todos tus eventos contratados con el salón — 15 años, egresados, bodas o empresariales — con tu rol en cada uno (titular o participante) y el saldo pendiente de un vistazo.',
    path: '/portal',
    keywords: ['eventos', 'mis eventos', 'portal', 'lista'],
  },
  {
    id: 'saldo-y-tarjetas',
    title: 'Saldo y tarjetas de un evento',
    purpose:
      'Entrando a un evento desde "Mis eventos" ves el desglose de tarjetas por tipo (adulto/adolescente/menor/brindis), el valor de cada una ya actualizado por IPC, cuántas unidades de cada tipo ya están pagas (si el admin las asignó al cargar el pago), tus pagos registrados y tu saldo pendiente. Si sos titular de un egreso, ves el total general del evento — el detalle de pago de cada familia queda privado.',
    path: '/portal',
    keywords: [
      'saldo',
      'tarjetas',
      'ipc',
      'pagos',
      'abonado',
      'adulto',
      'adolescente',
      'menor',
      'brindis',
    ],
  },
  {
    id: 'admin-dashboard',
    title: 'Panel admin: dashboard',
    purpose:
      'Solo para admin/vendedor. Total de eventos por tipo (15 años, egresados, bodas, empresariales) y los próximos eventos activos, de un vistazo.',
    path: '/admin',
    keywords: ['admin', 'dashboard', 'panel', 'eventos totales'],
  },
  {
    id: 'admin-alta-evento',
    title: 'Cargar un evento nuevo',
    purpose:
      'Solo para admin/vendedor. Da de alta un evento con su titular, el desglose de tarjetas y, si es un egreso, la lista de alumnos. El email del titular (o el de cada alumno) es lo que vincula el evento a la cuenta del cliente — automático si ya tiene cuenta, o en cuanto se registre con ese mismo email.',
    path: '/admin/eventos/nuevo',
    keywords: ['admin', 'alta', 'crear evento', 'cargar evento', 'titular', 'egreso', 'alumnos'],
  },
  {
    id: 'admin-ipc',
    title: 'Estado del IPC',
    purpose:
      'Solo para admin/vendedor. El valor se actualiza solo todos los meses contra datos.gob.ar. Historial de los períodos y el índice vigente que usa el portal cliente, con un formulario para cargar un período a mano si la actualización automática no llegó (aviso visible acá y en el dashboard).',
    path: '/admin/ipc',
    keywords: ['admin', 'ipc', 'indice', 'inflacion', 'datos.gob.ar'],
  },
  {
    id: 'admin-costeo',
    title: 'Configuración de costeo (Plan Pro)',
    purpose:
      'Solo para admin/vendedor en Plan Pro. Porcentajes de ganancia, rotura e IVA (se suman, como en el Excel), impuestos bancarios (créditos, débitos y transferencia) y avisos de renegociación/tope de seña, más los rubros de insumos, servicios y gastos fijos del salón (con su monto estimado mensual), todos editables.',
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
  },
  {
    id: 'admin-gastos',
    title: 'Gastos (Plan Pro)',
    purpose:
      'Solo para admin/vendedor en Plan Pro. Carga de cada gasto con rubro, proveedor, monto, detalle, ítems opcionales (producto, presentación, cantidad y precio) y foto o PDF del ticket como respaldo. Se totalizan solos por rubro: los de un evento suman a su costeo y los del salón se prorratean entre los eventos del mes.',
    path: '/admin/gastos',
    keywords: ['gastos', 'ticket', 'factura', 'compras', 'proveedor', 'rubro', 'costeo', 'pro'],
  },
  {
    id: 'admin-costeo-evento',
    title: 'Costeo de un evento (Plan Pro)',
    purpose:
      'Solo para admin/vendedor en Plan Pro. Desde el detalle de un evento: sus gastos agrupados por rubro y proveedor con cada ítem y subtotal, el prorrateo de los gastos del salón del mes, los impuestos bancarios, y el cálculo de costo neto, costo por 100 invitados y costo de tarjeta.',
    path: '/admin/eventos',
    keywords: ['costeo', 'costo tarjeta', 'costo neto', 'insumos', 'servicios', 'pro'],
  },
  {
    id: 'admin-personal',
    title: 'Personal',
    purpose:
      'Solo para admin/vendedor. Alta y edición de empleados con todo lo que cobran: sueldo fijo, valor hora, monto por evento trabajado y comisión por evento vendido. La asignación a cada evento se hace desde su detalle, y el vendedor desde el alta/edición del evento — los gastos de personal se generan solos en el costeo.',
    path: '/admin/personal',
    keywords: ['personal', 'empleados', 'staff', 'asignacion', 'nomina'],
  },
  {
    id: 'admin-liquidacion',
    title: 'Liquidación de personal (Plan Pro)',
    purpose:
      'Solo para admin/vendedor en Plan Pro. Registro de horas, comisiones adelantadas y liquidación del mes: trae sola una línea por concepto (fijo, horas × valor hora, eventos trabajados, comisiones por eventos vendidos, adelantos) con su cálculo, todo editable antes de confirmar. El fijo + horas confirmado pasa al costeo como gasto del mes.',
    path: '/admin/personal',
    keywords: ['liquidacion', 'horas', 'comisiones', 'sueldo', 'pro'],
  },
  {
    id: 'admin-consultas',
    title: 'Consultas (CRM)',
    purpose:
      'Solo para admin/vendedor. Lista de consultas que llegan del formulario de cotización de la landing (o cargadas a mano), con su estado (nuevo/contactado/con seña/ganado/perdido) y notas internas.',
    path: '/admin/consultas',
    keywords: ['crm', 'consultas', 'leads', 'cotizacion', 'ventas'],
  },
  {
    id: 'admin-calendario',
    title: 'Calendario de disponibilidad',
    purpose:
      'Solo para admin/vendedor. Vista mensual con los eventos ya confirmados y las consultas con fecha tentativa marcada, para no comprometer una fecha que ya tiene una consulta avanzada.',
    path: '/admin/calendario',
    keywords: ['calendario', 'disponibilidad', 'fechas', 'agenda'],
  },
  {
    id: 'cotizar',
    title: 'Cotizar un evento',
    purpose:
      'Formulario en la landing para pedir una cotización — abre WhatsApp con el mensaje ya armado y, además, queda cargado como consulta nueva en el CRM del salón.',
    path: '/',
    keywords: ['cotizar', 'consulta', 'presupuesto', 'landing'],
  },
  {
    id: 'contratos',
    title: 'Contrato digital',
    purpose:
      'El admin sube el PDF del contrato ya firmado desde el detalle del evento; el cliente lo puede ver/descargar desde su portal. Es un adjunto simple, no hay firma electrónica dentro de la plataforma.',
    path: '/admin/eventos',
    keywords: ['contrato', 'pdf', 'firma', 'adjunto'],
  },
  {
    id: 'admin-recordatorios',
    title: 'Recordatorios automáticos',
    purpose:
      'Solo para admin/vendedor. Configura la cadencia de recordatorios de saldo pendiente por WhatsApp y muestra el log de cada intento — mientras no haya WhatsApp Business API conectado, sirve como lista de a quién había que escribirle y qué.',
    path: '/admin/recordatorios',
    keywords: ['recordatorios', 'whatsapp', 'saldo pendiente', 'cobranza'],
  },
  {
    id: 'admin-pagos',
    title: 'Registrar un pago',
    purpose:
      'Solo para admin/vendedor. Todo se cobra en persona (efectivo/transferencia) — Cami o Fede registran el pago desde el detalle del evento, por tarjeta/alumno, con monto, fecha y nota. Opcionalmente pueden indicar qué tarjetas cubre (ej. "2 adultos y 1 menor") para que quede registrado cuántas unidades de cada tipo ya están pagas.',
    path: '/admin/eventos',
    keywords: ['pago', 'cobro', 'abono', 'seña', 'efectivo', 'transferencia', 'asignacion'],
  },
  {
    id: 'admin-reporte-pagos',
    title: 'Reporte de pagos para un cliente',
    purpose:
      'Solo para admin/vendedor. Vista imprimible (Ctrl+P) del detalle de tarjetas y pagos de un alumno/evento puntual, para cuando un cliente pide el detalle — el desglose por familia en un egreso queda privado en el portal, pero Cami/Fede lo pueden generar y compartir a mano.',
    path: '/admin/eventos',
    keywords: ['reporte', 'imprimir', 'pdf', 'detalle de pagos'],
  },
  {
    id: 'admin-clientes',
    title: 'Clientes',
    purpose:
      'Solo para admin/vendedor. Un mismo cliente puede tener más de un evento — esta vista junta todos sus eventos y el saldo de cada uno en un solo lugar, en vez de tener que ir evento por evento a buscarlo.',
    path: '/admin/clientes',
    keywords: ['cliente', 'clientes', 'cuenta', 'buscar cliente'],
  },
  {
    id: 'admin-acceso-puerta',
    title: 'Acceso de empleados a la puerta',
    purpose:
      'Solo para admin/vendedor. Desde Personal, le das a un empleado acceso al check-in de invitados: el sistema genera una contraseña temporal que le pasás en persona o por email, y al entrar por primera vez elige una propia. Dar de baja al empleado le corta el acceso.',
    path: '/admin/personal',
    keywords: ['puerta', 'check-in', 'acceso', 'contraseña', 'empleado', 'login'],
  },
  {
    id: 'portal-invitados',
    title: 'Invitados de tu evento',
    purpose:
      'Desde el detalle de tu evento compartís tu link de invitación (copiar, WhatsApp o QR), ves quién confirmó, cargás invitados vos mismo —incluidos los de "entrada después de las 12"— y das de baja a quien no va. En un egreso, cada familia maneja la lista de su alumno.',
    path: '/portal',
    keywords: ['invitados', 'rsvp', 'confirmar asistencia', 'link', 'qr', 'lista'],
  },
  {
    id: 'micrositio-invitados',
    title: 'Micrositio y entrada con QR (para invitados)',
    purpose:
      'El invitado abre el link, ve la cuenta regresiva, el lugar y las fotos del evento, confirma con su nombre sin crear cuenta y recibe su entrada con un QR y un código corto para mostrar en la puerta. La confirmación por link cierra 2 días antes del evento.',
    path: '/portal',
    keywords: ['micrositio', 'invitacion', 'qr', 'entrada', 'cuenta regresiva', 'confirmar'],
  },
  {
    id: 'admin-invitados',
    title: 'Invitados y micrositio (panel)',
    purpose:
      'Solo para admin/vendedor. En el detalle de cada evento: hora de inicio y link de fotos del fotógrafo para el micrositio, links de invitación por familia, avance de confirmados contra el mínimo contratado (o las tarjetas), y alta/baja de invitados.',
    path: '/admin',
    keywords: ['invitados', 'micrositio', 'fotos', 'link', 'minimo', 'confirmados'],
  },
  {
    id: 'checkin',
    title: 'Check-in en la puerta',
    purpose:
      'Para el personal de la puerta (y admin/vendedor). Escaneás el QR con la cámara del celular, o buscás por código o por nombre, y admitís con un toque. Un reingreso avisa a qué hora entró la primera vez y pide anotar cómo lo verificaste; una entrada dada de baja solo se puede rechazar.',
    path: '/checkin',
    keywords: ['check-in', 'puerta', 'escanear', 'qr', 'ingreso', 'reingreso'],
  },
  {
    id: 'admin-editar-evento',
    title: 'Editar evento y ajustar tarjetas',
    purpose:
      'Solo para admin/vendedor. Desde el detalle del evento editás nombre, fecha, titular y estado (activo, finalizado o cancelado — un cancelado sale del calendario, reportes y recordatorios). Las tarjetas se ajustan con un motivo obligatorio (renegociación), que queda registrado aparte del ajuste automático por IPC.',
    path: '/admin',
    keywords: ['editar', 'cancelar', 'titular', 'ajuste', 'renegociacion', 'tarjetas'],
  },
  {
    id: 'admin-proveedores',
    title: 'Proveedores y sponsors',
    purpose:
      'Solo para admin/vendedor. Proveedores con su rubro (el mismo del costeo), contacto y tipos de evento: los marcados para el directorio se muestran en la landing y en el portal según el evento; los de compras (Macro, Kristal…) solo se usan en los gastos. También sponsors (logo + link) para la landing. La comisión de referencia es solo una nota interna.',
    path: '/admin/proveedores',
    keywords: ['proveedores', 'fotografo', 'decoracion', 'sonido', 'sponsors', 'directorio'],
  },
  {
    id: 'portal-proveedores',
    title: 'Proveedores recomendados',
    purpose:
      'En tu portal ves los proveedores de confianza del salón para el tipo de evento que contrataste.',
    path: '/portal',
    keywords: ['proveedores', 'recomendados', 'fotografo', 'decoracion'],
  },
  {
    id: 'admin-reportes',
    title: 'Reportes y exportaciones',
    purpose:
      'Solo para admin/vendedor. Ocupación por mes, comprometido vs. cobrado y comparación con el año anterior ajustada por IPC. Exportás el reporte y las listas de eventos, tarjetas y pagos a Excel o CSV, o lo imprimís como PDF. La lista de invitados se exporta desde cada evento.',
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
  },
  {
    id: 'admin-reset-cliente',
    title: 'Contraseña temporal para un cliente',
    purpose:
      'Solo para admin/vendedor. Si un cliente no puede entrar, desde su ficha en Clientes le generás una contraseña temporal (se muestra una sola vez, la copiás o se la mandás por email) y al entrar elige una propia.',
    path: '/admin/clientes',
    keywords: ['contraseña', 'olvidé', 'reset', 'cliente', 'acceso'],
  },
  {
    id: 'admin-auditoria',
    title: 'Auditoría',
    purpose:
      'Solo para admin/vendedor. Quién cambió qué y cuándo: tarjetas, pagos (incluidas las bajas), IPC, costeo, personal, eventos y contratos. Cada evento tiene además su propio historial. El registro no se puede editar ni borrar.',
    path: '/admin/auditoria',
    keywords: ['auditoria', 'historial', 'trazabilidad', 'cambios', 'quien'],
  },
];
