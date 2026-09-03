# Raphael Eventos

Plataforma web para un salón de fiestas en Córdoba: landing comercial + portal de clientes +
panel administrador, pensada desde el día uno como multi-tenant. Este repo es un monorepo
(`npm workspaces`) con el frontend (`apps/web`), la API propia (`apps/api`) y los schemas
compartidos (`packages/shared`).

Para arquitectura, decisiones de producto, convenciones de código y el detalle de por qué se
tomó cada decisión técnica, ver [`CLAUDE.md`](./CLAUDE.md) y la carpeta [`docs/`](./docs).

## Requisitos

- Node.js 20+
- Docker Desktop (el Postgres de desarrollo corre en un contenedor local)

## Puesta en marcha (primera vez)

1. Instalar las dependencias del monorepo:

   ```bash
   npm install
   ```

2. Levantar el Postgres local (puerto **5450**):

   ```bash
   npm run db:up
   ```

3. Configurar las variables de entorno (los valores por defecto ya apuntan al Postgres local,
   no hace falta tocarlos para desarrollar):

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```

4. Aplicar las migraciones (crea las tablas, con Row-Level Security incluida):

   ```bash
   cd apps/api && npx prisma migrate deploy && cd ../..
   ```

5. Sembrar el tenant "Raphael Eventos" y un usuario de prueba:

   ```bash
   npm run db:seed -w apps/api
   ```

## Correr el backend

```bash
npm run dev:api
```

Queda escuchando en http://localhost:3001 (`GET /health` para chequear que levantó bien).

## Correr el frontend

```bash
npm run dev:web
```

Abrí http://localhost:5173.

## Usuarios de prueba (login local)

El seed del paso 5 crea dos cuentas en el tenant "Raphael Eventos":

| Rol                 | Email                      | Contraseña       |
| ------------------- | -------------------------- | ---------------- |
| Cliente (`/portal`) | `demo@raphaeleventos.com`  | `Demo1234!`      |
| Admin (`/admin`)    | `admin@raphaeleventos.com` | `AdminDemo1234!` |

No hay alta de cuentas admin/vendedor desde la app (sería un agujero de
seguridad) — se siembran así o se cargan a mano en la base. Cualquier cuenta
de cliente nueva la podés crear vos mismo desde `/registro`.

## Ayuda dentro de la app

La app tiene una sección de Ayuda en `/ayuda`, con un buscador de funcionalidades: a medida que
se suma cada feature, se agrega ahí con su propósito y su link directo. Es el lugar más rápido
para ver qué está hecho hasta el momento y dónde encontrarlo — se actualiza en el mismo commit
que la funcionalidad que describe.

## Comandos útiles

```bash
npm run typecheck   # tsc --noEmit en las 3 carpetas
npm run test        # vitest run en las 3 carpetas (apps/api pega contra el Postgres local)
npm run lint         # eslint .
npm run format        # prettier --write .
npm run build          # build de shared → api → web, en ese orden
```

Ver [`CLAUDE.md`](./CLAUDE.md) para el resto de los comandos (reset de la base, cómo generar una
migración nueva sin perder Row-Level Security, etc.) y el detalle completo de arquitectura.
