# Guion de la Demo 1 (30/10)

Un solo recorrido que pasa por todas las historias del Sprint 1, en el orden en que se usan de verdad: el operario prepara comercios y repartidores, carga envíos, los repartidores los llevan y el destinatario los sigue. Dura unos **45 minutos**.

Cada paso dice **quién** lo hace, **qué** tiene que tocar, **qué** tiene que verse y **a qué HU** (número de Taiga) corresponde. En la [tabla del final](#cobertura-por-historia-de-usuario) está cada HU con los pasos donde aparece.

> Ensayado de punta a punta contra la API el 28/10 con estos datos: todos los pasos dan el resultado que dice el guion, incluido el vencimiento real de la oferta a los 5 minutos.

---

## Antes de la demo

### 1. Código

- [ ] Mergear el **#52** (HU #10) en `dev` y publicar `dev` en `main`. Sin el #52 el paso 9.4 funciona, pero no aparece el aviso "Asignación por excepción".
- [ ] El **#54** (HUs #35 y #36) **no** entra: es del Sprint 2.

### 2. Cargar los datos en Supabase

Esto **borra todo** y carga los datos de la demo. Hay que hacerlo de nuevo después de cada ensayo.

**Opción A: desde Supabase (la más simple)**
1. Abrir el **SQL Editor** del proyecto y pegar el contenido de [`is-backend/src/scripts/seed-demo.sql`](../is-backend/src/scripts/seed-demo.sql).
2. Reemplazar `PEGAR_ACA_EL_PIN_SECRET` por el `PIN_SECRET` de Render (servicio del backend → Environment). Tiene que ser **el de Render**: si no, los PINs no funcionan en la app publicada.
3. **Run**. El resultado es una tabla con los PINs y los códigos de seguimiento de los envíos de ayer. **Guardarla.**
4. Volver a poner `PEGAR_ACA_EL_PIN_SECRET` en la query, o borrar la pestaña: Supabase guarda las queries del editor.

**Opción B: con el script de Node** (los mismos datos)
1. Crear `is-backend/.env.supabase` (git lo ignora, **no se sube**) con `DATABASE_URL`, `JWT_SECRET` y `PIN_SECRET` copiados de Render, más `SEED_EN_STAGING=si` y `DESACTIVAR_JOBS=true`.
2. Correr `cd is-backend && npm run build && node --env-file=.env.supabase dist/scripts/seed-demo`. La primera línea dice en qué base va a cargar los datos: tiene que decir `supabase`.

### 3. Qué deja cargado

| | Datos |
|---|---|
| Operario | usuario `admin`, contraseña `admin1234` (se llama Ana Pérez) |
| Comercios | Kiosco Don Pepe (sin evidencia), Librería del Bosque (foto), Farmacia Plaza Moreno (DNI), Ferretería La Tuerca (foto y DNI), Heladería Polo Norte (sin envíos, para darla de baja) |
| Repartidores | **1111** Lucas Gómez, moto, 2 viajes seguidos · **2222** Sofía Díaz, moto · **3333** Mateo Ruiz, moto, 2 viajes seguidos · **4444** Valentina López, auto · **5555** Tomás Pérez, auto, **dado de baja** · **6666** Juan Romero, camión · **7777** Martina Álvarez, camión, **en emergencia** |
| Envíos | 8 de ayer, todos terminados (7 entregados y 1 cancelado). El de **Carlos Medina** tiene el historial completo: oferta vencida, oferta rechazada y entrega con DNI. Hoy no hay ninguno: se cargan en vivo |

Martina está en emergencia para que la flota la muestre destacada: el botón de emergencia es de la Demo 2 (HU #20).

### 4. Dispositivos y roles

| Quién | Dispositivo | Entra como |
|---|---|---|
| Presentador | Compu con proyector, ventana normal | Operario |
| Presentador | Misma compu, **ventana de incógnito** | Destinatario. También Tomás en el paso 10.2 |
| Integrante 1 | Celular | Sofía (2222) |
| Integrante 2 | Celular | Santiago, el repartidor que se crea en vivo |
| Integrante 3 | Celular | Lucas (1111) |
| Integrante 4 | Celular | Valentina (4444) |
| Integrante 5 | Celular | Juan (6666) |
| Integrante 6 | Celular | Mateo (3333) |

Cada sesión necesita su propio navegador: el operario y un repartidor no pueden estar en la misma ventana.

### 5. Justo antes de empezar (después de cargar los datos)

- [ ] Abrir `https://ingenieria-de-software-seven.vercel.app` y esperar a que cargue. Render se duerme a los 15 minutos sin uso y tarda cerca de 1 minuto en despertar. Mientras el panel del operario esté abierto, no se duerme.
- [ ] **Los repartidores del seed entran antes**: Lucas, Sofía, Valentina, Juan y Mateo ingresan su PIN y se quedan en "Fuera de jornada". **No tocar "Iniciar jornada" todavía.**
- [ ] El login acepta **5 intentos por minuto por IP**, y todos los celulares en el mismo Wi-Fi comparten IP. Entrar de a 4 por minuto, o usar datos móviles. Si aparece "Demasiados intentos", esperar un minuto.
- [ ] No tocar el menú **Excepciones**: es de la Demo 2 (HU #22) y dice "en construcción".
- [ ] La app del repartidor se actualiza cada 10 segundos y el panel del operario, cada 15. Después de cada acción, esperar a que se refresque antes de comentar.

### Datos para tener a mano

| Para | Dato |
|---|---|
| Comercio nuevo (paso 2.2) | Pizzería Los Hijos · Calle 7 880 · 221 455-1234 · pizzeria@example.com · **Foto y DNI** |
| DNI repetido (paso 3.3) | 30.000.002 (es el de Sofía) |
| Repartidor nuevo (paso 3.3) | Santiago Ferreyra · moto · DNI 35.123.456 · tel. 221 555-7788 · santi@example.com · Calle 13 456 |
| Envío que vence (paso 5.1) | Kiosco Don Pepe · Calle 60 450 · Elena Ruiz · tel. 221 600-2222 · **Mediano** |
| Envío 1 (paso 5.3) | Pizzería Los Hijos · Calle 50 1234, 2° A · Juan Pérez · tel. 221 600-1234 · **DNI 28.555.444** · Chico · obs. "Tocar timbre 2A" |
| DNI incorrecto (paso 6.9) | 28.555.445 |
| Envío 3 (paso 8.1) | Kiosco Don Pepe · Calle 9 300 · Pedro Gil · tel. 221 600-3333 · Chico |
| Envío 4 (paso 9.4) | Kiosco Don Pepe · Calle 2 150 · Rosa Luna · tel. 221 600-4444 · Chico |

---

## Recorrido

### Bloque 1 · Ingreso del operario (2 min)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 1.1 | Operario | Sin haber iniciado sesión, abrir `/operario/envios` | Redirige a la pantalla de inicio de sesión | #3 |
| 1.2 | Operario | Usuario `noexiste` → **Ingresar**. Después `admin` con una contraseña incorrecta → **Ingresar** | Las dos veces: "Los datos ingresados no son correctos." sin salir de la pantalla | #3 |
| 1.3 | Operario | `admin` / `admin1234` → **Ingresar** | Panel de envíos | #3 |

### Bloque 2 · Comercios (5 min)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 2.1 | Operario | **Comercios**. Buscar "far" | Solo Farmacia Plaza Moreno. La columna Evidencia muestra qué exige cada comercio (Foto, DNI, Foto + DNI, Ninguna) | #1 |
| 2.2 | Operario | **+ Nuevo Comercio** con Pizzería Los Hijos, marcar **foto y DNI** → **Guardar Comercio** | "Comercio registrado exitosamente". Aparece con evidencia "Foto + DNI" | #1 |
| 2.3 | Operario | **+ Nuevo Comercio** con nombre "kiosco don pepe" (en minúsculas) | "El comercio ya se encuentra registrado" y no se crea | #1 |
| 2.4 | Operario | **Editar** Librería del Bosque: desmarcar foto, marcar DNI → **Guardar Comercio** | Evidencia "DNI". Sus envíos anteriores siguen exigiendo foto: se ve en el detalle del envío de Laura Méndez (Envíos → Finalizados) | #32 |
| 2.5 | Operario | **Editar** Librería del Bosque y ponerle de nombre "Farmacia Plaza Moreno" → **Guardar Comercio** | "El comercio ya se encuentra registrado" y conserva su nombre | #32 |
| 2.6 | Operario | **Dar de Baja** Heladería Polo Norte y confirmar | Desaparece de la lista y del formulario de envíos | #32 |

La baja **fallida** (comercio con envíos en curso) va en el paso 6.5, cuando ya hay un envío en viaje.

### Bloque 3 · Repartidores (6 min)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 3.1 | Operario | **Repartidores** | DNI enmascarado (•••••001). Tomás figura **Inactivo** y solo tiene **Reactivar**: no hay "Resetear PIN" para un inactivo | #6, #7, #69 |
| 3.2 | Operario | **+ Nuevo repartidor** con los datos de Santiago, pero DNI **30.000.002** → **Crear repartidor** | "El repartidor ya se encuentra registrado" | #6 |
| 3.3 | Operario | Corregir el DNI a **35.123.456** → **Crear repartidor** | Ventana "PIN de acceso asignado" con el PIN. **El integrante 2 lo anota**: se muestra una sola vez. Santiago queda "Fuera de jornada" | #6, #7 |
| 3.4 | Operario | **Reactivar** a Tomás y confirmar | Vuelve a activo, "Fuera de jornada", y se muestra su PIN nuevo | #69 |
| 3.5 | Operario | **Resetear PIN** de Tomás y confirmar. **Anotar el PIN** (se usa en 10.2) | PIN nuevo. El anterior deja de servir | #7 |

### Bloque 4 · Jornada y flota (5 min)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 4.1 | Santiago | En el celular, abrir `/repartidor/login` y tipear un PIN equivocado; después, el suyo | Puntos en lugar de dígitos. Con el equivocado: "PIN incorrecto" y se borra. Con el suyo entra solo al cuarto dígito y ve "Fuera de jornada" con **Iniciar jornada**. Entrar no lo pone en la cola | #67, #7 |
| 4.2 | Lucas, Sofía, Santiago, Valentina | **Iniciar jornada en este orden**, de a uno | Cada uno pasa a "Disponible". **El orden importa**: es el orden de la cola | #8 (S2, ya funciona) |
| 4.3 | Operario | **Flota** | Motos: cola #1 Lucas ("2 viajes seguidos"), #2 Sofía, #3 Santiago. Autos: Valentina. Camiones: cola vacía con "No hay repartidores disponibles" y Martina destacada en rojo con 🚨 | #27 |
| 4.4 | Sofía | **Pausar** y después **Reanudar** | Al pausar sale de la cola. Al reanudar vuelve **al final**: Lucas, Santiago, Sofía. Su contador de viajes seguidos vuelve a 0 | #8, #10 |

### Bloque 5 · Envíos y ofertas (7 min)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 5.1 | Operario | **Envíos → + Registrar nuevo envío** con el envío que vence (Kiosco, **Mediano**) → **Guardar pedido** | "Pedido guardado" con su código, vehículo requerido **Auto**. **A Valentina le llega la oferta: NO la toca.** Anotar la hora: vence en 5 minutos (bloque 7) | #2 |
| 5.2 | Operario | **Repartidores → Editar** a Valentina: vehículo Auto → Moto → **Guardar cambios** | "El repartidor tiene una oferta sin responder: esperá a que la responda o venza". No cambia | #33 |
| 5.3 | Operario | Registrar el **envío 1** (Pizzería Los Hijos) primero **sin DNI** y después con DNI 28.555.444 | Sin DNI no lo guarda: el comercio lo exige. Con DNI: "Pedido guardado" con el código, vehículo **Moto** y evidencia **Foto y DNI**, heredada del comercio. **Copiar link de seguimiento** | #2, #16 |
| 5.4 | Santiago | Recibe la oferta | Tarjeta "Nuevo viaje" con retiro, entrega, tamaño y cuenta regresiva de 5 minutos. **Lucas no la recibió aunque era el primero**: tenía 2 viajes seguidos y había otra moto, así que el sistema lo salteó y lo mandó al final con el contador en 0 (se ve en Flota) | #11, #10 |
| 5.5 | Santiago | **Rechazar** | La oferta pasa a Sofía. Santiago vuelve al final de la cola | #11 |
| 5.6 | Sofía | **Aceptar** | Ve el viaje con las direcciones completas. En el panel, el envío pasa a "En curso", con Sofía como repartidor | #11 |

### Bloque 6 · El viaje, de punta a punta (9 min)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 6.1 | Destinatario | En la ventana de incógnito, pegar el link copiado en 5.3 | Estado "Asignado", historial con fecha y hora, "Tu envío todavía no salió hacia tu domicilio". Muestra "Juan P." y "Calle 50", nunca el DNI ni la dirección completa. **No pidió login** | #17, #16 |
| 6.2 | Sofía | Mirar la pantalla y abrir **Ver todos los datos del viaje** | Arriba, lo de la etapa de retiro: "Retirar en", comercio, "Después, entregar en", observaciones y "Al entregar: pedir el DNI… y sacar una foto…". En el desplegable, todo el viaje: teléfonos y código | #13 |
| 6.3 | Sofía | **Voy al comercio** → **Volver** → **Voy al comercio** → **Sí, confirmar** | "Volver" no cambia nada. Al confirmar: "Paso 2 de 4". El panel del operario lo muestra "En camino a retirar" en menos de 15 segundos | #14 |
| 6.4 | Operario | Abrir el envío 1 → **Modificar datos**: dirección de entrega "Calle 51 777" → **Guardar** | Se guarda. En el celular de Sofía aparece "⚠️ La dirección de entrega fue modificada" con la dirección nueva | #31 |
| 6.5 | Operario | **Comercios → Dar de Baja** Pizzería Los Hijos | "El comercio tiene envíos en curso" y sigue activa | #32 |
| 6.6 | Sofía | **Paquete retirado** → confirmar | Pasa a la etapa de entrega: "Entregar en" y destinatario. En el seguimiento (se actualiza cada 60 s) aparece la **hora de salida** | #14, #13, #17 |
| 6.7 | Operario | En el envío 1, **Modificar datos** | "No se puede modificar: el paquete ya fue retirado" | #31 |
| 6.8 | Sofía | **Llegué al domicilio** → confirmar. Completar solo el DNI y después solo marcar "Ya mandé la foto" | Aparecen "DNI de quien recibe" y "Ya mandé la foto". Mientras falte cualquiera de los dos, **Entregado** está deshabilitado con "Completá lo de arriba para confirmar la entrega." | #14, #19, #15 |
| 6.9 | Sofía | DNI **28555445** y foto marcada → **Entregado** → **Sí, confirmar** | "El DNI no coincide con el del destinatario". El envío sigue "En domicilio de entrega" | #19, #15 |
| 6.10 | Sofía | DNI **28555444** → **Entregado** → **Volver** → **Entregado** → **Sí, confirmar** | "Volver" no cambia nada. Al confirmar: "¡Entrega registrada! Ya estás de nuevo en la cola." En Flota, en menos de 15 segundos, Sofía queda última en la cola de motos | #15, #19, #27 |
| 6.11 | Destinatario | Recargar el seguimiento | "Entregado" con la fecha y hora de entrega | #17, #16, #15 |
| 6.12 | Operario | Abrir el envío 1 → **Historial** | En orden, con fecha, hora y responsable: Envío registrado (Operario Ana Pérez) → Oferta enviada a Santiago (Sistema) → Oferta rechazada (Repartidor Santiago Ferreyra) → Oferta enviada a Sofía → Asignado → En camino a retirar → Aviso al repartidor y Datos modificados: dirección de entrega (Operario Ana Pérez) → Paquete retirado → En domicilio de entrega → Entregado, con "Evidencia: DNI verificado, foto enviada por WhatsApp" | #29 |

### Bloque 7 · La oferta que venció (3 min, cuando ya pasaron 5 minutos del paso 5.1)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 7.1 | Valentina | Mirar el celular | "La oferta venció." y su estado pasa a "En pausa" | #12 (S2, ya funciona) |
| 7.2 | Operario | Abrir el envío mediano (pestaña de pendientes) | Sigue **sin asignar**: no hay otro auto ni camión disponible. En el historial: "Oferta vencida por inactividad (Valentina López)", con la hora en que venció y "Sistema" como responsable | #29, #2 |
| 7.3 | Juan | **Iniciar jornada** | Le llega la oferta del mediano: un camión también puede llevar un paquete mediano. **Aceptar** | #2 |
| 7.4 | Valentina | **Reanudar** | Vuelve a la cola de autos. Ese envío no se le vuelve a ofrecer | #8 |

Si el profe quiere ver el historial de una oferta vencida sin esperar, abrir el envío de **Carlos Medina** (Finalizados), que es de ayer.

### Bloque 8 · Cambio de tamaño y cancelación (4 min)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 8.1 | Operario | Registrar el **envío 3** (Kiosco, Chico) | La oferta le llega a **Lucas**, que ya tiene el contador en 0. Lucas **Acepta** | #2, #10 |
| 8.2 | Operario | En el envío 3 → **Modificar datos**: tamaño **Grande** → **Guardar** | Vuelve a "Pendiente" sin repartidor, porque ahora requiere camión y Juan está ocupado. Lucas vuelve a la cola. Historial: "Cambio de tamaño a Grande: ahora requiere Camión y vuelve a Pendiente. El repartidor que lo tenía vuelve a la cola." | #31, #29, #2 |
| 8.3 | Juan | **Voy al comercio** → confirmar | Su viaje pasa a "En camino a retirar" | #14 |
| 8.4 | Operario | Abrir el envío mediano (el de Juan) → **Cancelar envío** → **Sí, cancelar** | "Cancelado". Historial: "Cancelado" con la hora y "Operario Ana Pérez" | #29 |
| 8.5 | Juan | **Enseguida**, antes de que se refresque, tocar **Paquete retirado** → confirmar | No avanza y avisa que ya no tiene ese viaje. Si la pantalla ya se había refrescado, muestra "No tenés viajes asignados en este momento" | #14, #13 |
| 8.6 | Juan | Mirar el celular | Como quedó libre, **le llega la oferta del envío 3** (el grande que esperaba camión). **Rechazar** | #2, #11 |
| 8.7 | Operario | **Envíos** | El envío 3 queda en "Pendientes de asignar", sin repartidor: no hay otro camión | #11 |

### Bloque 9 · Cambio de vehículo y la regla de los 2 viajes con un único repartidor (5 min)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 9.1 | Operario | **Repartidores → Editar** a Santiago: Moto → Auto → **Guardar cambios**. Ver **Flota** | Santiago sale de la cola de motos y queda **último en la de autos** | #33 |
| 9.2 | Lucas, Sofía | **Terminar jornada** → confirmar | Quedan "Fuera de jornada" y desaparecen de la flota. No queda ninguna moto disponible | #8 |
| 9.3 | Mateo | **Iniciar jornada** (tiene 2 viajes seguidos) | En Flota es la única moto en la cola | #27 |
| 9.4 | Operario | Registrar el **envío 4** (Kiosco, Chico) | La oferta le llega **igual a Mateo**, porque es el único con moto. En el panel de envíos y en el detalle: "⚠️ Asignación por excepción: único repartidor disponible". Mateo **Acepta** | #10 |
| 9.5 | Operario | **Repartidores**: **Editar** a Mateo para cambiarle el vehículo, y después **Dar de baja** a Mateo | Las dos acciones: "El repartidor tiene un viaje en curso" | #33, #69 |
| 9.6 | Mateo | Hacer el viaje completo: Voy al comercio → Paquete retirado → Llegué al domicilio → **Entregado** (el Kiosco no exige evidencia) | Dice "El comercio no exige evidencia" y entrega sin pedir nada: "¡Entrega registrada!…". Vuelve al final de la cola | #15, #14, #27 |

### Bloque 10 · Búsqueda, bajas y cierre (5 min)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 10.1 | Operario | **Repartidores → Dar de baja** a Tomás → **Confirmar baja** | Queda inactivo | #69, #33 |
| 10.2 | Presentador | En la ventana de incógnito, `/repartidor/login` con el PIN de Tomás (paso 3.5) | "PIN incorrecto" | #67, #33 |
| 10.3 | Operario | **Envíos**: buscar por el código del envío 1 | Solo ese envío, con su estado y su repartidor | #25 |
| 10.4 | Operario | Filtrar por comercio "Ferretería La Tuerca" | Solo el envío de Pablo Herrera | #25 |
| 10.5 | Operario | Filtrar por estado "Pendiente" | Solo el envío 3 | #25 |
| 10.6 | Operario | Filtrar por la fecha de ayer | Solo los 8 envíos del seed | #25 |
| 10.7 | Operario | Estado "Entregado" y fecha de hoy | Solo los envíos 1 y 4 | #25 |
| 10.8 | Operario | Comercio "Farmacia Plaza Moreno" y fecha de hoy. Después, el código `NOEXISTE22` | Las dos veces: "No se encontraron envíos con esos filtros" | #25 |
| 10.9 | Destinatario | En `/seguimiento`, escribir el código `noexiste22` → **Consultar**. Después, el código de Carlos Medina en minúsculas | "Código de seguimiento no encontrado" sin salir de la pantalla. El segundo lo encuentra igual | #17 |
| 10.10 | Operario | **Salir**. Después, abrir `/operario/envios` | Vuelve al login. El panel no se puede abrir sin volver a ingresar | #3 |
| 10.11 | — | (Opcional, **al final de todo**) en un celular, tipear 6 PINs equivocados seguidos | "Demasiados intentos. Esperá un minuto y probá de nuevo." **Bloquea los logins de ese Wi-Fi por un minuto**: hacerlo último | #67 |

---

## Cobertura por historia de usuario

### Sprint 1

| HU | Título | Pasos |
|---|---|---|
| #1 | Registrar comercios | 2.1, 2.2, 2.3 |
| #2 | Registrar envío | 5.1, 5.3, 7.2, 7.3, 8.1, 8.2, 8.6 |
| #3 | Iniciar sesión como operario | 1.1, 1.2, 1.3, 10.10 |
| #6 | Registrar repartidor | 3.1, 3.2, 3.3 |
| #7 | Generar y asignar PIN | 3.1, 3.3, 3.5, 4.1 |
| #10 | Regla de descarte (2 viajes consecutivos) | 4.3 y 5.4 (salteado), 4.4 (pausa), 8.1, 9.4 (excepción) |
| #11 | Recibir oferta con 5 minutos para aceptar | 5.4, 5.5, 5.6, 8.6, 8.7 |
| #13 | Datos esenciales del viaje | 6.2, 6.6, 8.5 |
| #14 | Avanzar el estado en 2 toques | 6.3, 6.6, 6.8, 8.3, 8.5, 9.6 |
| #15 | Cerrar entrega y quedar disponible | 6.8, 6.9, 6.10, 6.11, 9.6 |
| #16 | Enlace de seguimiento | 5.3, 6.1, 6.11 |
| #17 | Consultar el estado del paquete | 6.1, 6.6, 6.11, 10.9 |
| #19 | Validar la entrega con el DNI | 6.8, 6.9, 6.10 |
| #25 | Buscar y filtrar envíos | 10.3 a 10.8 |
| #27 | Estado de los repartidores (flota) | 4.3, 6.10, 9.3, 9.6 |
| #29 | Historial de un envío | 6.12, 7.2, 8.2, 8.4 |
| #31 | Modificar un envío antes del retiro | 6.4, 6.7, 8.2 |
| #32 | Modificar o dar de baja un comercio | 2.4, 2.5, 2.6, 6.5 |
| #33 | Cambiar el vehículo o dar de baja a un repartidor | 5.2, 9.1, 9.5, 10.1, 10.2 |
| #67 | Iniciar sesión como repartidor | 4.1, 10.2, 10.11 |
| #69 | Baja y reactivación de repartidores | 3.1, 3.4, 9.5, 10.1 |

### Del Sprint 2 que ya funciona y aparece de paso

| HU | Título | Pasos |
|---|---|---|
| #8 | Pausar y reanudar | 4.2, 4.4, 7.4, 9.2 |
| #12 | Reasignar por vencimiento de la oferta | 5.1, 7.1, 7.2 |

### Diferencias entre las HUs y la app (para corregir antes de la demo)

| HU | Qué dice la HU | Qué hace la app |
|---|---|---|
| #1, esc. 5 | Evidencia "Foto o DNI" | No existe: se elige foto, DNI, las dos o ninguna. La regla de la misma HU tampoco la menciona |
| #11, esc. 3 | Antes de aceptar, la oferta muestra solo la **zona** de origen y de destino | Muestra las direcciones completas |
| #3, esc. 5 | Botón "Cerrar sesión" | Se llama **Salir** |
| #7, esc. 5 | Intentar resetear el PIN de un inactivo muestra un mensaje | El botón ni aparece para un inactivo (el backend igual lo rechaza con ese mensaje) |
| #14, esc. 5 | "Le avisa que el envío fue modificado" | Dice que ya no tiene ese viaje |
| #16, esc. 1 | "Copiar enlace de seguimiento" → "Enlace copiado" | "Copiar link de seguimiento" → "¡Link copiado!" |

---

## Si algo sale mal

| Problema | Qué hacer |
|---|---|
| La página tarda en cargar | Render se estaba despertando: esperar cerca de 1 minuto |
| "Demasiados intentos" al entrar | Esperar un minuto (límite de 5 logins por minuto por IP) |
| La oferta no aparece | La app consulta cada 10 segundos: esperar. Si no llega, revisar en Flota que el repartidor esté en la cola y no "Con oferta" de otro envío |
| La oferta le llegó a otro repartidor | Alguien inició la jornada en otro orden. Seguir con quien la recibió |
| Un repartidor quedó trabado con un envío | El operario cancela el envío desde el detalle |
| Hay que volver a empezar | Cargar de nuevo los datos (sección 2) y volver a hacer el login de los celulares |
