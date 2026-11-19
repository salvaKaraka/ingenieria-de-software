# Guion de la Demo 2 (Sprint 2)

Un solo recorrido por **lo nuevo del Sprint 2**. Arranca con los repartidores ya trabajando y sigue el orden real de la operación:
1. Entregas con mapa, franja y foto.
2. Cancelaciones.
3. Problemas en el domicilio y reintentos.
4. Ofertas vencidas y panel de excepciones.
5. Incidentes en ruta.
6. Cierre de jornada, depósito y devolución al comercio.

Dura unos **40 minutos**.

Cada paso dice **quién** lo hace, **qué** tiene que tocar, **qué** tiene que verse y **a qué HU** (número de Taiga) corresponde. Al final hay una [tabla](#cobertura-por-historia-de-usuario) con cada HU del sprint y los pasos donde aparece.

> Ensayado de punta a punta contra la API el 19/11, en una base aparte cargada con el mismo seed. Las ofertas le llegaron a quien dice el guion. Los vencimientos de 5 minutos se simularon adelantando la hora de vencimiento.

---

## Antes de la demo

### 1. Publicar y cargar los datos

1. Mergear el PR de `dev` a `main` y esperar a que Render termine el deploy. El backend aplica las migraciones solo al arrancar.
2. En Supabase → **SQL Editor**, pegar el contenido de [`is-backend/src/scripts/seed-demo.sql`](../is-backend/src/scripts/seed-demo.sql).
3. Reemplazar `PEGAR_ACA_EL_PIN_SECRET` por el `PIN_SECRET` de Render (servicio del backend → Environment) y tocar **Run**.
4. Guardar la tabla que devuelve: tiene los PINs y los códigos. Después volver a poner `PEGAR_ACA_EL_PIN_SECRET` o borrar la pestaña.

Hay que cargarlo de nuevo después de cada ensayo: **borra todo**.

### 2. Qué deja cargado

| | Datos |
|---|---|
| Operario | `admin` / `admin1234` (Ana Pérez) |
| Comercios | Kiosco Don Pepe (sin evidencia), Librería del Bosque (foto), Farmacia Plaza Moreno (DNI), Ferretería La Tuerca (foto y DNI), Heladería Polo Norte (sin movimientos) |
| Repartidores | **1111** Lucas, moto, 2 viajes seguidos · **2222** Sofía, moto · **3333** Mateo, moto, 2 viajes seguidos · **4444** Valentina, auto · **6666** Juan, camión · **7777** Martina, camión, **en emergencia** · 5555 Tomás, dado de baja |
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
| Integrante 5 | Celular | Juan (6666) |
| Integrante 6 | Celular | Martina (7777) |

### 4. Justo antes de empezar

- [ ] Abrir la app y esperar a que Render despierte (cerca de 1 minuto).
- [ ] Los 6 repartidores entran con su PIN y **no tocan nada más**. El login acepta 5 intentos por minuto por IP: entrar de a 4 por minuto o con datos móviles.
- [ ] La app del repartidor se actualiza cada 10 s y el panel del operario cada 15 s. Esperar el refresco antes de comentar.
- [ ] **Nadie acepta ni rechaza una oferta si el guion no lo dice.** Las ofertas que hay que dejar vencer son parte de la demo.

### Datos para tener a mano

| Envío | Datos |
|---|---|
| **V** (vence) | Kiosco Don Pepe · Calle 60 450 · Elena Ruiz · 221 600-2222 · **Mediano** |
| **A** | Librería del Bosque · Calle 50 1234 · Juan Pérez · 221 600-1234 · Chico |
| **B** | Kiosco Don Pepe · Calle 9 300 · Pedro Gil · 221 600-3333 · Chico |
| **C** | Kiosco Don Pepe · Calle 2 150 · Rosa Luna · 221 600-4444 · Chico |
| **D** | Kiosco Don Pepe · Calle 4 800 · Ana Sosa · 221 600-5555 · Chico |
| **E** | Kiosco Don Pepe · Calle 1 222 · Marta Díaz · 221 600-6666 · Chico. Dirección corregida: **Calle 11 222** |
| **F** | Farmacia Plaza Moreno · Calle 12 700 · Hugo Paz · 221 600-7777 · **DNI 33.444.555** · Chico |
| **G** | Kiosco Don Pepe · Calle 5 500 · Luis Vera · 221 600-8888 · Chico |
| **H** | Ferretería La Tuerca · Calle 115 890 · Pablo Herrera · 221 600-9999 · **DNI 27.333.444** · **Grande** |
| Dirección que el mapa no encuentra | `Zzzz 99999` |
| Ubicación del incidente de Juan | Calle 7 y 50 |

---

## Recorrido

### Bloque 1 · Cómo arranca el día (3 min)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 1.1 | Operario | Ingresar → **Panel del día** | "No hay envíos pendientes ni en curso" | #4 |
| 1.2 | Operario | **Excepciones** | "No hay envíos que requieran atención" | #22 |
| 1.3 | Operario | **Depósito** | 2 paquetes en custodia de Librería del Bosque. Arriba, "Devoluciones pendientes (1)" con el de **26 h**. El de 3 h no tiene alerta | #40 |
| 1.4 | Operario | **Repartidores → Historial** de Martina | Todos los totales en 0: todavía no recibió ofertas | #28 |
| 1.5 | Martina | Mirar el celular | "Emergencia". No tiene botón para volver a trabajar: "Comunicate con el operario para volver a trabajar." | #20 |
| 1.6 | Lucas | **Mi historial** | "Todavía no completaste entregas hoy" | #34 |

### Bloque 2 · Inicio de jornada (2 min)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 2.1 | Sofía, Lucas, Mateo, Valentina, Juan | **Iniciar jornada en este orden**, de a uno | Cada uno queda "Disponible". **El orden importa** | #8 |
| 2.2 | Operario | **Flota** | Motos: Sofía, Lucas, Mateo. Autos: Valentina. Camiones: Juan, y Martina destacada en emergencia | #8 |

### Bloque 3 · Una entrega con mapa, franja y foto (8 min)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 3.1 | Operario | Registrar el envío **V** (Mediano). **Anotar la hora** | Le llega la oferta a **Valentina**. **No la toca**: vence en 5 minutos (bloque 6) | #12 |
| 3.2 | Operario | **+ Registrar nuevo envío** (A, Librería). En la entrega, escribir `Zzzz 99999` → **Buscar en el mapa** | "No encontramos la dirección en el mapa. Revisala o marcá el punto tocando el mapa." Se puede guardar igual | #70 |
| 3.3 | Operario | Cambiar a **Calle 50 1234** → **Buscar en el mapa**. Tocar el mapa un poco al costado del punto. Revisar que el retiro también quede marcado. **Guardar pedido** → **Copiar link de seguimiento** | "Punto marcado en el mapa." y después "¡Link copiado!". Le llega la oferta a **Sofía** | #70 |
| 3.4 | Sofía | Con la oferta en pantalla, tocar **Pausar** | "Tenés una oferta pendiente: respondela antes de pausar" | #8 |
| 3.5 | Sofía | **Aceptar** | Ve el mapa con el comercio y el domicilio y el botón **Cómo llegar al comercio**. **Pausar** ya no aparece: tiene un viaje | #70, #8 |
| 3.6 | Operario | **Panel del día** | El envío A en el grupo "Asignado" con su cantidad | #4 |
| 3.7 | Destinatario | Abrir el link en incógnito | "Asignado" y "Tu envío todavía no salió hacia tu domicilio", sin franja | #70 |
| 3.8 | Sofía | **Voy al comercio** → confirmar → **Paquete retirado** → confirmar | Sin recargar, el panel lo pasa a "Paquete retirado". El botón ahora dice **Cómo llegar a la entrega** | #4, #70 |
| 3.9 | Destinatario | Esperar el refresco (60 s) o recargar. Recargar otra vez | "Llegada estimada entre HH:MM y HH:MM". Al recargar, la misma franja | #70 |
| 3.10 | Sofía | **Llegué al domicilio** → confirmar | **Entregado** deshabilitado y "Este comercio exige una foto de la entrega" | #18 |
| 3.11 | Sofía | **Tomar o subir foto** → **Entregado** → **Sí, confirmar** | "¡Entrega registrada! Ya estás de nuevo en la cola." | #18 |
| 3.12 | Operario | Panel del día. Después **Envíos → Finalizados** → envío A | Salió del panel. En el detalle, la foto junto al paso "Entregado" | #4, #18 |
| 3.13 | Destinatario | Recargar | "Entregado" con fecha y hora, sin franja | #70 |
| 3.14 | Sofía | **Mi historial** | La entrega de hoy con comercio y hora. Las de ayer no aparecen | #34 |

### Bloque 4 · Cancelaciones (4 min)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 4.1 | Operario | Registrar **B** | Le llega a **Lucas**: Mateo y Sofía tenían 2 viajes seguidos y descansan. Lucas **Acepta** | — |
| 4.2 | Operario | Detalle de B → **Cancelar envío** → **Sí, cancelar** | "Cancelado". A Lucas le aparece "El envío fue cancelado. No lo retires." y queda "Disponible" | #30 (esc. 4) |
| 4.3 | Operario | Registrar **C** | Le llega a **Mateo**. **Acepta** → **Voy al comercio** → confirmar | — |
| 4.4 | Operario | Cancelar C | Igual que 4.2: aviso a Mateo y vuelve a "Disponible" | #30 (esc. 1) |
| 4.5 | Operario | Registrar **D**. Le llega la oferta a Sofía: **no la toca**. Cancelar D | "Cancelado": la oferta desaparece del celular de Sofía y el envío sale del panel | #30 (esc. 3), #4 |

### Bloque 5 · Problemas en el domicilio (8 min)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 5.1 | Lucas, Mateo | **Pausar** | "En pausa". Salen de la cola de motos | #8 |
| 5.2 | Operario | Registrar **E** | Le llega a **Sofía**, aunque Lucas y Mateo estaban antes en la cola: un repartidor en pausa no recibe ofertas. **Acepta** | #8 |
| 5.3 | Sofía | **Voy al comercio** → **Paquete retirado** | — | |
| 5.4 | Operario | Detalle de E → **Cancelar envío** | "No se puede cancelar: el paquete ya fue retirado" | #30 (esc. 2) |
| 5.5 | Sofía | **Llegué al domicilio**. Operario: cancelar E otra vez | El mismo mensaje | #30 (esc. 5) |
| 5.6 | Sofía | **Reportar novedad en domicilio** → "Dirección incorrecta" → comentario "No existe el 222" → **Confirmar novedad** | Sofía queda "Disponible". En el panel, E destacado en "Con novedad" con "Dirección incorrecta: No existe el 222" | #23 (esc. 2) |
| 5.7 | Destinatario | Abrir el link de E (desde el detalle: Copiar link) | "No pudimos entregarlo" y "Visitamos tu domicilio y no pudimos entregar el paquete" | #23 (esc. 3) |
| 5.8 | Operario | Registrar **F** (Farmacia, con DNI) | Le llega a Sofía. **Acepta** | — |
| 5.9 | Operario | Detalle de E → **Reintentar entrega** → dirección **Calle 11 222** → **Reintentar entrega** | "Reintento en espera": Sofía está con F | #24 (esc. 2) |
| 5.10 | Sofía | Hacer F completo. En el domicilio ingresa el DNI **33444555** y entrega **sin foto** | Entrega: la Farmacia solo exige DNI. Enseguida le aparece E en "Paquete retirado" con la dirección nueva | #18 (esc. 3), #24 (esc. 1) |
| 5.11 | Destinatario | Recargar el seguimiento de E | "Tu envío fue reprogramado" | #24 (esc. 4) |
| 5.12 | Sofía | **Llegué al domicilio** → novedad "Cliente ausente" → **Confirmar novedad** | E vuelve a "Con novedad" | #23 (esc. 1) |
| 5.13 | Operario | Detalle de E → **Devolver al comercio** → confirmar | "A devolver". Queda entre los paquetes que Sofía tiene que rendir | #24 (esc. 3) |
| 5.14 | Sofía | **Mi historial** | A y F. E no figura: no se entregó | #34 |
| 5.15 | Sofía | **Cerrar jornada** → **Sí, cerrar jornada** | "Esperando validación de cierre" con el resumen: 1 paquete a devolver (E) | #35 (esc. 1 y 3) |

### Bloque 6 · Ofertas vencidas y excepciones (4 min, cuando ya pasaron 10 minutos del paso 3.1)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 6.1 | Valentina | Mirar el celular (a los 5 min de 3.1) | La oferta venció y quedó "En pausa". La oferta de V **pasó a Juan**, que tampoco la toca | #12 (esc. 1) |
| 6.2 | Operario | **Excepciones** (a los 10 min de 3.1) | V con "Envío sin repartidor disponible" y los minutos de espera. Juan también quedó en pausa | #12 (esc. 2), #22 (esc. 3) |
| 6.3 | Operario | **Repartidores → Historial** de Valentina | 1 vencida. Filtrar por la fecha de ayer: solo las de ayer | #28 |
| 6.4 | Operario | En Excepciones, V → **Cancelar envío** → confirmar | Sale del panel | #22 (esc. 2) |
| 6.5 | Operario | **Flota** → **Rehabilitar** a Valentina y a Juan | Los dos "Disponible", al final de su cola | #26 (esc. 2) |

### Bloque 7 · Incidentes en ruta (8 min)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 7.1 | Lucas, después Mateo | **Reanudar**, en ese orden | Vuelven a la cola de motos | #8 |
| 7.2 | Operario | Registrar **G** | Le llega a Lucas. **Acepta** → **Voy al comercio** → confirmar | — |
| 7.3 | Lucas | **Reportar incidente** → **Cancelar** | No pasa nada: el viaje sigue | #20 (esc. 2) |
| 7.4 | Lucas | **Reportar incidente** → **Sí, reportar incidente** (no pide ubicación: todavía no retiró) | Lucas queda en "Emergencia". En segundos, a Mateo le llega la oferta de G con el retiro en el comercio. En Excepciones: "Incidente reportado en ruta" | #20 (esc. 5), #21 (esc. 1 y 3) |
| 7.5 | Lucas | Intentar volver a trabajar | No hay botón: "Comunicate con el operario para volver a trabajar." | #20 (esc. 4) |
| 7.6 | Mateo | **Rechazar** | La oferta pasa a Valentina (un auto también lleva un paquete chico). **Acepta** | #21 (esc. 4) |
| 7.7 | Operario | Registrar **H** (Ferretería, Grande) | Le llega a **Juan**, no a Martina: está en emergencia. Juan **Acepta** → **Voy al comercio** → **Paquete retirado** | #20 (esc. 3) |
| 7.8 | Juan | **Reportar incidente** sin escribir la ubicación. Después **Ubicación actual: Calle 7 y 50** → **Sí, reportar incidente** | Sin ubicación no deja confirmar. Con ubicación: Juan en "Emergencia" y, como no hay otro camión, H pasa a **Excepciones** con "Envío parado: no hay repartidores compatibles" y retiro en **Calle 7 y 50** | #20 (esc. 1), #21 (esc. 2) |
| 7.9 | Operario | **Flota → Rehabilitar** a Martina | Martina "Disponible" al final de la cola de camiones | #26 (esc. 1) |
| 7.10 | Operario | **Excepciones** → H → **Asignar** → Martina → **Confirmar** | La oferta le llega directo a Martina, sin pasar por la cola. Ve "Retirar en: Calle 7 y 50". **Acepta** | #22 (esc. 1 y 5), #21 |
| 7.11 | Martina | **Cerrar jornada** → **Sí, cerrar jornada** | "Finalizá tu viaje en curso para completar el cierre" | #35 (esc. 2) |
| 7.12 | Martina | Terminar H: DNI **27333444** y foto → **Entregado** | La entrega queda registrada y su cierre pasa a esperar la aprobación del operario | #35 |
| 7.13 | Valentina | Terminar G (el Kiosco no exige evidencia) | Entregado | — |

### Bloque 8 · Cierre de jornada y depósito (5 min)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 8.1 | Operario | **Flota** → Martina → **Aprobar cierre** → **Aprobar cierre** | No tiene paquetes a devolver: queda "Fuera de jornada" | #36 (esc. 1) |
| 8.2 | Operario | **Flota** → Sofía → **Aprobar cierre** → **Aprobar cierre** | "Faltan rendir 1 paquete". Sigue esperando | #36 (esc. 2) |
| 8.3 | Operario | En el mismo modal, código `NOEXISTE22` → **Confirmar reingreso** | "El código no corresponde a ningún envío" | #37 (esc. 3) |
| 8.4 | Operario | Código del paquete de 3 h de Librería (está en **Depósito**) → **Confirmar reingreso** | "El paquete no pertenece a la jornada de este repartidor" | #37 (esc. 2) |
| 8.5 | Operario | Código de **E** → **Confirmar reingreso** → **Aprobar cierre** | E sale de la lista. El cierre se aprueba y Sofía queda "Fuera de jornada" | #37 (esc. 1), #36 (esc. 1) |
| 8.6 | Operario | Detalle de E | En el historial, "En custodia" con fecha, hora y "Operario Ana Pérez" | #37 (esc. 4) |
| 8.7 | Sofía | **Iniciar jornada** | "Disponible" otra vez, al final de la cola | #36 (esc. 3) |

### Bloque 9 · Devolución al comercio (5 min)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 9.1 | Operario | **Depósito** | Librería con 2 paquetes (el de 26 h con alerta) y Kiosco con E | #40 |
| 9.2 | Operario | En Librería, **destildar** el de 3 h → **Crear orden de devolución (1)** | La alerta de 26 h desaparece. En Librería queda solo el de 3 h. En "Órdenes de devolución" aparece la orden "Ofrecida a Mateo" | #38 (esc. 1 y 3), #40 (esc. 3) |
| 9.3 | Mateo | Ve la oferta: "Depósito (base)" → Librería del Bosque, "Devolución al comercio: 1 paquete". **Aceptar** | Pantalla "Devolvé los paquetes al comercio" con el código y "Cómo llegar al comercio" | #38 |
| 9.4 | Mateo | **Confirmar devolución** sin foto | "Falta la foto de la constancia" | #39 (esc. 2) |
| 9.5 | Mateo | Sacar la foto → **Confirmar devolución** | "¡Devolución registrada! Ya estás de nuevo en la cola." En Depósito la orden pasa a "Devuelta a las HH:MM por Mateo Ruiz" | #39 (esc. 1) |
| 9.6 | Operario | Abrir el envío devuelto | "Devuelto al comercio". **No** ofrece cancelar: ya terminó | #39 |
| 9.7 | Operario | **Depósito**: crear la orden de Librería (3 h) y la de Kiosco (E) | "No hay paquetes en custodia." Las dos órdenes se ofrecen a los repartidores libres | #38 (esc. 2) |
| 9.8 | Operario | **Comercios → Resumen diario**: Librería del Bosque, hoy → **Generar resumen** | 1 entregado (A), 1 devuelto, 0 cancelados. El paquete que todavía está volviendo no se cuenta | #41 (esc. 1 y 3) |
| 9.9 | Operario | Resumen de Heladería Polo Norte, hoy | Todo en 0 | #41 (esc. 2) |

### Bloque 10 · Perfil del repartidor (2 min)

| # | Quién | Acción | Qué tiene que verse | HU |
|---|---|---|---|---|
| 10.1 | Valentina | **Mi perfil** | El vehículo se ve pero no se puede editar | #68 (esc. 3) |
| 10.2 | Valentina | Cambiar el teléfono → **Guardar cambios** | "Perfil actualizado correctamente" | #68 (esc. 1) |
| 10.3 | Valentina | Cambiar PIN con `1234` → **Generar PIN nuevo** | "El PIN actual ingresado es incorrecto" | #68 (esc. 4) |
| 10.4 | Valentina | Con `4444` → **Generar PIN nuevo** | Muestra el PIN nuevo una sola vez. El 4444 deja de servir | #68 (esc. 2) |

---

## Cobertura por historia de usuario

| HU | Título | Pasos |
|---|---|---|
| #4 | Panel de envíos del día | 1.1, 3.6, 3.8, 3.12, 4.5 |
| #8 | Disponibilidad (pausa) | 2.1, 3.4, 3.5, 5.1, 5.2, 7.1 |
| #12 | Reasignar por vencimiento | 3.1, 6.1, 6.2 |
| #18 | Foto de la entrega | 3.10, 3.11, 3.12, 5.10 |
| #20 | Reportar incidente | 1.5, 7.3, 7.4, 7.5, 7.7, 7.8 |
| #21 | Reasignar envío interrumpido | 7.4, 7.6, 7.8, 7.10 |
| #22 | Panel de excepciones | 1.2, 6.2, 6.4, 7.10 |
| #23 | Novedad en el domicilio | 5.6, 5.7, 5.12 |
| #24 | Reintentar o devolver | 5.9, 5.10, 5.11, 5.13 |
| #26 | Rehabilitar repartidores | 6.5, 7.9 |
| #28 | Historial de respuestas | 1.4, 6.3 |
| #30 | Cancelar envío | 4.2, 4.4, 4.5, 5.4, 5.5 |
| #34 | Mi historial del día | 1.6, 3.14, 5.14 |
| #35 | Solicitar cierre de jornada | 5.15, 7.11, 7.12 |
| #36 | Aprobar cierre de jornada | 8.1, 8.2, 8.5, 8.7 |
| #37 | Reingreso al depósito | 8.3, 8.4, 8.5, 8.6 |
| #38 | Orden de devolución | 9.2, 9.3, 9.7 |
| #39 | Confirmar devolución | 9.4, 9.5, 9.6 |
| #40 | Alerta de paquetes demorados | 1.3, 9.1, 9.2 |
| #41 | Resumen diario por comercio | 9.8, 9.9 |
| #68 | Perfil del repartidor | 10.1 a 10.4 |
| #70 | Franja estimada y mapas | 3.2, 3.3, 3.5, 3.7, 3.8, 3.9, 3.13 |

Escenarios que no se muestran en vivo:
- HU 70 escenarios 2 y 3: la franja sin mapa usa el promedio de entregas o 60 minutos.
- HU 40 escenario 4: las 24 horas exactas.

Los dos están cubiertos por los tests automáticos.

---

## Si algo sale mal

| Problema | Qué hacer |
|---|---|
| La página tarda en cargar | Render se está despertando: esperar cerca de 1 minuto |
| "Demasiados intentos" al entrar | Esperar un minuto (5 logins por minuto por IP) |
| La oferta le llegó a otro repartidor | Alguien inició la jornada, pausó o reanudó en otro orden. Seguir con quien la recibió |
| La franja dice un horario raro | El mapa no pudo calcular la ruta (no se marcaron los puntos): usa el promedio de entregas. Es el plan B de la HU 70 |
| Un repartidor quedó trabado | Rehabilitarlo desde **Flota** o cancelar el envío desde el detalle |
| Hay que volver a empezar | Correr de nuevo el SQL de la sección 1 y volver a entrar en los celulares |
