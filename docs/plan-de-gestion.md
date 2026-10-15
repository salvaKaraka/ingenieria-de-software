# Plan de Gestión de Proyecto (PGP)

> Transcripción de [`originales/pgp.pdf`](originales/pgp.pdf) (revisión 1). Se omiten el gráfico de competencia y el detalle de horas por actividad; para eso, ver el original.

## 1. Introducción

### Propósito y alcance

Definir la estructura organizativa, la estimación de esfuerzo, la planificación temporizada y el plan de mitigación de riesgos para el desarrollo del MVP del sistema. Dirigido a Martín y a la Dirección de la Empresa de Logística Operativa (cliente/patrocinador).

El alcance abarca la digitalización de la logística urbana: recepción centralizada de pedidos de comercios, algoritmo de despacho FIFO filtrado por vehículo y con control de carga, portal móvil liviano para repartidores con ingreso por PIN, gestión de emergencias en vía pública, seguimiento web pasivo por ID para destinatarios y, en una segunda fase, el módulo de rendición de cierre de jornada y devoluciones a comercios.

### Definiciones

- **MVP:** Producto Mínimo Viable; versión inicial operativa.
- **FIFO:** algoritmo de despacho por orden estricto de llegada.
- **PIN:** clave numérica de 4 a 6 dígitos para acceso rápido de repartidores.
- **HU:** historia de usuario, con sus reglas y criterios de aceptación.
- **RNF:** requerimiento no funcional (ver [requerimientos-no-funcionales.md](requerimientos-no-funcionales.md)).
- **Scrum / Sprint:** cada sprint es un ciclo de desarrollo de tres semanas que finaliza con una demo.
- **Operario:** persona de la empresa que gestiona los pedidos y supervisa la operación desde el panel web.

## 2. Planes generales

### Entregables

Un sistema web para gestionar el envío de paquetes de distintos comercios a sus destinatarios, con asignación automática de los viajes a los repartidores. Si surge un problema con el repartidor que impide la entrega, el sistema intentará resolverlo de forma automática en menos de 5 segundos, asignando el paquete a otro repartidor; si no lo logra, el caso quedará a disposición del operario para su resolución manual.

1. **Panel web de gestión logística (frontend web)**
   - Módulo de comercios y pedidos: registro y consulta de envíos, alta y administración de comercios adheridos.
   - Módulo de operador / consola central: visualización de viajes, gestión de excepciones (reubicación/reasignación), seguimiento de colas FIFO por tipo de vehículo y monitoreo de incidentes.
   - Portal de seguimiento del destinatario: interfaz web adaptativa para consultar el estado del paquete mediante un identificador único.
2. **Web móvil para repartidores**
   - Módulo de jornada y disponibilidad: estado del repartidor (Disponible, En pausa, Emergencia) e ingreso a la cola FIFO.
   - Módulo de recepción y ejecución de envíos: oferta temporizada de viajes (5 minutos), vista ágil de origen/destino y cambio de estados en 2 toques.
   - Módulo de captura de evidencia y excepciones: cámara para fotos/DNI y reporte de imprevistos en ruta.
3. **Servidor core y servicios de asignación (backend y API)**
   - Motor de asignación FIFO: distribución equitativa filtrando por tipo de vehículo, asignación en no más de 3 segundos y reasignación automática ante rechazos, vencimientos de oferta e incidentes (< 5 s).
   - API REST y persistencia: trazabilidad completa del ciclo de vida del pedido, rendición de jornadas y almacenamiento de evidencias.
4. **Documentación técnica y manuales**: PGP, SRS, manuales de operación y capacitación.

### Cronograma de entregas

| ID | Entregable | Tipo | Descripción | Fecha |
|---|---|---|---|---|
| E-01 | Análisis e investigación | Documentación | Entrevistas, cuestionarios y RNF | 21/09/2026 |
| E-02 | Base del proyecto | Documentación | Iniciativas, épicas, HU y PGP | 05/10/2026 |
| E-03 | **Demo 1** | Software | Flujo principal del MVP: gestión de pedidos y comercios, motor de asignación FIFO, ejecución básica de entregas (vista del viaje y cambios de estado) y seguimiento web del destinatario | **30/10/2026** |
| E-04 | **Demo 2** | Software | Resto del MVP: captura de evidencias, novedades en ruta, gestión de incidentes con reasignación automática, herramientas del operario y pruebas de aceptación | **20/11/2026** |
| E-05 | **Fase 2** | Software | Rendición digital de jornada, custodia en depósito y devoluciones (iniciativa 6) | **27/11/2026** |
| E-06 | Entrega final | Software y documentación | Repositorio con backend, frontend y web móvil, manuales de usuario y pruebas finales | 11/12/2026 |

