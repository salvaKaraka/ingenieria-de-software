# Trabajo pendiente

Este archivo es la **especificación del trabajo**: qué hay que construir, en qué orden y cómo saber que está terminado. Está escrito para que tanto una persona como un asistente de IA puedan tomar una tarea y entenderla sin contexto extra.

- **Quién hace qué y en qué estado está cada tarea** se sigue en Taiga y en el grupo, no acá. Antes de arrancar una tarea, **avisá en el grupo** cuál tomás.
- Cómo trabajamos (ramas, PRs, revisiones): [CONTRIBUTING.md](CONTRIBUTING.md).
- Reglas para asistentes de IA: [AGENTS.md](AGENTS.md).
- Requisitos: [`docs/`](docs/README.md). Las referencias "Épica 2.3" apuntan a [iniciativas-y-epicas.md](docs/iniciativas-y-epicas.md), "RNF-10" a [requerimientos-no-funcionales.md](docs/requerimientos-no-funcionales.md) y "riesgo 7" a [plan-de-gestion.md](docs/plan-de-gestion.md#3-riesgos).

---

## Hitos

| Hito | Fecha | Qué se muestra |
|---|---|---|
| **D1 — Demo 1** | 30/10/2026 | Comercios y envíos, motor de asignación FIFO con ofertas, vista del repartidor con cambios de estado, seguimiento público. |
| **D2 — Demo 2** | 20/11/2026 | Evidencias de entrega, novedades en ruta, emergencias con reasignación automática, panel de excepciones, seguridad (RNF-01/03/04). |
| **F2 — Fase 2** | 27/11/2026 | Cierre de jornada, custodia en depósito, devoluciones a comercios. |

## Frentes de trabajo

El trabajo está dividido en **6 frentes**, uno por persona. Cada frente es dueño de sus carpetas, así se puede trabajar en paralelo casi sin pisarse.

| Frente | Tema | Backend (`is-backend/src/modules/`) | Frontend (`is-frontend/src/features/`) | Responsable |
|---|---|---|---|---|
| **A** | Autenticación y seguridad | `auth/` | `auth/` | Salvador |
| **B** | Comercios y envíos (operario) | `comercios/`, `envios/` (alta, listado, detalle) | `operario/comercios/`, `operario/envios/` | a definir |
| **C** | Repartidores y jornada | `repartidores/` | `operario/repartidores/`, `operario/flota/`, `repartidor/jornada/` | a definir |
| **D** | Motor de asignación y ofertas | `asignacion/` | `repartidor/ofertas/` | a definir |
| **E** | Ejecución de entregas | `envios/domain/`, `envios/viajes.*` | `repartidor/viaje/` | a definir |
| **F** | Base del frontend, seguimiento público, datos de prueba y deploy | `seguimiento/`, `prisma/seed.ts` | `shared/`, `seguimiento/` | a definir |

## Orden y dependencias

```
T-00 Modelo de datos ──┬──► B-1, B-3, C-1, C-3, D-1, E-1, F-2, F-3   (casi todo depende de esto: va PRIMERO)
F-1 Esqueleto del front ──► todas las pantallas (B-2, B-5, C-2, C-4, D-4, E-3, F-4)
A-3 Guards + A-4 Login front ──► recién ahí se protegen los endpoints de todos
D-1 Motor ──► D-2 Ofertas ──► D-3 Vencimiento
E-1 Máquina de estados ──► E-2 Endpoints de viaje ──► E-3 Pantalla de viaje
```

**Ya están hechas `T-00` y `F-1`**: todos los frentes pueden arrancar. Mientras tanto, cada uno lee su frente, los requisitos en `docs/` y prepara su rama.

**Mientras no esté lista la autenticación (A-3/A-4):** los endpoints se hacen **sin protección**. Cuando A-3 se mergee, cada frente agrega el decorador de rol en sus controllers (ver A-3).

---

## Modelo de datos propuesto (base de T-00)

Es una **propuesta inicial** a partir de las entrevistas y épicas. T-00 la convierte en `is-backend/prisma/schema.prisma`. Si algo no cierra, se discute en el PR de T-00, no después.

**Convenciones Prisma:** modelos en PascalCase singular con `@@map` a tabla en snake_case plural (`model Envio` → tabla `envios`). Campos en camelCase con `@map` a snake_case (`creadoEn` → `creado_en`). IDs `Int @id @default(autoincrement())`. Sin `ñ` ni tildes en identificadores (`tamanio`, no `tamaño`).

### Enums

| Enum | Valores | Notas |
|---|---|---|
| `TamanioPaquete` | `CHICO`, `MEDIANO`, `GRANDE` | Lo elige el operario al registrar el envío. |
| `TipoVehiculo` | `MOTO`, `AUTO`, `CAMION` | Correspondencia: CHICO→MOTO, MEDIANO→AUTO, GRANDE→CAMION. |
| `EstadoEnvio` | `PENDIENTE`, `ASIGNADO`, `EN_CAMINO_A_RETIRAR`, `RETIRADO`, `EN_DOMICILIO`, `ENTREGADO`, `CANCELADO` | Los de la épica 2.3 + `CANCELADO`. D2/F2 pueden agregar otros. |
| `EstadoRepartidor` | `FUERA_DE_JORNADA`, `DISPONIBLE`, `OCUPADO`, `EN_PAUSA`, `EMERGENCIA` | Épica 3.1. |
| `EstadoOferta` | `PENDIENTE`, `ACEPTADA`, `RECHAZADA`, `VENCIDA` | |
| `TipoActor` | `OPERARIO`, `REPARTIDOR`, `SISTEMA` | Quién hizo una acción (RNF-03). |
| `TipoEvento` | `CREADO`, `CAMBIO_ESTADO`, `REASIGNACION`, `NOVEDAD`, `INCIDENTE`, `NOTA` | Para el historial del envío. |

### Tablas

**`Comercio`**: `id`, `nombre`, `telefono`, `email`, `direccion`, `requiereFoto` (bool, default false), `requiereDni` (bool, default false), `activo` (bool, default true), `creadoEn`, `actualizadoEn`.

**`Repartidor`**: `id`, `nombre`, `apellido`, `telefono`, `email`, `direccion`, `vehiculo` (`TipoVehiculo`), `estado` (`EstadoRepartidor`, default `FUERA_DE_JORNADA`), `enColaDesde` (fecha y hora, nullable: cuándo entró a la cola FIFO; null = no está en la cola), `viajesConsecutivos` (int, default 0), `activo` (bool, default true), `creadoEn`, `actualizadoEn`.
> Las columnas de autenticación (PIN) las agrega A-2. La tabla `Operario` entera la crea A-1.

**`Envio`**: `id`, `codigoSeguimiento` (texto, **único**, aleatorio y no predecible), `comercioId` (FK), `origenDireccion` (por defecto la del comercio), `destinoDireccion`, `destinatarioNombre?`, `destinatarioApellido?`, `destinatarioDni?`, `destinatarioTelefono?`, `tamanio` (`TamanioPaquete`), `vehiculoRequerido` (`TipoVehiculo`), `observaciones?`, `requiereFoto` y `requiereDni` (**se copian del comercio al crear el envío**, así un cambio posterior del comercio no afecta envíos en curso; riesgo 15 del PGP), `estado` (`EstadoEnvio`, default `PENDIENTE`), `repartidorId?` (FK, null mientras no esté asignado), `creadoEn`, `actualizadoEn`.

**`EventoEnvio`** (historial y auditoría): `id`, `envioId` (FK), `tipo` (`TipoEvento`), `estadoAnterior?`, `estadoNuevo?`, `detalle?` (texto), `actorTipo` (`TipoActor`), `actorId?` (int, null si es SISTEMA), `creadoEn`. Índice en (`envioId`, `creadoEn`).
> **Regla:** todo cambio de estado de un envío crea un `EventoEnvio`. De ahí salen la línea de tiempo del seguimiento (épica 2.3) y la auditoría (RNF-03).

**`Oferta`**: `id`, `envioId` (FK), `repartidorId` (FK), `estado` (`EstadoOferta`, default `PENDIENTE`), `creadaEn`, `expiraEn` (creadaEn + 5 minutos), `respondidaEn?`. Índice en (`estado`, `expiraEn`).

---

## Supuestos a confirmar con el cliente

Están implementados así para poder avanzar. Son **parámetros configurables** (riesgo 1 del PGP): si Martín decide otra cosa, se cambia en un solo lugar.

1. **Un viaje a la vez**: un repartidor tiene como máximo un envío activo (no hay entregas en serie en el MVP).
2. **Cola FIFO**: el orden es `enColaDesde` ascendente. Entra a la cola al iniciar la jornada y **vuelve al final** cuando termina una entrega.
3. **Rechazo**: el repartidor que rechaza vuelve al final de la cola y no se le vuelve a ofrecer **ese** envío.
4. **Oferta vencida (5 min sin responder)**: la oferta pasa a `VENCIDA`, el repartidor pasa a `EN_PAUSA` (sale de la cola hasta que se reactive) y el envío se ofrece al siguiente.
5. **Regla de 2 viajes consecutivos**: `viajesConsecutivos` suma 1 por cada entrega. Si al elegir candidato tiene 2 o más, se lo saltea **una vez**: el contador vuelve a 0 y el repartidor va al final de la cola.
6. **Sin candidatos**: el envío queda `PENDIENTE` y se reintenta automáticamente (ver D-3). El operario lo ve marcado como "sin asignar" en el panel.
7. **Hora de salida** que ve el destinatario = momento en que el envío pasó a `RETIRADO`.

---

# Demo 1 (30/10)

## T-00 · Modelo de datos base ✅ hecha
- **Frente:** A (Salvador) · **Depende de:** nada · **Bloquea:** casi todo · **Mergeada el 16/10.** Después de traer `dev`: `cd is-backend && npm install && npm run db:deploy`.
- **Objetivo:** que exista la base de datos compartida sobre la que trabajan todos los frentes.
- **Qué hacer:**
  1. Pasar las tablas y enums de "Modelo de datos propuesto" a `is-backend/prisma/schema.prisma` (sin `Operario` ni columnas de PIN: son de A-1/A-2).
  2. Crear la migración: `npm run db:migrate -- --name modelo_base`.
  3. Crear los módulos vacíos de Nest para que nadie tenga que tocar `app.module.ts` en paralelo: `npx nest g module modules/<nombre>` para `auth`, `comercios`, `envios`, `repartidores`, `asignacion` y `seguimiento`.
- **Criterios de aceptación:**
  - [ ] `npm run db:deploy` crea todas las tablas en una base vacía.
  - [ ] Los seis módulos existen y están registrados en `app.module.ts`.
  - [ ] CI en verde.

## Frente A — Autenticación y seguridad

Decisiones ya tomadas: JWT con **access token corto + refresh token guardado en la base**, ambos en **cookies `httpOnly` + `Secure` + `SameSite=Lax`**. El frontend llama a la API por el **mismo origen** (proxy de Vite en desarrollo, rewrite de Vercel en producción), así que no hace falta CORS. Contraseña del operario con **argon2**; PIN del repartidor con **HMAC-SHA256** y clave en el `.env`; límite de intentos con `@nestjs/throttler`.

### A-1 · Login del operario (backend)
- **Depende de:** T-00 · **Bloquea:** A-3, A-4
- **Qué hacer:** tabla `Operario` y tabla de refresh tokens (diseño de Salvador). Endpoints `POST /api/auth/operario/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`. Script para crear el primer operario (no hay registro público).
- **Criterios de aceptación:**
  - [ ] Login correcto setea las cookies; incorrecto responde 401 sin decir si falló el usuario o la contraseña.
  - [ ] La contraseña se guarda solo como hash argon2 (RNF-02).
  - [ ] `refresh` emite un access token nuevo solo si el refresh token existe, no venció y el usuario sigue activo.
  - [ ] `logout` revoca el refresh token.
  - [ ] Tests unitarios del servicio de auth.

### A-2 · Login del repartidor por PIN (backend)
- **Depende de:** A-1 · **Bloquea:** C-1 (generación de PIN), A-4
- **Qué hacer:** columnas de PIN en `Repartidor` (HMAC, único). `POST /api/auth/repartidor/login` con `{ pin }`. Servicio exportado `generarPin()` que devuelve un PIN nuevo de 4 dígitos que no esté en uso. C-1 lo usa en el alta y en el reseteo.
- **Criterios de aceptación:**
  - [ ] El PIN nunca se guarda en texto plano.
  - [ ] Más de 5 intentos fallidos por minuto desde la misma IP responden 429.
  - [ ] Un repartidor inactivo (`activo = false`) no puede loguearse.

### A-3 · Guards, roles y protección de endpoints (backend)
- **Depende de:** A-1, A-2 · **Se mergea junto con A-4**
- **Qué hacer:** guard global que exige autenticación por defecto; decorador `@Public()` para lo abierto (health, login, seguimiento); decorador `@Roles('operario' | 'repartidor')`; decorador `@UsuarioActual()` que entrega `{ id, rol }` al controller.
- **Convención de rutas que protege:** `/api/repartidor/**` → rol repartidor; `/api/comercios`, `/api/envios`, `/api/repartidores`, `/api/flota` → rol operario; `/api/seguimiento/**` → público.
- **Criterios de aceptación:**
  - [ ] Un request sin cookie a una ruta protegida da 401; con el rol equivocado, 403.
  - [ ] Todos los controllers existentes tienen su `@Roles` o `@Public`. Se coordina con cada frente.

### A-4 · Login y sesión en el frontend
- **Depende de:** A-1, A-2, F-1
- **Qué hacer:** pantallas `/operario/login` (usuario y contraseña) y `/repartidor/login` (teclado numérico grande, PIN enmascarado). Contexto de sesión, rutas protegidas por rol y refresh automático ante un 401. Proxy `/api` en `vite.config.ts` y rewrite en `vercel.json`; `shared/api.ts` pasa a usar rutas relativas y `credentials: 'include'`.
- **Criterios de aceptación:**
  - [ ] Entrar a `/operario/...` sin sesión redirige al login del operario (y lo mismo para el repartidor).
  - [ ] Al vencer el access token, la app lo renueva sola sin sacar al usuario.
  - [ ] El PIN y la contraseña se ven como `••••` (RNF-02).

## Frente B — Comercios y envíos (operario)

### B-1 · ABM de comercios (backend)
- **Depende de:** T-00 · **Épica:** 1.2
- **Qué hacer:** módulo `comercios` con controller, service y repository. `GET /api/comercios` (con filtro `?q=` por nombre), `GET /api/comercios/:id`, `POST /api/comercios`, `PATCH /api/comercios/:id`, `DELETE /api/comercios/:id` (baja lógica: `activo = false`). DTOs con class-validator. El service se exporta, porque B-3 lo usa.
- **Criterios de aceptación:**
  - [ ] Validaciones: nombre, teléfono y dirección obligatorios; email con formato válido.
  - [ ] Dar de baja no borra la fila.
  - [ ] Tests unitarios del service.

### B-2 · Pantallas de comercios
- **Depende de:** B-1, F-1 · **Ruta:** `/operario/comercios`
- **Qué hacer:** listado con buscador, alta y edición en formulario (incluye los checkboxes "exige foto" y "exige DNI"), y botón de baja con confirmación.
- **Criterios de aceptación:**
  - [ ] Los errores de validación del backend se muestran junto al campo correspondiente.

### B-3 · Registro de envío (backend)
- **Depende de:** B-1 · **Bloquea:** B-5, D-1 · **Épica:** 1.1
- **Qué hacer:** `POST /api/envios`. El body trae comercio, destino, datos opcionales del destinatario, tamaño y observaciones. El service:
  1. Valida que el comercio exista y esté activo.
  2. Calcula `vehiculoRequerido` según el tamaño.
  3. Usa como origen la dirección del comercio, salvo que venga otra.
  4. Copia `requiereFoto` y `requiereDni` del comercio.
  5. Genera `codigoSeguimiento`: 10 caracteres de `crypto.randomInt` sobre el alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sin 0/O/1/I).
  6. Crea el `EventoEnvio` `CREADO`.
  7. Llama a `AsignacionService.asignar(envioId)`. Mientras D-1 no exista, deja un `// TODO(D-1)`.
