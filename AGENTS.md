# AGENTS.md — Instrucciones para asistentes de IA

Este archivo es para cualquier asistente de IA (Codex, Cursor, Copilot, Gemini, ChatGPT, Claude, etc.) que trabaje en este repositorio. Los integrantes del equipo son **estudiantes con poca experiencia programando**: además de escribir código, tu trabajo es que entiendan lo que se hace.

## ⚠️ Antes de empezar: dos reglas obligatorias

1. **Al comenzar la conversación, pedile al dev que te diga en qué está trabajando el resto del grupo, si lo sabe** (qué tareas de [TAREAS.md](TAREAS.md) tomó cada uno). Así evitás tocar código que otra persona está modificando en paralelo.
2. **Recordale al dev que avise en el grupo en qué está trabajando**: al tomar la tarea, al abrir el PR y si se traba. Repetíselo al final de la sesión.

---

## Cómo trabajar con el dev

- **Identificá la tarea.** Pedile el ID (por ejemplo `B-3`), leé su especificación completa en [TAREAS.md](TAREAS.md) y verificá que sus dependencias estén hechas. Si no tiene una tarea asignada, ayudalo a elegir una de su frente.
- **No inventes requisitos.** Si algo no está en TAREAS.md, en `docs/` ni en este archivo, preguntale al dev. Las decisiones de negocio dudosas se consultan en el grupo, no se improvisan.
- **Explicá lo que hacés.** Antes de un cambio grande, contá el plan en pocas líneas. Después de escribir código, explicá las partes importantes: qué hace, por qué va en esa capa y cómo se prueba. Si el dev no puede explicarlo, no está terminado.
- **Mantenete dentro del alcance.** Tocá solo los archivos de la tarea. No refactorices otras partes, no actualices dependencias, no cambies la configuración (CI, tsconfig, linters, Docker) ni el `schema.prisma` sin que el dev confirme que lo coordinó con el grupo.
- **Nunca** leas, muestres ni pidas el contenido de archivos `.env`, contraseñas o claves.

## El proyecto en 30 segundos

Sistema de gestión y seguimiento de repartos para una pyme de logística. Tres usuarios:
- **Operario** (panel web): registra envíos, administra comercios y repartidores, y supervisa la operación.
- **Repartidor** (web móvil): inicia la jornada, recibe ofertas de viaje (5 minutos para aceptar), avanza los estados del envío y reporta problemas. Entra con un PIN de 4 dígitos.
- **Destinatario** (página pública): consulta el estado de su envío con un código de seguimiento, sin registrarse.

Lo central es el **motor de asignación**: una cola FIFO de repartidores por tipo de vehículo, con la regla de máximo 2 viajes consecutivos. Las reglas de negocio, el modelo de datos y los supuestos están en [TAREAS.md](TAREAS.md). Los requisitos están en `docs/` en Markdown ([índice](docs/README.md)): entrevistas, [iniciativas y épicas](docs/iniciativas-y-epicas.md), [RNF](docs/requerimientos-no-funcionales.md) y [riesgos del PGP](docs/plan-de-gestion.md). Cuando una tarea cite "Épica 2.3" o "RNF-10", leé esa parte antes de programar.

## Stack y comandos

| Parte | Tecnología | Carpeta |
|---|---|---|
| API REST | NestJS 12 + TypeScript (CommonJS), Prisma 7 + PostgreSQL 17 | `is-backend/` |
| Frontend SPA | React 19 + Vite + TypeScript, React Router, Tailwind CSS 4 | `is-frontend/` |
| Desarrollo local | Docker Compose (Postgres en `localhost:5433`) | raíz |
| Producción | Railway (API), Supabase (base), Vercel (front) | — |

```bash
docker compose up -d db                    # base de datos local
cd is-backend && npm run start:dev         # API en http://localhost:3000/api
cd is-frontend && npm run dev              # front en http://localhost:5173
```

Antes de dar una tarea por terminada, **todo esto tiene que pasar**:
```bash
cd is-backend  && npm run lint && npm test && npm run build
cd is-frontend && npm run lint && npm run build
```

## Arquitectura del backend (obligatorio respetarla)

**Monolito modular.** Cada módulo de negocio vive en `is-backend/src/modules/<modulo>/`:

```
src/modules/envios/
├── envios.module.ts       exporta SOLO el service
├── envios.controller.ts   HTTP: rutas, DTOs, códigos de estado. Sin reglas de negocio.
├── envios.service.ts      reglas de negocio. No conoce HTTP (req/res) ni escribe SQL.
├── envios.repository.ts   acceso a datos con PrismaService. Sin reglas de negocio.
├── domain/                lógica pura sin dependencias (ej: máquina de estados)
├── dto/                   clases con decoradores de class-validator
└── *.spec.ts              tests junto al archivo que prueban
```

Reglas:
- Dependencias en una sola dirección: **controller → service → repository**.
- **Un módulo nunca importa el repository de otro módulo.** Si `envios` necesita datos de `comercios`, inyecta `ComerciosService` (exportado en `ComerciosModule` e importado en `EnviosModule`).
- `PrismaService` (`src/database/`) solo se inyecta en repositories.
- SQL a mano solo dentro de un repository, con `` tx.$queryRaw`...` ``. **Nunca** uses `$queryRawUnsafe` ni concatenes valores en SQL.
- Las operaciones que tocan varias tablas van en `prisma.$transaction(async (tx) => { ... })`.
- Validación de forma (campo obligatorio, formato) en los **DTOs**. Validación de negocio (el comercio existe, la transición es válida) en el **service**.
- Errores: lanzá las excepciones de Nest (`NotFoundException`, `ConflictException`, `BadRequestException`, `ForbiddenException`) desde el service.
- Todo cambio de estado de un envío crea un `EventoEnvio` (historial y auditoría).
- Para generar el esqueleto: `npx nest g controller modules/<modulo>` y `npx nest g service modules/<modulo>`. El repository se crea a mano como `@Injectable()`.

