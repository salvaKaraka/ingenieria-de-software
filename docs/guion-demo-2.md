# Guion de la Demo 2 (Sprint 2)

Un recorrido de **20 minutos** por lo nuevo del Sprint 2, en el orden real de la operación:
1. Una entrega con mapa, franja y foto.
2. Un problema en el domicilio, el reintento y las cancelaciones.
3. Una oferta vencida, un incidente en ruta y el panel de excepciones.
4. El cierre de jornada, el depósito y la devolución al comercio.

Cada paso dice **quién** lo hace, **qué** toca, **qué** tiene que verse y **a qué HU** (número de Taiga) corresponde. Al final hay una [tabla](#cobertura-por-historia-de-usuario) con cada HU del sprint y los pasos donde aparece, y una lista de lo que se puede mostrar [si sobra tiempo](#si-sobra-tiempo).

> Ensayado de punta a punta contra la API el 19/11, en una base aparte cargada con el mismo seed. Las ofertas le llegaron a quien dice el guion. Los vencimientos de 5 minutos se simularon adelantando la hora de vencimiento.

---

## Antes de la demo

### 1. Publicar y cargar los datos

1. Esperar a que Render termine el deploy de `main`. El backend aplica las migraciones solo al arrancar.
2. En Supabase → **SQL Editor**, pegar el contenido de [`is-backend/src/scripts/seed-demo.sql`](../is-backend/src/scripts/seed-demo.sql).
3. Reemplazar `PEGAR_ACA_EL_PIN_SECRET` por el `PIN_SECRET` de Render (servicio del backend → Environment) y tocar **Run**.
4. Guardar la tabla que devuelve: tiene los PINs y los códigos. Después volver a poner `PEGAR_ACA_EL_PIN_SECRET` o borrar la pestaña.

Hay que cargarlo de nuevo después de cada ensayo: **borra todo**.

### 2. Qué deja cargado

| | Datos |
|---|---|
| Operario | `admin` / `admin1234` (Ana Pérez) |
| Comercios | Kiosco Don Pepe (sin evidencia), Librería del Bosque (foto), Farmacia Plaza Moreno (DNI), Ferretería La Tuerca (foto y DNI), Heladería Polo Norte (sin movimientos) |
| Repartidores | **2222** Sofía, moto · **1111** Lucas, moto · **3333** Mateo, moto · **4444** Valentina, auto · **6666** Juan, camión · 7777 Martina, camión, **en emergencia** · 5555 Tomás, dado de baja |
| Envíos | 8 de ayer, terminados |
| Depósito | 2 paquetes de Librería del Bosque **en custodia**: uno hace **26 h** (con alerta) y otro hace **3 h** |

### 3. Dispositivos

| Quién | Dispositivo | Entra como |
|---|---|---|
| Presentador | Compu con proyector | Operario |
| Presentador | Misma compu, ventana de incógnito | Destinatario (seguimiento) |
| Integrante 1 | Celular | Sofía (2222) |
| Integrante 2 | Celular | Lucas (1111) |
| Integrante 3 | Celular | Mateo (3333) |
| Integrante 4 | Celular | Valentina (4444) |
| Integrante 5 | Celular | Juan (6666). No toca nada en toda la demo |

Martina no necesita celular: se la rehabilita desde la compu.

### 4. Justo antes de empezar (fuera de los 20 minutos)

- [ ] Abrir la app y esperar a que Render despierte (cerca de 1 minuto).
- [ ] Los 5 repartidores entran con su PIN. El login acepta 5 intentos por minuto por IP: entrar con datos móviles o de a uno.
- [ ] Tocan **Iniciar jornada en este orden**, de a uno: **Sofía, Lucas, Mateo, Valentina, Juan**. El orden decide a quién le llega cada oferta.
- [ ] La app del repartidor se actualiza cada 10 s y el panel del operario cada 15 s. Esperar el refresco antes de comentar.
- [ ] **Nadie acepta ni rechaza una oferta si el guion no lo dice.**

### Datos para tener a mano

| Envío | Datos |
|---|---|
| **V** (vence) | Kiosco Don Pepe · Calle 60 450 · Elena Ruiz · 221 600-2222 · **Mediano** |
| **A** | Librería del Bosque · Calle 50 1234 · Juan Pérez · 221 600-1234 · Chico |
| **B** | Kiosco Don Pepe · Calle 1 222 · Marta Díaz · 221 600-6666 · Chico. Dirección corregida: **Calle 11 222** |
| **C** | Kiosco Don Pepe · Calle 9 300 · Pedro Gil · 221 600-3333 · Chico |
| **D** | Kiosco Don Pepe · Calle 5 500 · Luis Vera · 221 600-8888 · Chico |
| Dirección que el mapa no encuentra | `Zzzz 99999` |
| Ubicación del incidente de Sofía | Calle 7 y 50 |

---

## Recorrido

### Bloque 1 · Cómo arranca el día (2 min)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 1.1 | Operario | **Panel del día** | "No hay envíos pendientes ni en curso" | #4 |
| 1.2 | Operario | Registrar **V** (Mediano). **Anotar la hora** | Le llega la oferta a **Valentina**. **No la toca**: se retoma en el bloque 4 | #12 |
| 1.3 | Operario | **Depósito** | 2 paquetes de Librería del Bosque en custodia. Arriba, "Devoluciones pendientes (1)" con el de **26 h**. El de 3 h no tiene alerta | #40 |

### Bloque 2 · Una entrega con mapa, franja y foto (5 min)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 2.1 | Operario | **+ Registrar nuevo envío** (A). En la entrega, escribir `Zzzz 99999` → **Buscar en el mapa** | "No encontramos la dirección en el mapa. Revisala o marcá el punto tocando el mapa." | #70 |
| 2.2 | Operario | Cambiar a **Calle 50 1234** → **Buscar en el mapa** → tocar el mapa al costado del punto → **Guardar pedido** → **Copiar link de seguimiento** | "Punto marcado en el mapa." y "¡Link copiado!". Le llega la oferta a **Sofía** | #70 |
| 2.3 | Sofía | Con la oferta en pantalla, tocar **Pausar** | "Tenés una oferta pendiente: respondela antes de pausar" | #8 |
| 2.4 | Sofía | **Aceptar** | Mapa con el comercio y el domicilio, botón **Cómo llegar al comercio**. **Pausar** ya no aparece | #70, #8 |
| 2.5 | Destinatario | Abrir el link en incógnito | "Asignado", sin franja todavía | #70 |
| 2.6 | Sofía | **Voy al comercio** → **Paquete retirado** (confirmando cada uno) | El panel del operario lo pasa a "Paquete retirado" sin recargar | #4 |
| 2.7 | Destinatario | Recargar | "Llegada estimada entre HH:MM y HH:MM" | #70 |
| 2.8 | Sofía | **Llegué al domicilio** → confirmar | **Entregado** deshabilitado: "Este comercio exige una foto de la entrega" | #18 |
| 2.9 | Sofía | **Tomar o subir foto** → **Entregado** → **Sí, confirmar** | "¡Entrega registrada! Ya estás de nuevo en la cola." | #18 |
| 2.10 | Operario | **Envíos → Finalizados** → envío A | La foto junto al paso "Entregado" | #18 |

### Bloque 3 · Novedad, reintento y cancelaciones (5 min)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 3.1 | Operario | Registrar **B** | Le llega a **Lucas**. **Acepta** → **Voy al comercio** → **Paquete retirado** | — |
| 3.2 | Operario | Detalle de B → **Cancelar envío** | "No se puede cancelar: el paquete ya fue retirado" | #30 (esc. 2) |
| 3.3 | Lucas | **Llegué al domicilio** → **Reportar novedad en domicilio** → "Dirección incorrecta", comentario "No existe el 222" → **Confirmar novedad** | Lucas queda "Disponible". En el panel, B en "Con novedad" con "Dirección incorrecta: No existe el 222" | #23 (esc. 2) |
| 3.4 | Destinatario | Abrir el link de B (detalle → Copiar link) | "No pudimos entregarlo" y "Visitamos tu domicilio y no pudimos entregar el paquete" | #23 (esc. 3) |
| 3.5 | Operario | Detalle de B → **Reintentar entrega** → **Calle 11 222** → **Reintentar entrega** | A Lucas le vuelve B en "Paquete retirado" con la dirección nueva. El destinatario, al recargar, ve "Tu envío fue reprogramado" | #24 (esc. 1 y 4) |
| 3.6 | Lucas | **Llegué al domicilio** → novedad "Cliente ausente" → **Confirmar novedad** | B vuelve a "Con novedad" | #23 (esc. 1) |
| 3.7 | Operario | Detalle de B → **Devolver al comercio** → confirmar | "A devolver" | #24 (esc. 3) |
| 3.8 | Lucas | **Cerrar jornada** → **Sí, cerrar jornada** | "Esperando validación de cierre" con 1 paquete a devolver (B) | #35 |
| 3.9 | Operario | Registrar **C** | Le llega a **Mateo**. **Acepta** | — |
| 3.10 | Operario | Detalle de C → **Cancelar envío** → **Sí, cancelar** | "Cancelado". A Mateo le aparece "El envío fue cancelado. No lo retires." y queda "Disponible" | #30 (esc. 1) |

### Bloque 4 · Incidente, oferta vencida y excepciones (4 min)

Arranca con el incidente para darle tiempo a V: tienen que haber pasado **10 minutos desde el paso 1.2** antes del paso 4.5.

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 4.1 | Operario | Registrar **D** | Le llega a **Sofía**. **Acepta** → **Voy al comercio** → **Paquete retirado** | — |
| 4.2 | Sofía | **Reportar incidente** sin escribir la ubicación | No deja confirmar: pide la ubicación porque ya retiró el paquete | #20 (esc. 1) |
| 4.3 | Sofía | **Ubicación actual: Calle 7 y 50** → **Sí, reportar incidente** | Sofía queda en "Emergencia" y no tiene botón para volver: "Comunicate con el operario para volver a trabajar." A **Mateo** le llega D con el retiro en **Calle 7 y 50**. **Acepta** | #20 (esc. 4), #21 (esc. 1 y 3) |
| 4.4 | Valentina | Mirar el celular | La oferta de V venció y quedó "En pausa". V pasó a **Juan**, que tampoco la toca. A Martina no le llegó: está en emergencia | #12 (esc. 1), #20 (esc. 3) |
| 4.5 | Operario | **Excepciones** | V: "Envío sin repartidor disponible", con los minutos de espera. D: "Incidente reportado en ruta" | #12 (esc. 2), #22 (esc. 3) |
| 4.6 | Operario | V → **Asignar** → Valentina → **Confirmar** | La oferta le llega directo a Valentina, sin pasar por la cola. **Acepta** | #22 (esc. 1) |
| 4.7 | Operario | **Flota** → Martina → **Rehabilitar** | Martina "Disponible", al final de la cola de camiones | #26 (esc. 1) |

### Bloque 5 · Cierre, depósito y devolución (4 min)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 5.1 | Mateo | Terminar D (el Kiosco no exige evidencia) | Entregado. Mateo queda libre para la devolución | #21 |
| 5.2 | Operario | **Flota** → Lucas → **Aprobar cierre** → **Aprobar cierre** | "Faltan rendir 1 paquete". Sigue esperando | #36 (esc. 2) |
| 5.3 | Operario | En el mismo modal, código `NOEXISTE22` → **Confirmar reingreso** | "El código no corresponde a ningún envío" | #37 (esc. 3) |
| 5.4 | Operario | Código de **B** (figura en la lista del modal) → **Confirmar reingreso** → **Aprobar cierre** | B sale de la lista. Lucas queda "Fuera de jornada" | #37 (esc. 1), #36 (esc. 1) |
| 5.5 | Operario | **Depósito** | Librería con 2 paquetes (el de 26 h con alerta) y Kiosco con B | #40 |
| 5.6 | Operario | En Librería, **destildar** el de 3 h → **Crear orden de devolución (1)** | La alerta desaparece. La orden aparece "Ofrecida a Mateo" | #38 (esc. 1 y 3), #40 (esc. 3) |
| 5.7 | Mateo | Ve "Depósito (base)" → Librería del Bosque, "Devolución al comercio: 1 paquete". **Aceptar** → **Confirmar devolución** sin foto | "Falta la foto de la constancia" | #38, #39 (esc. 2) |
| 5.8 | Mateo | Sacar la foto → **Confirmar devolución** | "¡Devolución registrada!". En Depósito la orden pasa a "Devuelta a las HH:MM por Mateo Ruiz" | #39 (esc. 1) |
| 5.9 | Operario | **Comercios → Resumen diario**: Librería del Bosque, hoy → **Generar resumen** | 1 entregado (A), 1 devuelto, 0 cancelados | #41 (esc. 1) |

---

## Cobertura por historia de usuario

| HU | Título | Pasos |
|---|---|---|
| #4 | Panel de envíos del día | 1.1, 2.6 |
| #8 | Disponibilidad (pausa) | 2.3, 2.4 |
| #12 | Reasignar por vencimiento | 1.2, 4.4, 4.5 |
| #18 | Foto de la entrega | 2.8, 2.9, 2.10 |
| #20 | Reportar incidente | 4.2, 4.3, 4.4 |
| #21 | Reasignar envío interrumpido | 4.3, 5.1 |
| #22 | Panel de excepciones | 4.5, 4.6 |
| #23 | Novedad en el domicilio | 3.3, 3.4, 3.6 |
| #24 | Reintentar o devolver | 3.5, 3.7 |
| #26 | Rehabilitar repartidores | 4.7 |
| #28 | Historial de respuestas | [Si sobra tiempo](#si-sobra-tiempo) |
| #30 | Cancelar envío | 3.2, 3.10 |
| #34 | Mi historial del día | [Si sobra tiempo](#si-sobra-tiempo) |
| #35 | Solicitar cierre de jornada | 3.8 |
| #36 | Aprobar cierre de jornada | 5.2, 5.4 |
| #37 | Reingreso al depósito | 5.3, 5.4 |
| #38 | Orden de devolución | 5.6, 5.7 |
| #39 | Confirmar devolución | 5.7, 5.8 |
| #40 | Alerta de paquetes demorados | 1.3, 5.5, 5.6 |
| #41 | Resumen diario por comercio | 5.9 |
| #68 | Perfil del repartidor | [Si sobra tiempo](#si-sobra-tiempo) |
| #70 | Franja estimada y mapas | 2.1, 2.2, 2.4, 2.5, 2.7 |

Los escenarios que no entran en el recorrido están cubiertos por los tests automáticos.

## Si sobra tiempo

Se pueden hacer al final, en cualquier orden. No cambian nada del recorrido.

| Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|
| Sofía | **Mi historial** | La entrega de A con comercio y hora. Las de ayer no aparecen | #34 |
| Operario | **Repartidores → Historial** de Valentina | 1 vencida (V) y 1 aceptada | #28 |
| Operario | **Depósito** → crear la orden de Kiosco (B) | Se ofrece a un repartidor libre | #38 (esc. 2) |
| Operario | Resumen diario de Heladería Polo Norte, hoy | Todo en 0 | #41 (esc. 2) |
| Juan | **Mi perfil** → cambiar el teléfono → **Guardar cambios** | "Perfil actualizado correctamente". El vehículo no se puede editar | #68 (esc. 1 y 3) |
| Juan | Cambiar PIN con `1234` y después con `6666` | "El PIN actual ingresado es incorrecto" y después el PIN nuevo, una sola vez | #68 (esc. 2 y 4) |

---

## Si algo sale mal

| Problema | Qué hacer |
|---|---|
| La página tarda en cargar | Render se está despertando: esperar cerca de 1 minuto |
| "Demasiados intentos" al entrar | Esperar un minuto (5 logins por minuto por IP) |
| La oferta le llegó a otro repartidor | Alguien inició la jornada en otro orden. Seguir con quien la recibió |
| En el paso 4.5, V todavía no está en Excepciones | No pasaron los 10 minutos: hacer el paso 5.1 y volver |
| La orden de devolución le llegó a Martina | Mateo no había terminado D. Seguir con Martina |
| La franja dice un horario raro | El mapa no pudo calcular la ruta: usa el promedio de entregas. Es el plan B de la HU 70 |
| Un repartidor quedó trabado | Rehabilitarlo desde **Flota** o cancelar el envío desde el detalle |
| Hay que volver a empezar | Correr de nuevo el SQL y volver a entrar en los celulares |