- **Criterios de aceptación:**
  - [ ] El envío nace en `PENDIENTE` con su evento `CREADO`.
  - [ ] El código de seguimiento es único (si choca, se genera otro).
  - [ ] Tests unitarios: correspondencia tamaño → vehículo y comercio inactivo → error 400.

### B-4 · Listado, búsqueda y detalle de envíos (backend)
- **Depende de:** B-3 · **Épicas:** 1.1, 1.3
- **Qué hacer:** `GET /api/envios` con filtros `estado`, `comercioId`, `desde`, `hasta`, `q` (código o destinatario) y paginación. `GET /api/envios/:id` con comercio, repartidor, ofertas e historial de eventos. `POST /api/envios/:id/cancelar` (solo si no está `ENTREGADO`; crea evento).
- **Criterios de aceptación:**
  - [ ] El detalle incluye los eventos ordenados por fecha.
  - [ ] Cancelar un envío entregado da 409.

### B-5 · Panel del operario y pantallas de envíos
- **Depende de:** B-3, B-4, F-1 · **Rutas:** `/operario/envios`, `/operario/envios/nuevo`, `/operario/envios/:id`
- **Qué hacer:** formulario de alta (comercio con buscador, destino, destinatario, tamaño, observaciones), que al guardar muestra el código y el link de seguimiento para copiar. Panel con pestañas "Pendientes" / "En curso" / "Finalizados", que se actualiza cada 15 s (polling) y resalta los pendientes sin asignar. Detalle con línea de tiempo de eventos y botón "Cancelar".
- **Criterios de aceptación:**
  - [ ] El link de seguimiento se copia con un clic.
  - [ ] El panel refleja cambios de estado sin recargar la página.

