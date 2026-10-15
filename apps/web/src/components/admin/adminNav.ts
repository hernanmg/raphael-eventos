import type { AdminIconName } from './AdminIcon';

// Fuente única de la navegación del panel admin: la usan las cards de módulo
// del dashboard (desktop), las migas de pan + pestañas de cada pantalla y la
// barra inferior / hoja "Más" (mobile). Una pantalla nueva del panel se suma
// acá y aparece en los tres lugares.

export interface AdminNavItem {
  to: string;
  label: string;
  description: string;
  icon: AdminIconName;
  /** Solo para tenants en Plan Pro (mismo gating que antes en el dashboard). */
  proOnly?: boolean;
}

export interface AdminNavGroup {
  id: 'operacion' | 'comercial' | 'finanzas' | 'equipo' | 'sistema';
  title: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    id: 'operacion',
    title: 'Operación',
    items: [
      {
        to: '/admin/calendario',
        label: 'Calendario',
        description: 'Fechas confirmadas y tentativas, mes a mes',
        icon: 'calendar',
      },
      {
        to: '/admin/eventos/nuevo',
        label: 'Cargar evento',
        description: 'Alta de 15 años, egresados, boda o empresarial',
        icon: 'plus',
      },
    ],
  },
  {
    id: 'comercial',
    title: 'Comercial',
    items: [
      {
        to: '/admin/consultas',
        label: 'Consultas',
        description: 'Pedidos de cotización que llegan desde la landing',
        icon: 'mail',
      },
      {
        to: '/admin/clientes',
        label: 'Clientes',
        description: 'Saldo de cada cliente con todos sus eventos',
        icon: 'users',
      },
      {
        to: '/admin/recordatorios',
        label: 'Recordatorios',
        description: 'Avisos de saldo pendiente por WhatsApp',
        icon: 'bell',
      },
    ],
  },
  {
    id: 'finanzas',
    title: 'Finanzas',
    items: [
      {
        to: '/admin/gastos',
        label: 'Gastos',
        description: 'Tickets por evento y gastos del salón',
        icon: 'receipt',
        proOnly: true,
      },
      {
        to: '/admin/costeo/config',
        label: 'Costeo',
        description: 'Rubros, porcentajes e impuestos bancarios',
        icon: 'sliders',
        proOnly: true,
      },
      {
        to: '/admin/reportes',
        label: 'Reportes',
        description: 'Ocupación, cobranza e interanual',
        icon: 'chart',
      },
      {
        to: '/admin/ipc',
        label: 'Estado del IPC',
        description: 'Índice que actualiza el valor de las tarjetas',
        icon: 'percent',
      },
    ],
  },
  {
    id: 'equipo',
    title: 'Equipo y red',
    items: [
      {
        to: '/admin/personal',
        label: 'Personal',
        description: 'Empleados, horas y liquidación',
        icon: 'idcard',
      },
      {
        to: '/admin/proveedores',
        label: 'Proveedores',
        description: 'Directorio de la landing y proveedores de compras',
        icon: 'store',
      },
    ],
  },
  {
    id: 'sistema',
    title: 'Sistema',
    items: [
      {
        to: '/admin/auditoria',
        label: 'Auditoría',
        description: 'Quién cambió qué y cuándo',
        icon: 'shield',
      },
    ],
  },
];

export function visibleItems(group: AdminNavGroup, isPro: boolean): AdminNavItem[] {
  return group.items.filter((item) => isPro || !item.proOnly);
}

// Subpantallas que no son ítems del menú pero cuelgan de uno (para las migas
// de pan). `parent: null` = cuelga directo del inicio.
const DETAIL_ROUTES: { pattern: RegExp; parent: string | null; label: string }[] = [
  {
    pattern: /^\/admin\/personal\/[^/]+\/liquidacion/,
    parent: '/admin/personal',
    label: 'Liquidación',
  },
  { pattern: /^\/admin\/clientes\/[^/]+/, parent: '/admin/clientes', label: 'Detalle del cliente' },
  { pattern: /^\/admin\/eventos\/(?!nuevo$)[^/]+/, parent: null, label: 'Detalle del evento' },
];

export interface AdminLocation {
  group?: AdminNavGroup;
  item?: AdminNavItem;
  /** Nombre de la subpantalla (detalle de evento, liquidación...). */
  detail?: string;
}

function findItem(to: string): AdminLocation {
  for (const group of ADMIN_NAV) {
    const item = group.items.find((candidate) => candidate.to === to);
    if (item) return { group, item };
  }
  return {};
}

export function locateAdminPage(pathname: string): AdminLocation {
  const path = pathname.replace(/\/+$/, '');
  const direct = findItem(path);
  if (direct.item) return direct;

  for (const route of DETAIL_ROUTES) {
    if (route.pattern.test(path)) {
      return { ...(route.parent ? findItem(route.parent) : {}), detail: route.label };
    }
  }
  return {};
}
