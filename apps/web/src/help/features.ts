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
      'Entrando a un evento desde "Mis eventos" ves el desglose de tarjetas por tipo (adulto/adolescente/menor/brindis), el valor de cada una ya actualizado por IPC, tus pagos registrados y tu saldo pendiente. Si sos titular de un egreso, ves el total general del evento — el detalle de pago de cada familia queda privado.',
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
      'Solo para admin/vendedor. Historial de los períodos de IPC cargados y el índice vigente que usa el portal cliente para actualizar el valor de las tarjetas — con un formulario para cargar un período nuevo mientras no exista el fetch automático contra datos.gob.ar.',
    path: '/admin/ipc',
    keywords: ['admin', 'ipc', 'indice', 'inflacion', 'datos.gob.ar'],
  },
];