## Frente C — Repartidores y jornada

### C-1 · ABM de repartidores (backend)
- **Depende de:** T-00 (y A-2 para el PIN) · **Épica:** 3.1
- **Qué hacer:** `GET/POST/PATCH/DELETE /api/repartidores` (baja lógica). El alta devuelve el **PIN una única vez** en la respuesta, usando `generarPin()` de A-2; mientras A-2 no esté, se deja un `// TODO(A-2)`. `POST /api/repartidores/:id/resetear-pin` devuelve un PIN nuevo, también una sola vez. Al dar de baja, si tiene un viaje activo responde 409.
- **Criterios de aceptación:**
  - [ ] Ningún `GET` devuelve el PIN ni su hash.
  - [ ] Tests unitarios del service.

### C-2 · Pantallas de gestión de repartidores
- **Depende de:** C-1, F-1 · **Ruta:** `/operario/repartidores`
- **Qué hacer:** listado (nombre, vehículo, estado, activo), alta y edición, baja con confirmación, y "Resetear PIN". El PIN se muestra **una sola vez** en un modal con el aviso "anotalo y entregáselo al repartidor; no se vuelve a mostrar".
- **Criterios de aceptación:**
  - [ ] Al cerrar el modal, el PIN no se puede volver a ver.

### C-3 · Jornada y cola FIFO (backend)
- **Depende de:** T-00 · **Bloquea:** D-1 · **Épica:** 3.1
- **Qué hacer:** endpoints del propio repartidor:
  - `POST /api/repartidor/jornada/iniciar`: pasa a `DISPONIBLE` con `enColaDesde = ahora` y dispara `AsignacionService.reintentarPendientes()`.
  - `POST /api/repartidor/jornada/pausar`: pasa a `EN_PAUSA` y sale de la cola.
  - `POST /api/repartidor/jornada/reanudar`: vuelve a la cola, al final.
  - `POST /api/repartidor/jornada/terminar`: pasa a `FUERA_DE_JORNADA`; no se permite con un viaje activo.
  - `GET /api/flota` (operario): repartidores en jornada agrupados por vehículo y ordenados por la cola.
  - Mientras no exista A-3, el repartidor se identifica con un header temporal `X-Repartidor-Id`, que se elimina en A-3.