### Calendario y presupuesto

- **Fase MVP:** del 09/10/2026 al 20/11/2026.
- **Fase 2:** fines de noviembre de 2026.
- **Puesta en producción:** mediados de diciembre de 2026.
- **Soporte y mantenimiento:** 3 meses posteriores al despliegue final.
- **Presupuesto total:** $39.671.750 ARS (1.318 h × $30.000 + $131.750 de infraestructura: dominio `.com.ar`, hosting y almacenamiento de fotos durante 5 meses).

### Roles del equipo (6 personas)

| Rol | Personas | Responsabilidad |
|---|---|---|
| Líder de proyecto | 1 | Gestión general, ceremonias Scrum, presupuesto, riesgos y relación con el cliente |
| Analista funcional | 1 | Elicitación, historias de usuario, criterios de aceptación y capacitación |
| Arquitecto de software y desarrollador backend | 2 | Arquitectura, base de datos, motor de asignación FIFO y APIs |
| Desarrollador frontend web y mobile | 1 | Panel de administración, portal del destinatario y web móvil del repartidor |
| QA / tester | 1 | Pruebas unitarias, de integración y de rendimiento; validación de RNF |

## 3. Riesgos

La prioridad combina probabilidad e impacto: **Alta** cuando ambos son altos o uno es alto y el otro medio; **Media** cuando ambos son medios o uno es alto y el otro bajo; **Baja** en el resto. El equipo trata activamente los de prioridad Alta (del 1 al 11).

