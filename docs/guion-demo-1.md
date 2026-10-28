# Guion de la Demo 1 (30/10)

Un solo recorrido que pasa por todas las historias del sprint, en el orden en que se usan de verdad: el operario prepara comercios y repartidores, carga envíos, los repartidores los llevan y el destinatario los sigue. Dura unos **40 minutos**.

Cada paso dice **quién** lo hace, **qué** tiene que tocar y **qué** tiene que verse. Si el profe pregunta por una HU, en la [tabla del final](#cobertura-por-historia-de-usuario) está en qué paso aparece.

> Ensayado de punta a punta contra la API el 28/10 con los datos de `npm run db:seed:demo`: todos los pasos dan el resultado que dice el guion.

---

## Antes de la demo

### 1. Código

- [ ] Mergear el **#52** (viajes consecutivos) en `dev` y publicar `dev` en `main`. Sin el #52 el paso 9.2 funciona, pero no aparece el aviso "Asignación por excepción".
- [ ] El **#54** (cierre de jornada) **no** entra: es del Sprint 2.

### 2. Cargar los datos en Supabase

El seed **borra todo** y carga los datos de la demo. Hay que correrlo después de cada ensayo.

1. En Render → el servicio del backend → **Environment**, copiar `DATABASE_URL`, `JWT_SECRET` y `PIN_SECRET`.
2. Crear `is-backend/.env.supabase` (git lo ignora, **no se sube**) con:
   ```
   DATABASE_URL=<la de Render>
   JWT_SECRET=<la de Render>
   PIN_SECRET=<la de Render>
   SEED_EN_STAGING=si
   DESACTIVAR_JOBS=true
   ```
   `PIN_SECRET` tiene que ser **la de Render**: si no, los PINs que carga el seed no van a funcionar en la app publicada.
3. Correr:
   ```bash
   cd is-backend
   npm run build
   node --env-file=.env.supabase dist/scripts/seed-demo
   ```
   La primera línea dice en qué base va a cargar los datos (tiene que decir `supabase`). Al final imprime los usuarios, los PINs y los códigos de seguimiento de los envíos de ayer. **Guardar esa salida.**

Para cambiar la contraseña del operario, agregar `OPERARIO_PASSWORD=...` al archivo.

### 3. Qué deja cargado el seed

| | Datos |
|---|---|
| Operario | usuario `admin`, contraseña `admin1234` (se llama Ana Pérez) |
| Comercios | Kiosco Don Pepe (sin evidencia), Librería del Bosque (foto), Farmacia Plaza Moreno (DNI), Ferretería La Tuerca (foto y DNI), Heladería Polo Norte (sin envíos, para darla de baja) |
| Repartidores | **1111** Lucas Gómez, moto, 2 viajes seguidos · **2222** Sofía Díaz, moto · **3333** Mateo Ruiz, moto, 2 viajes seguidos · **4444** Valentina López, auto · **5555** Tomás Pérez, auto, **dado de baja** · **6666** Juan Romero, camión · **7777** Martina Álvarez, camión, **en emergencia** |
| Envíos | 8 de ayer, todos terminados (7 entregados y 1 cancelado). El de **Carlos Medina** tiene el historial completo: oferta vencida, oferta rechazada y entrega con DNI. Hoy no hay ninguno: se cargan en vivo |

Martina está en emergencia para que la flota la muestre destacada: el botón de emergencia es de la Demo 2.

### 4. Dispositivos y roles

| Quién | Dispositivo | Entra como |
|---|---|---|
| Presentador | Compu con proyector, ventana normal | Operario |
| Presentador | Misma compu, **ventana de incógnito** | Destinatario (seguimiento) |
| Integrante 1 | Celular | Sofía (2222) |
| Integrante 2 | Celular | Santiago, el repartidor que se crea en vivo |
| Integrante 3 | Celular | Lucas (1111) |
| Integrante 4 | Celular | Valentina (4444) |
| Integrante 5 | Celular | Juan (6666) |
| Integrante 6 | Celular | Mateo (3333) |

Cada sesión necesita su propio navegador: el operario y un repartidor no pueden estar en la misma ventana.

### 5. Justo antes de empezar (después del seed)

- [ ] Abrir `https://ingenieria-de-software-seven.vercel.app` y esperar a que cargue. Render se duerme a los 15 minutos sin uso y tarda cerca de 1 minuto en despertar. Mientras el panel del operario esté abierto, no se duerme.
- [ ] **Los repartidores del seed entran antes**: Lucas, Sofía, Valentina, Juan y Mateo ingresan su PIN y se quedan en "Fuera de jornada". **No tocar "Iniciar jornada" todavía.**
- [ ] El login acepta **5 intentos por minuto por IP**, y todos los celulares en el mismo Wi-Fi comparten IP. Entrar de a 4 por minuto, o usar datos móviles. Si aparece "Demasiados intentos", esperar un minuto.
- [ ] No tocar el menú **Excepciones**: es de la Demo 2 y dice "en construcción".
- [ ] La app del repartidor se actualiza cada 10 segundos y el panel del operario, cada 15. Después de cada acción, esperar a que se refresque antes de comentar.

### Datos para tener a mano

| Para | Dato |
|---|---|
| DNI repetido (paso 3.2) | 30.000.002 (es el de Sofía) |
| Repartidor nuevo (paso 3.3) | Santiago Ferreyra · moto · DNI 35.123.456 · tel. 221 555-7788 · santi@example.com · Calle 13 456 |
| Envío 1 (paso 5.2) | Pizzería Los Hijos · Calle 50 1234, 2° A · Juan Pérez · tel. 221 600-1234 · **DNI 28.555.444** · Chico · obs. "Tocar timbre 2A" |
| DNI incorrecto (paso 6.6) | 28.555.445 |
| Envío que vence (paso 5.1) | Kiosco Don Pepe · Calle 60 450 · Elena Ruiz · tel. 221 600-2222 · **Mediano** |
| Envío 3 (paso 8.1) | Kiosco Don Pepe · Calle 9 300 · Pedro Gil · tel. 221 600-3333 · Chico |
| Envío 4 (paso 9.2) | Kiosco Don Pepe · Calle 2 150 · Rosa Luna · tel. 221 600-4444 · Chico |

---

## Recorrido

### Bloque 1 · Ingreso del operario (2 min)

| # | Quién | Acción | Qué tiene que verse |
|---|---|---|---|
| 1.1 | Operario | Entrar a `/operario/login` con `admin` y una contraseña incorrecta | "Los datos ingresados no son correctos." |
| 1.2 | Operario | Entrar con `admin` / `admin1234` | Panel de envíos con las pestañas de envíos pendientes, en curso y finalizados. Hoy no hay ninguno en curso |

### Bloque 2 · Comercios (5 min)

| # | Quién | Acción | Qué tiene que verse |
|---|---|---|---|
| 2.1 | Operario | **Comercios**. Buscar "far" | Solo Farmacia Plaza Moreno. La columna Evidencia muestra qué exige cada comercio |
| 2.2 | Operario | **+ Nuevo Comercio**: Pizzería Los Hijos · Calle 7 880 · 221 455-1234 · pizzeria@example.com · marcar **Exigir DNI** · **Guardar Comercio** | "Comercio registrado exitosamente" y aparece en la lista con evidencia "DNI" |
| 2.3 | Operario | **+ Nuevo Comercio** con nombre "kiosco don pepe" (en minúsculas) | "El comercio ya se encuentra registrado" y no se crea |
| 2.4 | Operario | **Editar** Librería del Bosque: desmarcar foto, marcar DNI · **Guardar Comercio** | Evidencia "DNI". Los envíos que ya tenía siguen exigiendo foto: se ve en el detalle del envío de Laura Méndez (Envíos → Finalizados) |
| 2.5 | Operario | **Dar de Baja** Heladería Polo Norte y confirmar | Desaparece de la lista y del formulario de envíos |

La baja **fallida** (comercio con envíos en curso) va en el paso 6.4, cuando ya hay un envío en viaje.

### Bloque 3 · Repartidores (6 min)

| # | Quién | Acción | Qué tiene que verse |
|---|---|---|---|
| 3.1 | Operario | **Repartidores** | Lista con el DNI enmascarado (•••••001). Tomás figura inactivo |
| 3.2 | Operario | **+ Nuevo repartidor** con los datos de Santiago, pero DNI **30.000.002** | "El repartidor ya se encuentra registrado" |
| 3.3 | Operario | Corregir el DNI a **35.123.456** y crear | Ventana "PIN de acceso asignado" con el PIN. **El integrante 2 lo anota**: se muestra una sola vez |
| 3.4 | Operario | **Reactivar** a Tomás y confirmar | Vuelve a activo y se muestra su PIN nuevo |
| 3.5 | Operario | **Resetear PIN** de Tomás | PIN nuevo. El anterior deja de servir |
| 3.6 | Operario | **Editar** a Tomás: vehículo Auto → Moto · **Guardar cambios** | Figura con moto. Cambiar el vehículo con un viaje en curso está bloqueado: se muestra en el paso 10.1 |

### Bloque 4 · Jornada y flota (5 min)

| # | Quién | Acción | Qué tiene que verse |
|---|---|---|---|
| 4.1 | Santiago | En el celular, entrar a `/repartidor/login` con un PIN equivocado y después con el suyo | "PIN incorrecto". Después, la pantalla "Fuera de jornada" con el botón "Iniciar jornada" |
| 4.2 | Lucas, Sofía, Santiago, Valentina | **Iniciar jornada en este orden**, de a uno | Cada uno pasa a "Disponible". **El orden importa**: es el orden de la cola |
| 4.3 | Operario | **Flota** | Motos: cola #1 Lucas ("2 viajes seguidos"), #2 Sofía, #3 Santiago. Autos: Valentina. Camiones: cola vacía con "No hay repartidores disponibles" y Martina destacada en rojo con 🚨 |
| 4.4 | Sofía | **Pausar** y después **Reanudar** | Al pausar sale de la cola. Al reanudar vuelve **al final**: Lucas, Santiago, Sofía. Su contador de viajes seguidos vuelve a 0 |

### Bloque 5 · Envíos y ofertas (6 min)

| # | Quién | Acción | Qué tiene que verse |
|---|---|---|---|
| 5.1 | Operario | **Envíos → + Registrar nuevo envío** con el envío que vence (Kiosco, **Mediano**) | Se guarda. **A Valentina le llega la oferta: NO la toca.** Anotar la hora: vence en 5 minutos (se retoma en el bloque 7) |
| 5.2 | Operario | Registrar el **envío 1** (Pizzería Los Hijos) primero **sin DNI** y después con DNI 28.555.444 | Sin DNI no deja guardar: el comercio lo exige. Con DNI: "Pedido guardado" con el código de seguimiento y **Copiar link de seguimiento** (copiarlo) |
| 5.3 | Santiago | Recibe la oferta | Tarjeta "Nuevo viaje" con retiro, entrega, tamaño y cuenta regresiva de 5 minutos. **Lucas no la recibió aunque era el primero**: tenía 2 viajes seguidos, así que el sistema lo salteó y lo mandó al final con el contador en 0 (se ve en Flota) |
| 5.4 | Santiago | **Rechazar** | La oferta pasa a Sofía. Santiago vuelve al final de la cola |
| 5.5 | Sofía | **Aceptar** | Su pantalla muestra el viaje. En el panel, el envío pasa a "En curso", con Sofía como repartidor |
| 5.6 | Operario | **Envíos**: buscar por el código del envío 1 y filtrar por comercio | Aparece solo ese envío |

### Bloque 6 · El viaje, de punta a punta (8 min)

| # | Quién | Acción | Qué tiene que verse |
|---|---|---|---|
| 6.1 | Destinatario | En la ventana de incógnito, pegar el link copiado en 5.2 | Estado "Asignado", historial con fecha y hora, "Tu envío todavía no salió hacia tu domicilio". Muestra "Juan P." y "Calle 50", nunca el DNI ni la dirección completa. **No pidió login** |
| 6.2 | Sofía | Mirar la pantalla y abrir **Ver todos los datos del viaje**. Tocar **Voy al comercio** → **Volver** → **Voy al comercio** → **Sí, confirmar** | Arriba, lo de la etapa actual (retirar en, comercio). En el desplegable, todo el viaje. "Volver" no cambia nada; al confirmar pasa al paso 2 de 4, "En camino a retirar" |
| 6.3 | Operario | Abrir el envío 1 → **Modificar datos**: dirección de entrega "Calle 51 777" · **Guardar** | Se guarda. En el celular de Sofía aparece el aviso "La dirección de entrega fue modificada" |
| 6.4 | Operario | **Comercios → Dar de Baja** Pizzería Los Hijos | "El comercio tiene envíos en curso" y sigue activa |
| 6.5 | Sofía | **Paquete retirado** → confirmar | En el seguimiento aparece la **hora de salida** |
| 6.6 | Operario | En el envío 1, **Modificar datos** | "No se puede modificar: el paquete ya fue retirado" |
| 6.7 | Sofía | **Llegué al domicilio** → confirmar | Aparece "DNI de quien recibe". Mientras está vacío, el botón **Entregado** está deshabilitado |
| 6.8 | Sofía | DNI **28555445** → **Entregado** → confirmar | "El DNI no coincide con el del destinatario". El envío sigue "En domicilio de entrega" |
| 6.9 | Sofía | DNI **28555444** → **Entregado** → confirmar | "¡Entrega registrada! Ya estás de nuevo en la cola." En Flota, Sofía queda última en la cola de motos |
| 6.10 | Destinatario | Recargar el seguimiento | "Entregado" con la fecha y hora de entrega |
| 6.11 | Operario | Abrir el envío 1 → sección **Historial** | En orden, cada paso con fecha, hora y responsable: Envío registrado (Operario Ana Pérez) → Oferta enviada a Santiago (Sistema) → Oferta rechazada (Repartidor Santiago Ferreyra) → Oferta enviada a Sofía → Asignado → En camino a retirar → Aviso al repartidor y Datos modificados (Operario Ana Pérez) → Paquete retirado → En domicilio de entrega → Entregado, con "Evidencia: DNI verificado" |

### Bloque 7 · La oferta que venció (3 min, cuando ya pasaron 5 minutos del paso 5.1)

| # | Quién | Acción | Qué tiene que verse |
|---|---|---|---|
| 7.1 | Valentina | Mirar el celular | "La oferta venció." y su estado pasa a "En pausa" |
| 7.2 | Operario | Abrir el envío mediano (pestaña de pendientes) | Sigue **sin asignar**: no hay otro auto ni camión disponible. En el historial: "Oferta vencida por inactividad (Valentina López)", con la hora en que venció y "Sistema" como responsable |
| 7.3 | Juan | **Iniciar jornada** | Le llega la oferta del mediano: un camión también puede llevar un paquete mediano. **Aceptar** |
| 7.4 | Valentina | **Reanudar** | Vuelve a la cola de autos. Ese envío no se le vuelve a ofrecer |

Si el profe quiere ver el historial de una oferta vencida sin esperar, abrir el envío de **Carlos Medina** (Finalizados), que es de ayer.

### Bloque 8 · Cambio de tamaño y cancelación (3 min)

| # | Quién | Acción | Qué tiene que verse |
|---|---|---|---|
| 8.1 | Operario | Registrar el **envío 3** (Kiosco, Chico) | La oferta le llega a **Lucas**, que ya tiene el contador en 0. Lucas **Acepta** |
| 8.2 | Operario | En el envío 3 → **Modificar datos**: tamaño **Grande** · **Guardar** | Vuelve a "Pendiente" sin repartidor, porque ahora requiere camión y Juan está ocupado. Lucas vuelve a la cola. Historial: "Cambio de tamaño a Grande: ahora requiere Camión y vuelve a Pendiente. El repartidor que lo tenía vuelve a la cola." |
| 8.3 | Operario | **Cancelar envío** → **Sí, cancelar** | Estado "Cancelado". En el historial: "Cancelado" con la hora y "Operario Ana Pérez" |

### Bloque 9 · Regla de los 2 viajes seguidos con un único repartidor (3 min)

| # | Quién | Acción | Qué tiene que verse |
|---|---|---|---|
| 9.1 | Lucas, Santiago, Sofía | **Terminar jornada** → confirmar | Quedan "Fuera de jornada" y desaparecen de la flota. Ahora no queda ninguna moto disponible |
| 9.2 | Mateo | **Iniciar jornada** (tiene 2 viajes seguidos) | En Flota es la única moto en la cola |
| 9.3 | Operario | Registrar el **envío 4** (Kiosco, Chico) | La oferta le llega **igual a Mateo**, porque es el único. En el panel de envíos y en el detalle aparece "⚠️ Asignación por excepción: único repartidor disponible" (requiere el #52). Mateo **Acepta** |

### Bloque 10 · Bajas y cierre (3 min)

| # | Quién | Acción | Qué tiene que verse |
|---|---|---|---|
| 10.1 | Operario | **Repartidores**: **Editar** a Mateo para cambiarle el vehículo, y después **Dar de baja** a Mateo | Las dos acciones dicen "El repartidor tiene un viaje en curso" |
| 10.2 | Operario | **Dar de baja** a Tomás → **Confirmar baja** | Queda inactivo. Con su PIN ya no puede entrar |
| 10.3 | Destinatario | En `/seguimiento`, escribir el código `NOEXISTE22` → **Consultar** | "Código de seguimiento no encontrado", sin salir de la pantalla |
| 10.4 | — | Mostrar la app del repartidor en un celular | Botones grandes, texto legible, máximo 2 toques por acción (RNF-10) |

---

## Cobertura por historia de usuario

Los números de Taiga que conocemos están puestos. Para el resto, completar con el número de Taiga.

| HU | Pasos |
|---|---|
| Login del operario | 1.1, 1.2 |
| Alta de comercio (nombre único) | 2.2, 2.3 |
| Modificar o dar de baja un comercio | 2.4, 2.5, 6.4 |
| Alta de repartidor (DNI único, PIN generado) | 3.2, 3.3 |
| Asignar o regenerar el PIN | 3.3, 3.4, 3.5 |
| Modificar un repartidor y cambiar de vehículo | 3.6, 10.1 |
| Baja y reactivación de repartidor | 3.4, 10.1, 10.2 |
| Login del repartidor por PIN | 4.1 |
| Iniciar, pausar, reanudar y terminar la jornada | 4.2, 4.4, 7.4, 9.1 |
| Flota: estado de los repartidores y orden de cada cola | 4.3, 6.9, 9.2 |
| #2 · Registro de envío | 5.1, 5.2 |
| Motor de asignación FIFO por vehículo | 5.3, 7.3, 8.1 |
| #10 · 2 viajes consecutivos | 4.3 y 5.3 (salteado), 4.4 (pausa), 9.3 (excepción) |
| Recibir, aceptar y rechazar una oferta | 5.3, 5.4, 5.5 |
| Vencimiento de oferta | 5.1, 7.1, 7.2 |
| Panel, búsqueda y detalle de envíos | 5.6, 6.11 |
| Datos esenciales del viaje | 6.2 |
| Avanzar el estado del viaje (2 toques) | 6.2, 6.5, 6.7 |
| #31 · Modificar un envío antes del retiro | 6.3, 6.6, 8.2 |
| Confirmar la entrega | 6.9 |
| Verificar el DNI de quien recibe | 6.7, 6.8, 6.9 |
| Seguimiento del destinatario | 6.1, 6.5, 6.10, 10.3 |
| Historial del envío | 6.11, 7.2, 8.2, 8.3 |
| Cancelar un envío | 8.3 |
| #35 y #36 · Cierre de jornada | Sprint 2: no se muestran |

---

## Si algo sale mal

| Problema | Qué hacer |
|---|---|
| La página tarda en cargar | Render se estaba despertando: esperar cerca de 1 minuto |
| "Demasiados intentos" al entrar | Esperar un minuto (límite de 5 logins por minuto por IP) |
| La oferta no aparece | La app consulta cada 10 segundos: esperar. Si no llega, revisar en Flota que el repartidor esté en la cola y no "Con oferta" de otro envío |
| La oferta le llegó a otro repartidor | Alguien inició la jornada en otro orden. Seguir con quien la recibió |
| Un repartidor quedó trabado con un envío | El operario cancela el envío desde el detalle |
| Hay que volver a empezar | Correr de nuevo el seed (sección 2) y volver a hacer el login de los celulares |