- **Criterios de aceptación:**
  - [ ] Las transiciones inválidas (por ejemplo, pausar estando fuera de jornada) responden 409.
  - [ ] `GET /api/flota` refleja el orden FIFO real.

### C-4 · Pantallas de jornada y flota
- **Depende de:** C-3, F-1 · **Rutas:** `/repartidor` (inicio), `/operario/flota`
- **Qué hacer:** en el inicio del repartidor, el estado actual en grande y botones grandes "Iniciar jornada" / "Pausar" / "Reanudar" / "Terminar jornada" (RNF-10: alto contraste, máximo 2 toques). En la flota del operario, tres columnas (Moto, Auto, Camión) con la cola en orden, actualizadas cada 15 s.
- **Criterios de aceptación:**
  - [ ] Se usa cómodamente en un celular de 360 px de ancho.

## Frente D — Motor de asignación y ofertas

> Es el corazón del sistema y lo más delicado (riesgos 7 y 8 del PGP). Los PRs de este frente los revisa Salvador.

### D-1 · Motor de asignación (backend)
- **Depende de:** T-00, C-3 · **Épica:** 3.2 · **RNF-12:** menos de 3 segundos
- **Qué hacer:** `AsignacionService.asignar(envioId)` y `AsignacionService.reintentarPendientes()`. Dentro de **una transacción** (`prisma.$transaction`):
  1. Buscar el primer repartidor con `estado = DISPONIBLE`, `vehiculo = envio.vehiculoRequerido` y `activo`, que no tenga una oferta `PENDIENTE` y que no haya rechazado ni dejado vencer una oferta de **este** envío. Orden: `enColaDesde ASC`. Bloquear la fila con `FOR UPDATE SKIP LOCKED` (SQL a mano con `tx.$queryRaw`).
  2. Si tiene `viajesConsecutivos >= 2`: ponerlo en 0, mandarlo al final de la cola y probar con el siguiente (supuesto 5).
  3. Crear la `Oferta` con `expiraEn = ahora + 5 min`.
  4. Si no hay candidato, no hacer nada: el envío queda `PENDIENTE` (supuesto 6).
