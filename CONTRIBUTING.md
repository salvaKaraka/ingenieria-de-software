# Cómo trabajamos

Guía para los 6 integrantes. Si es tu primera vez con Git, ramas o Pull Requests, leela entera: está pensada para eso.

- Cómo levantar el proyecto: [README.md](README.md)
- Qué hay que hacer: [TAREAS.md](TAREAS.md)
- Reglas para asistentes de IA (y buenas prácticas de código): [AGENTS.md](AGENTS.md)

---

## 1. Antes de empezar una tarea

1. Elegí una tarea de [TAREAS.md](TAREAS.md) de **tu frente**. Fijate que lo que figura en "Depende de" ya esté mergeado en `dev`.
2. **Avisá en el grupo** qué tarea tomás, con su ID (por ejemplo: "Arranco B-3"). Movela en Taiga a "En progreso".
3. Si tenés dudas sobre qué hay que hacer, preguntá **antes** de programar. Rehacer cuesta más que preguntar.

## 2. Ramas

```
main      ← lo que se muestra en las demos. Protegida.
 └── dev  ← integración del día a día. Protegida. Rama por defecto.
      └── feature/B-3-registro-envio  ← tu rama, una por tarea
```

- **Nunca** se trabaja directo en `main` ni en `dev`; GitHub tampoco lo permite.
- El nombre de la rama lleva el ID de la tarea: `feature/<ID>-<descripcion-corta>`. Para arreglar un error: `fix/<descripcion>`.

Para crear tu rama:
```bash
git checkout dev
git pull                                 # traé lo último de dev
git checkout -b feature/B-3-registro-envio
```

## 3. Mientras trabajás

**Commiteá seguido**, cada vez que algo funcione aunque sea a medias:
```bash
git status                               # mirá qué cambió ANTES de agregar
git add <archivos>                       # o `git add .` si revisaste que no haya nada raro
git commit -m "Agregar validación de comercio activo al crear envío"
git push -u origin feature/B-3-registro-envio   # la primera vez; después alcanza con `git push`
```

Los mensajes de commit **dicen qué cambia**, en infinitivo y en español. Evitá cosas como "cambios", "fix" o "ahora sí".

**Traé `dev` a tu rama al menos una vez por día**, para no quedarte desactualizado:
```bash
git checkout dev && git pull
git checkout feature/B-3-registro-envio
git merge dev
```
Si aparecen **conflictos**, no entres en pánico: Git marca en los archivos las dos versiones (`<<<<<<<` / `=======` / `>>>>>>>`). Elegí con qué quedarte, borrá las marcas, y después `git add` + `git commit`. Si no estás seguro, pedí ayuda en el grupo **antes** de pushear.

## 4. Pull Request (PR)

Cuando la tarea cumple **todos** sus criterios de aceptación:

1. Corré los chequeos en tu máquina. Si fallan acá, también van a fallar en GitHub.
   ```bash
   cd is-backend  && npm run lint && npm test && npm run build
   cd is-frontend && npm run lint && npm run build
   ```
2. En GitHub, abrí un PR **hacia `dev`** (no hacia `main`) y completá la plantilla.
3. **Avisá en el grupo** que tu PR está listo para revisar.
4. Para mergear hacen falta:
   - ✅ **CI en verde**: GitHub corre lint, tests y build solo.
   - ✅ **Una aprobación** de otro integrante. Los PRs con lógica de backend (frentes A, D y E) los revisa Salvador.
5. Si te piden cambios, los hacés en la misma rama y pusheás: el PR se actualiza solo.
6. Para mergear, usá **"Squash and merge"**, que junta todos tus commits en uno. Después borrá la rama (GitHub ofrece el botón).

Un PR = una tarea. Los PRs chicos se revisan rápido; los gigantes se traban.

## 5. Revisar el PR de otro

Revisar es parte del trabajo, no un favor. Al revisar:
- Bajá la rama y **probala**: `git fetch && git checkout <rama>`.
- Fijate que cumpla los criterios de aceptación de la tarea en TAREAS.md.
- Preguntá lo que no entiendas. Si vos no lo entendés, en la demo tampoco lo va a poder explicar quien lo escribió.
- Pedí cambios con respeto y explicando por qué.

## 6. Cambios en la base de datos (`schema.prisma`)

El schema es **un archivo compartido por todos**, así que tiene reglas propias:

1. **Avisá en el grupo** antes de cambiar `is-backend/prisma/schema.prisma`.
2. Creá la migración con un nombre descriptivo: `npm run db:migrate -- --name agregar_novedades`.
3. Commiteá **juntos** el schema y la carpeta nueva de `prisma/migrations/`.
4. Nunca edites una migración que ya está mergeada en `dev`. Si hace falta corregir algo, se crea una migración nueva.
5. Cuando alguien mergea un cambio de schema, todos los demás corren `npm run db:deploy` después de traer `dev`.
6. Si Prisma te dice que tu base local quedó desincronizada y ofrece resetearla, podés aceptar: son datos de prueba. Después corré `npm run db:seed`.

## 7. Usar IA (ChatGPT, Gemini, Copilot, Cursor, etc.)

Se puede y se recomienda, con estas reglas:
- **Sos responsable de todo lo que commiteás.** Si no entendés una línea, preguntale a la IA qué hace hasta entenderla. En las demos te pueden pedir que expliques tu código.
- Pasale a la IA el archivo [AGENTS.md](AGENTS.md) y la tarea de TAREAS.md. Muchas herramientas leen `AGENTS.md` solas.
- **Nunca** pegues en una IA el contenido de un `.env`, contraseñas o claves.
- No dejes que la IA toque archivos fuera de tu tarea, ni que instale dependencias o cambie configuraciones sin que lo hables en el grupo.

## 8. Reglas de oro

- 🔒 Nunca subas archivos `.env`. Si agregás una variable nueva, agregala a `.env.example` con un valor de ejemplo.
- 🗣️ Avisá en el grupo qué tomás, cuándo abrís un PR y si te trabás. Trabarse un día sin decir nada es lo peor que puede pasar.
- 🧩 Tocá solo los archivos de tu tarea. Si necesitás algo de otro frente, hablalo con esa persona.
- ✅ Si el CI está en rojo, no se mergea.
