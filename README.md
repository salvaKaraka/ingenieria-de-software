# Sistema de gestión y seguimiento de repartos

Práctica de Ingeniería de Software 2026 — Ingeniería en Computación (UNLP), grupo 9.

Aplicación web con tres áreas: **panel del operario** (envíos, comercios, repartidores, incidentes), **web móvil del repartidor** (jornada, ofertas, estados, evidencias) y **seguimiento público** para el destinatario. La documentación funcional (entrevistas, épicas, RNF, PGP) está en [`docs/`](docs/).

| Archivo | Para qué |
|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Cómo trabajamos: ramas, commits, PRs, revisiones, cambios en la base |
| [TAREAS.md](TAREAS.md) | Todo el trabajo pendiente, repartido en frentes, con criterios de aceptación |
| [AGENTS.md](AGENTS.md) | Instrucciones para asistentes de IA y convenciones de código |

## Stack

| Parte | Tecnología | Producción |
|---|---|---|
| Backend (API REST) | NestJS + TypeScript, Prisma 7 | Railway |
| Base de datos | PostgreSQL 17 | Supabase |
| Frontend (SPA) | React + Vite + TypeScript, React Router, Tailwind | Vercel |
| Desarrollo local | Docker Compose (Postgres y, opcionalmente, la API) | — |

## Estructura del repo

```
.
├── docs/                   documentación del proyecto
├── is-backend/             API NestJS
│   ├── prisma/             schema.prisma (tablas) y migraciones
│   ├── src/
│   │   ├── main.ts         arranque (prefijo /api, validación, CORS)
│   │   ├── app.module.ts   módulo raíz: registra todos los módulos
│   │   ├── config/         validación de variables de entorno
│   │   ├── database/       PrismaService (conexión a la base)
│   │   ├── health/         GET /api/health
│   │   └── modules/        módulos de negocio (envios, comercios, repartidores, ...)
│   └── test/               tests end-to-end
├── is-frontend/            SPA React
│   └── src/
│       ├── router.tsx      rutas de las tres áreas
│       ├── features/       una carpeta por área: operario/, repartidor/, seguimiento/
│       └── shared/         código compartido (cliente de la API, componentes comunes)
├── docker-compose.yml      Postgres (+ API) para desarrollo local
└── .github/workflows/      CI: lint, tests y build en cada PR
```

## Requisitos

- [Node.js 24](https://nodejs.org/) (trae `npm`)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) abierto
- Git

## Cómo levantar el proyecto

### Primera vez

```bash
git clone https://github.com/salvaKaraka/ingenieria-de-software.git
cd ingenieria-de-software
git checkout dev
```

### Si vas a trabajar en el frontend

Levantás la base y la API con Docker, y el frontend en modo desarrollo:

```bash
docker compose up -d --build      # base en :5433 y API en :3000

cd is-frontend
npm install
npm run dev                       # http://localhost:5173
```

En la página de inicio tiene que aparecer **"API: ok · base ok ✅"**.

Las pantallas del operario y del repartidor **piden login**. Creá los usuarios de prueba (una sola vez):

```bash
docker compose exec api node dist/scripts/crear-usuarios-prueba
```

| Para entrar a | Credenciales |
|---|---|
| http://localhost:5173/operario | usuario `admin`, contraseña `admin1234` |
| http://localhost:5173/repartidor | PIN `1234` |

### Si vas a trabajar en el backend

Levantás solo la base con Docker y la API con recarga automática:

```bash
docker compose up -d db           # solo la base

cd is-backend
cp .env.example .env
npm install                       # también genera el cliente de Prisma
npm run db:deploy                 # aplica las migraciones
npm run start:dev                 # http://localhost:3000/api/health
npm run dev:usuarios              # operario admin/admin1234 y repartidor con PIN 1234
```

> No corras `docker compose up` completo y `npm run start:dev` a la vez: los dos usan el puerto 3000.

### Puertos

| Puerto | Qué |
|---|---|
| 5173 | Frontend (Vite) |
| 3000 | API |
| 5433 | Postgres (adentro del contenedor es 5432) |

## Comandos útiles

| Dónde | Comando | Qué hace |
|---|---|---|
| raíz | `docker compose up -d db` | Levanta solo la base |
| raíz | `docker compose up -d --build` | Levanta base + API (reconstruye la imagen si cambió el código) |
| raíz | `docker compose logs -f api` | Logs de la API en vivo |
| raíz | `docker compose down` | Frena todo (**los datos se conservan**) |
| raíz | `docker compose down -v` | ⚠️ Frena todo y **borra la base** |
| is-backend | `npm run start:dev` | API con recarga automática |
| is-backend | `npm test` / `npm run test:e2e` | Tests unitarios / end-to-end (e2e necesita la base) |
| is-backend | `npm run lint` | Linter |
| is-backend | `npm run db:migrate -- --name <desc>` | Crea y aplica una migración después de cambiar `schema.prisma` |
| is-backend | `npm run db:studio` | Interfaz web para ver y editar la base |
| is-backend | `npm run dev:usuarios` | Usuarios de prueba: operario `admin`/`admin1234` y repartidor con PIN `1234` (solo bases locales) |
| is-backend | `npm run operario:crear -- <usuario> "<nombre>"` | Crea un operario real (pide la contraseña por consola) |
| is-frontend | `npm run dev` | Frontend con recarga automática |
| is-frontend | `npm run build` / `npm run lint` | Build de producción / linter |

## Cómo trabajamos

- **Flujo de trabajo** (ramas `feature/*` → PR a `dev` → PR a `main` antes de cada demo): [CONTRIBUTING.md](CONTRIBUTING.md).
- **Arquitectura y convenciones de código** (monolito modular, capas controller → service → repository): [AGENTS.md](AGENTS.md).
- **Qué hay que hacer:** [TAREAS.md](TAREAS.md).