- **Criterios de aceptación:**
  - [ ] Tests unitarios de las reglas: filtro por vehículo, orden FIFO, regla de 2 consecutivos, exclusión de quien rechazó.
  - [ ] Test e2e de concurrencia: 2 envíos de moto simultáneos con 1 solo repartidor de moto generan 1 sola oferta.
  - [ ] Los tiempos de espera (5 min) y el límite de consecutivos son constantes configurables.

### D-2 · Aceptar y rechazar ofertas (backend)
- **Depende de:** D-1 · **Épica:** 3.3
- **Qué hacer:**
  - `GET /api/repartidor/ofertas/actual`: la oferta vigente, con los datos del envío y los segundos restantes.
  - `POST /api/repartidor/ofertas/:id/aceptar`: oferta `ACEPTADA`, envío `ASIGNADO` con `repartidorId`, repartidor `OCUPADO` y fuera de la cola, más el evento correspondiente.
  - `POST /api/repartidor/ofertas/:id/rechazar`: oferta `RECHAZADA`, el repartidor va al final de la cola y se llama a `asignar(envioId)` para el siguiente.
  - Todo en transacciones.
- **Criterios de aceptación:**
  - [ ] No se puede responder una oferta ajena (403), ya respondida (409) ni vencida (409).

### D-3 · Vencimiento de ofertas y reintentos (backend)
- **Depende de:** D-2 · **Épica:** 3.3 · **RNF-08**
- **Qué hacer:** job con `@nestjs/schedule` que corre cada 10 s:
  1. Toma las ofertas `PENDIENTE` con `expiraEn < ahora`, las marca `VENCIDA`, pone al repartidor `EN_PAUSA` (supuesto 4) y reasigna el envío.
  2. Llama a `reintentarPendientes()` para los envíos `PENDIENTE` sin oferta vigente.