| N° | Riesgo | Responsable | Prob. / Impacto / Prioridad | Mitigación | Contingencia |
|---|---|---|---|---|---|
| 1 | **Cambios de requerimientos o de alcance**: el cliente pide cambios o define tarde puntos pendientes (criterio de clasificación, vencimiento de los 5 minutos, canal de ingreso) | Analista funcional | Alta / Alto / **Alta** | Validar los pendientes antes de la iniciativa 3, congelar el alcance de cada sprint y diseñar como **parámetros configurables** las reglas sujetas a cambio (tiempos, categorías, vehículos) | Control formal de cambios: registrar, estimar, acordar con el cliente y pasar al próximo sprint o a la fase 2 |
| 2 | **Superposición con otros compromisos del equipo** (exámenes, otros proyectos) | Líder | Alta / Medio / **Alta** | Relevar compromisos en cada planning, comprometer menos HU en semanas cargadas y adelantar las críticas | Pasar HU no críticas al sprint siguiente y reforzar después |
| 3 | **Desvío en la estimación** de las épicas complejas (motor FIFO, oferta temporizada, reasignación) | Líder | Media / Alto / **Alta** | Seguimiento de horas reales vs. estimadas y priorizar las épicas críticas en los primeros sprints | Mover épicas no críticas a la fase 2 y reestimar si el desvío supera el 10% |
| 4 | **Falta de experiencia con las tecnologías** (framework, base, tiempo real para ofertas) | Arquitecto / backend | Media / Alto / **Alta** | Tecnologías conocidas por al menos dos integrantes; prueba de concepto temprana del temporizador de 5 minutos y la actualización en tiempo real | Programación de a pares, simplificar (por ejemplo, **actualización periódica en lugar de tiempo real**) y reestimar |
| 5 | **Falta de coordinación entre integrantes** que trabajan en paralelo | Líder | Media / Alto / **Alta** | Definir al inicio los contratos de la API, el modelo de datos y las convenciones; integrar en la rama principal al menos una vez por semana | Sesión de integración con todo el equipo; priorizar correcciones de integración |
| 6 | **Ausencias en el equipo** | Líder | Media / Alto / **Alta** | Tareas actualizadas en Taiga, repositorio comentado, guías unificadas y cada HU conocida por al menos dos integrantes | Redistribuir tareas críticas en la daily o la planning |
| 7 | **Fallo de concurrencia en la asignación**: el mismo repartidor recibe más de una oferta o se duplican viajes | Arquitecto / backend | Media / Alto / **Alta** | Transacciones atómicas, **bloqueos a nivel de fila** y procesamiento secuencial | Revertir la transacción, devolver al repartidor a la cola y reasignar en menos de 2 s |
| 8 | **Incumplimiento de tiempos** (asignación > 3 s o reasignación > 5 s) | QA | Media / Alto / **Alta** | Pruebas de rendimiento desde el primer sprint con más de 50 pedidos y optimización de consultas | Analizar el cuello de botella, ampliar el servidor y derivar al panel de excepciones lo que supere el límite |
| 9 | **Pérdida de conectividad** al registrar la entrega | Frontend | Media / Alto / **Alta** | Guardado local en el teléfono de imágenes, DNI y cambios de estado sin conexión | Sincronizar al volver la señal; si no, el operario registra la entrega desde el panel |
| 10 | **Batería del celular del repartidor** | Frontend | Alta / Medio / **Alta** | **Modo oscuro por defecto**, optimizar el uso de la cámara y evitar consumo en segundo plano | Cargadores en los comercios o validación manual del operario |
| 11 | **Retiro masivo de motos** (por ejemplo, tormenta) con alta demanda | Analista funcional | Media / Alto / **Alta** | Regla de contingencia activable por el operario: **asignar autos a paquetes chicos** cuando no hay motos | Pausar la entrada de pedidos y avisar a los comercios |
| 12 | Rechazo del repartidor a adoptar la web móvil | Líder | Media / Medio / Media | Limitar a 2 toques (RNF-10) | Demostración de 10 minutos y soporte la primera semana |
| 13 | Baja disponibilidad del cliente para validar avances | Analista funcional | Media / Medio / Media | Fechas de demo acordadas y resumen escrito de cada demo | Avanzar con supuestos documentados y validarlos después |
| 14 | Foto de evidencia ilegible | QA | Media / Medio / Media | **Vista previa** que verifique enfoque y tamaño antes de confirmar | Reintento ágil o evidencia alternativa con DNI autorizada por el operario |
| 15 | Inconsistencia en las reglas de evidencia de un comercio | Analista funcional | Media / Medio / Media | **Fijar la regla de evidencia al crear el envío** | El operario puede modificar o autorizar la regla de un envío en curso |
| 16 | Discrepancia en el conteo de paquetes al cierre de jornada | QA | Media / Medio / Media | Lectura del código de seguimiento al reingresar el paquete al depósito | Marcar "En discrepancia" y notificar al comercio |
| 17 | Acumulación de paquetes no entregados en depósito | Analista funcional | Media / Medio / Media | **Avisos para paquetes con más de 24 h en custodia** | Orden de devolución agrupada y aviso al comercio |
| 18 | Problemas de visualización en navegadores móviles (Safari, Chrome, Firefox) | Frontend | Media / Medio / Media | Maquetar con Flexbox/Grid y probar en emuladores y celulares reales | Estilos correctivos o vistas simplificadas |
| 19 | Exposición de datos personales (DNI, dirección) | Arquitecto / backend | Baja / Alto / Media | Enmascarar datos en el seguimiento, **códigos no predecibles**, HTTPS y panel solo con sesión | Invalidar enlaces o credenciales, corregir y notificar al cliente |
| 20 | Retrasos en la configuración del servidor y la API | Arquitecto / backend | Baja / Medio / Baja | Automatizar la configuración y documentar el despliegue paso a paso | Asistencia remota o entorno de staging alternativo |

## 4. Competencia

- **Directos:** Andreani, Correo Argentino y OCA. Empresas postales con portales web digitalizados, pero con entregas de 24 a 72 horas y poca inmediatez en el despacho urbano.
- **Indirectos:** Mercado Libre, PedidosYa y Rappi (entregas rápidas, pero con comisiones elevadas o venta dentro de sus plataformas), y WhatsApp + Excel (sin automatización logística ni trazabilidad).