### Rutas de la API

Todas bajo `/api`. Sustantivos en plural y en español.

| Prefijo | Quién | Ejemplo |
|---|---|---|
| `/api/auth/...` | público | `POST /api/auth/operario/login` |
| `/api/comercios`, `/api/envios`, `/api/repartidores`, `/api/flota` | operario | `GET /api/envios?estado=PENDIENTE` |
| `/api/repartidor/...` | el repartidor logueado, sobre sí mismo | `POST /api/repartidor/jornada/iniciar` |
| `/api/seguimiento/:codigo` | público | |

**Toda la API exige sesión por defecto** (guards globales de A-3). Cada controller o endpoint **tiene que** declarar quién lo usa; si no, responde 403:

```ts
import { Public, Roles, UsuarioActual, type UsuarioAutenticado } from '../../common/auth';

@Roles('OPERARIO')                 // todo el controller: solo operarios
@Controller('comercios')
export class ComerciosController { ... }

@Roles('REPARTIDOR')
@Controller('repartidor/jornada')
export class JornadaController {
  @Post('iniciar')
  iniciar(@UsuarioActual() usuario: UsuarioAutenticado) {   // usuario.id = id del repartidor logueado
    return this.jornada.iniciar(usuario.id);
  }
}

@Public()                          // sin sesión (ej: seguimiento del destinatario)
@Controller('seguimiento')
export class SeguimientoController { ... }
```

Nunca uses un id de usuario que venga en el body o en un header para saber quién está logueado: usá siempre `@UsuarioActual()`.

### Base de datos

- El esquema está en `is-backend/prisma/schema.prisma`. Respetá las convenciones del "Modelo de datos propuesto" de TAREAS.md: modelos en PascalCase con `@@map` a snake_case plural, y campos en camelCase con `@map`.
- Después de cambiar el schema: `npm run db:migrate -- --name <descripcion>`. Commiteá el schema junto con la migración. **Nunca** edites una migración ya mergeada.
- El cliente de Prisma se importa desde `src/generated/prisma/client`. Es código generado: no se edita ni se commitea.

## Arquitectura del frontend

```
is-frontend/src/
├── router.tsx              todas las rutas
├── shared/
│   ├── api.ts              cliente HTTP: usalo siempre en lugar de fetch directo
│   ├── layouts/            OperarioLayout, RepartidorLayout
│   └── ui/                 componentes reutilizables (Boton, Campo, Tabla, Modal...)
└── features/
    ├── auth/
    ├── operario/<seccion>/     comercios, envios, repartidores, flota, excepciones
    ├── repartidor/<seccion>/   jornada, ofertas, viaje
    └── seguimiento/
```

- Componentes funcionales con hooks, en archivos `PascalCase.tsx`, con export nombrado (`export function EnviosPage()`).
- Estilos solo con clases de Tailwind. Antes de crear un componente nuevo, revisá `shared/ui/`.
- Los datos que tienen que verse actualizados se refrescan por **polling**: 10 s en la app del repartidor y 15 s en el panel del operario.
- **App del repartidor (RNF-10):** botones grandes (48 px de alto o más), alto contraste, texto de 18 px o más, y como máximo 2 toques por acción (botón + confirmación). Diseñá primero para un celular de 360 px de ancho.
- Nunca muestres en pantalla el PIN, la contraseña, el DNI completo ni ningún dato sensible innecesario.

## Convenciones de código

- **Idioma:** el dominio va en español (`Envio`, `crearEnvio`, `codigoSeguimiento`). Lo propio del framework queda en inglés (`Controller`, `Injectable`, `useEffect`). Sin `ñ` ni tildes en identificadores (`tamanio`), pero sí en textos visibles y comentarios.
- **Nombres:** variables y funciones en `camelCase`; clases, tipos y componentes en `PascalCase`; constantes globales en `MAYUSCULAS`.
- **Comentarios:** en español, explicando el **por qué**, no el qué. No comentes lo obvio.
- **Tipos:** TypeScript estricto. No uses `any`; si no sabés el tipo, averigualo.
- **Tests:** cada service con reglas de negocio lleva su `*.spec.ts`, con los repositories mockeados (ver el ejemplo en `src/health/health.controller.spec.ts`). Lo que depende de SQL, transacciones o bloqueos se prueba con tests e2e en `test/` contra la base de test (`vaciarBase()` de `test/utils.ts` la deja vacía; ejemplo: `test/asignacion.e2e-spec.ts`). Los nombres de los tests describen el comportamiento en español: `it('rechaza un envío de un comercio inactivo')`.
- Formateá con Prettier (`npm run format` en el backend).

## Git

- Rama por tarea, que sale de `dev`: `feature/<ID>-<descripcion>`. PR hacia `dev`. Detalle en [CONTRIBUTING.md](CONTRIBUTING.md).
- Commits chicos, con mensajes en español e infinitivo que dicen qué cambia.
- No hagas commits ni pushes sin que el dev lo pida.

## Checklist antes de decirle al dev "terminé"

- [ ] Se cumplen **todos** los criterios de aceptación de la tarea en TAREAS.md.
- [ ] Lint, tests y build pasan en los dos proyectos que corresponda.
- [ ] No se tocaron archivos fuera del alcance de la tarea.
- [ ] Si cambió el schema, la migración está creada y el dev sabe que tiene que avisar en el grupo.
- [ ] El dev entiende lo que se hizo y lo puede explicar.
- [ ] **Le recordaste al dev que avise en el grupo** que la tarea está lista y que abra el PR hacia `dev`.