- **Criterios de aceptación:**
  - [ ] Si el servidor se reinicia con ofertas vencidas, se procesan al volver. El vencimiento vive en la base, **no** en un `setTimeout`.
  - [ ] Dos ejecuciones superpuestas del job no procesan dos veces la misma oferta.

### D-4 · Pantalla de oferta del repartidor
- **Depende de:** D-2, F-1 · **Ruta:** dentro de `/repartidor`
- **Qué hacer:** consultar `ofertas/actual` cada 10 s. Si hay oferta, mostrar una tarjeta a pantalla completa con origen, destino, tamaño, cuenta regresiva y dos botones enormes "Aceptar" / "Rechazar".
- **Criterios de aceptación:**
  - [ ] La cuenta regresiva no se reinicia al recargar la página: se calcula con `expiraEn`.
  - [ ] Al aceptar, se pasa a la pantalla del viaje (E-3).

## Frente E — Ejecución de entregas

### E-1 · Máquina de estados del envío (dominio)
- **Depende de:** T-00 · **Bloquea:** E-2 · **Archivo:** `is-backend/src/modules/envios/domain/estado-envio.ts`
- **Qué hacer:** función pura (sin base de datos ni HTTP) que, dado un estado actual, un estado destino y un actor, diga si la transición es válida. Las transiciones son:

  | De | A | Quién |
  |---|---|---|
  | PENDIENTE | ASIGNADO | SISTEMA (al aceptar una oferta) |
  | ASIGNADO | EN_CAMINO_A_RETIRAR | REPARTIDOR |
  | EN_CAMINO_A_RETIRAR | RETIRADO | REPARTIDOR |
  | RETIRADO | EN_DOMICILIO | REPARTIDOR |
  | EN_DOMICILIO | ENTREGADO | REPARTIDOR |
  | cualquiera salvo ENTREGADO o CANCELADO | CANCELADO | OPERARIO |

  Exportar también `siguienteEstado(estado)` para el botón "siguiente" del repartidor.
- **Criterios de aceptación:**
  - [ ] Tests unitarios que cubran **todas** las transiciones válidas y varias inválidas.

### E-2 · Endpoints del viaje (backend)
- **Depende de:** E-1, D-2 · **Épica:** 4.1, 4.2
- **Qué hacer:**
  - `GET /api/repartidor/viajes/actual`: el envío activo con origen, destino, destinatario, observaciones y requisitos de evidencia.
  - `POST /api/repartidor/viajes/actual/avanzar`: aplica `siguienteEstado` validando con E-1 y crea el evento.
  - Al llegar a `ENTREGADO`: el repartidor vuelve a `DISPONIBLE` al final de la cola, suma 1 a `viajesConsecutivos` y se llama a `AsignacionService.reintentarPendientes()`.
  - Va en `viajes.controller.ts`, `viajes.service.ts`, etc. dentro del módulo `envios`, para no pisarse con B.
- **Criterios de aceptación:**
  - [ ] Un repartidor no puede avanzar un envío que no es suyo.
  - [ ] Todo avance queda en `EventoEnvio` con `actorTipo = REPARTIDOR`.

### E-3 · Pantalla del viaje activo
- **Depende de:** E-2, F-1 · **Ruta:** `/repartidor/viaje`
- **Qué hacer:** datos del viaje en letra grande (dirección de retiro o de entrega según la etapa, destinatario y observaciones) y **un** botón enorme con la próxima acción ("Llegué al comercio", "Paquete retirado", "Llegué al domicilio", "Entregado"), con confirmación. Son 2 toques en total (RNF-10).
- **Criterios de aceptación:**
  - [ ] Legible a pleno sol: alto contraste, texto de 18 px o más.
  - [ ] Después de "Entregado" vuelve al inicio del repartidor.

## Frente F — Base del frontend, seguimiento, datos de prueba y deploy

### F-1 · Esqueleto del frontend (layouts, componentes y rutas) ✅ hecha
- **Depende de:** nada · **Bloquea:** todas las pantallas · **Mergeada el 15/10.** Cada página vacía indica en un comentario qué tarea la completa; los componentes se ven en `/dev/ui`.
- **Qué hacer:**
  - `shared/layouts/OperarioLayout.tsx` (menú lateral: Envíos, Comercios, Repartidores, Flota, Excepciones).
  - `shared/layouts/RepartidorLayout.tsx` (móvil, alto contraste).
  - `shared/ui/`: `Boton`, `BotonGrande`, `Campo`, `Selector`, `Tabla`, `Modal`, `EtiquetaEstado` (color por estado de envío).
  - **Crear todas las rutas y páginas vacías** listadas en este archivo, con un "En construcción", así cada frente solo edita su página y nadie tiene que tocar `router.tsx` en paralelo.
- **Criterios de aceptación:**
  - [ ] Todas las rutas navegan.
  - [ ] Los componentes tienen una página de muestra en `/dev/ui` (solo en desarrollo).

### F-2 · Datos de prueba (seed)
- **Depende de:** T-00
- **Qué hacer:** `is-backend/prisma/seed.ts` y el script `npm run db:seed`. Carga 5 comercios (con distintos requisitos de evidencia), 9 repartidores (3 por vehículo) y 15 envíos en distintos estados con sus eventos. Cuando A-1 y A-2 estén, suma un operario de prueba y PINs conocidos para los repartidores.
- **Criterios de aceptación:**
  - [ ] Se puede correr dos veces seguidas sin error (borra y recrea).

### F-3 · Seguimiento público (backend)
- **Depende de:** T-00 · **Épicas:** 2.1, 2.3, 2.5
- **Qué hacer:** `GET /api/seguimiento/:codigo` (público). Devuelve el estado actual, la línea de tiempo (eventos de cambio de estado con fecha y hora), la hora de salida (supuesto 7) y el comercio.
  - **Enmascarado (épica 2.5):** del destinatario solo el nombre y la inicial del apellido; de la dirección, sin altura; nunca el DNI ni el teléfono.
  - Código inexistente → 404. Límite de 30 requests por minuto por IP.
- **Criterios de aceptación:**
  - [ ] Tests unitarios del enmascarado.

### F-4 · Pantalla de seguimiento
- **Depende de:** F-3, F-1 · **Rutas:** `/seguimiento` (ingresar código), `/seguimiento/:codigo`
- **Qué hacer:** línea de progreso con los 6 estados, horas de cada paso y un mensaje claro si el código no existe. Responsive (RNF-11). Se actualiza cada 60 s.
- **Criterios de aceptación:**
  - [ ] Se ve bien en celular, tablet y computadora.

### F-5 · Deploy de prueba (staging)
- **Depende de:** nada para empezar; antes del **27/10** tiene que estar andando con lo que haya en `dev`.
- **Qué hacer:**
  - **Supabase:** proyecto nuevo; anotar la URL de conexión.
  - **Railway:** servicio desde `is-backend/Dockerfile` con las variables `DATABASE_URL`, `PORT`, los secretos de A, `FRONTEND_URL` y healthcheck en `/api/health`.
  - **Vercel:** raíz `is-frontend`, con rewrite de `/api/*` hacia Railway.
  - Documentar todo en el README. Para conectar Railway y Vercel con el repo hace falta Salvador (dueño del repo).
- **Criterios de aceptación:**
  - [ ] La página de inicio desplegada muestra "API: ok · base ok".

---

# Demo 2 (20/11)

Estas tareas siguen el mismo formato. Se detallan más cuando se acerque el hito.

### A-5 · Inactividad y revocación (RNF-04)
Sesión del operario: se corta a los 30 minutos sin actividad (el refresh token se extiende con cada uso). Al dar de baja a un repartidor se revocan sus refresh tokens.

### A-6 · Auditoría (RNF-03)
Verificar que **toda** acción importante (cancelar, reasignar, cambiar estado, alta y baja) quede en `EventoEnvio` u otra tabla de auditoría con actor y hora. Agregar una pantalla de historial por envío y por repartidor.

### A-7 · Cifrado de datos sensibles (RNF-01)
Cifrar en la base el DNI, el nombre y la dirección del destinatario. El código de seguimiento pasa a guardarse como HMAC, igual que el PIN. Evaluar el impacto en las búsquedas de B-4.

### B-6 · Panel de excepciones
`/operario/excepciones`: envíos sin candidatos, incidentes que no se pudieron reasignar y novedades sin resolver. Acciones: reasignar manualmente a un repartidor elegido, cancelar, o reprogramar. Épica 5.3.

### C-5 · Botón de emergencia y reasignación automática (RNF-13: menos de 5 s)
Botón "Auxilio" en la app del repartidor: pasa a `EMERGENCIA`, su envío activo vuelve al motor con el **origen actualizado** a la ubicación informada y se ofrece a otro repartidor del mismo vehículo. Si no hay candidato, va al panel de excepciones. Épicas 5.1 y 5.2 (coordinar con D).

### D-5 · Historial de respuestas por repartidor
Vista para el operario con las ofertas aceptadas, rechazadas y vencidas por repartidor, con tiempos de respuesta. Épica 3.4.

### D-6 · Contingencia sin motos (riesgo 11)
Opción que el operario puede activar para que los paquetes chicos también se ofrezcan a autos cuando la cola de motos está vacía.

### E-4 · Evidencia de entrega (foto y DNI)
Antes de `ENTREGADO`, pedir lo que el envío exige: foto con la cámara (con vista previa y opción de repetirla; riesgo 14) subida a Supabase Storage, DNI del receptor, o ambas. Épica 4.3.

### E-5 · Novedades en ruta
Botón "Reportar novedad" con opciones rápidas ("Cliente ausente", "Dirección incorrecta", "Demorado") y un comentario corto. Crea un evento `NOVEDAD`, la novedad aparece en el panel del operario y en el seguimiento (épica 2.6). Épica 4.4.

### F-6 · Ventana estimada de entrega
En el seguimiento, mostrar un rango estimado de llegada a partir de la hora de salida, con una duración configurable. Épica 2.4.

### Q-1 · Pruebas de aceptación y rendimiento
Guion de demo con los casos de aceptación de cada épica. Prueba de carga del motor con más de 50 envíos simultáneos para verificar RNF-12 y RNF-13 (riesgo 8). Prueba en celulares reales con Safari y Chrome (riesgo 18).

---

# Fase 2 (27/11)

### G-1 · Rendición de cierre de jornada
El repartidor pide el cierre y declara entregados vs. paquetes a devolver; el operario valida antes de cerrar el turno. Épica 6.1.

### G-2 · Custodia en depósito
El operario registra el reingreso de cada paquete no entregado escaneando o tipeando el código, con fecha, hora y responsable. Alertas para paquetes con más de 24 h en custodia. Épica 6.2, riesgos 16 y 17.

### G-3 · Devoluciones a comercios
Agrupar los paquetes en custodia por comercio y generar una orden de devolución, que el motor asigna como un viaje más. El repartidor registra la constancia de recepción. Épica 6.3.
