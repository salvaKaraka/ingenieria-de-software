# Entrevista 2

> Transcripción de [`originales/Entrevista_2-grupo_9.docx`](originales/Entrevista_2-grupo_9.docx).

| | |
|---|---|
| **Proyecto** | Sistema de gestión y seguimiento de repartos |
| **Preparada por** | Rocío Pascual, Diego Vignau, Manuel Toledo, Felipe Soler y Santiago Cortizo |
| **Fecha de preparación** | 8 de septiembre de 2026 |
| **Fase del proyecto** | Elicitación y análisis de requisitos |
| **Lugar** | Videollamada por Google Meet |
| **Fecha, hora y duración** | 10 de septiembre de 2026, 9:20 h, 40 minutos |
| **Entrevistado** | Martín (cliente) |
| **Objetivo** | Profundizar las reglas de negocio y delimitar el alcance del MVP |

## Cuerpo de la entrevista

### Clasificación de paquetes y asignación

- **¿Quién registra y clasifica los paquetes?** El operario registra el envío y clasifica el paquete antes de asignarlo. Se propusieron las categorías Chico, Mediano y Grande, aunque queda pendiente definir si el criterio final utilizará metros cúbicos, peso volumétrico o una combinación.
- **¿Cómo se determina el vehículo?** El operario selecciona moto, auto o camión según la clasificación del paquete.
- **¿Cómo se elige al repartidor?** El sistema evalúa una cola FIFO de repartidores activos y filtra a quienes cuentan con el vehículo adecuado.
- **¿Cómo se evita sobrecargar a un repartidor?** Si el primer candidato ya realizó dos envíos consecutivos, se lo descarta temporalmente y se continúa con el siguiente repartidor válido de la cola.
- **¿Cuánto tiempo tiene para aceptar?** Dispone de cinco minutos. El rechazo queda registrado en su historial; todavía debe definirse el comportamiento ante la falta de respuesta.

### Estados y excepciones

- **¿Cuáles son los estados previstos?** Pendiente o registrado, asignado, en proceso y entregado o finalizado. Dentro de "En proceso" se mencionaron la ida al comercio, la recepción en depósito y el traslado al destino.
- **¿Cómo se gestiona una avería?** La aplicación del repartidor tendrá un botón de auxilio o emergencia. Los pedidos afectados deberán reasignarse y actualizar su punto de partida.
- **¿La reasignación será manual?** Se prefiere un flujo automatizado que busque otro repartidor válido, manteniendo la supervisión del operario para casos excepcionales.

### Roles, accesos y validación

- **¿Qué funciones tendrá el operario?** Registrará envíos, administrará comercios y repartidores, supervisará reasignaciones y generará accesos.
- **¿Cómo accederá el repartidor?** Mediante un PIN entregado por el operario, sin un esquema tradicional de usuario y contraseña.
- **¿Cómo consultará el destinatario?** Sin registro ni aplicación. Accederá al estado del envío mediante un código o identificador seguro.
- **¿Qué datos se registrarán?** Para comercios y repartidores: nombre, teléfono, correo electrónico y dirección. Para el destinatario serán opcionales el nombre, apellido y DNI.
- **¿Cómo se validará la entrega?** Cada comercio definirá si exige fotografía, DNI o ambas evidencias.

### Alcance del MVP

- **¿Qué se incluye en la primera versión?** Control de presencia activa, asignación FIFO filtrada por vehículo y por la regla de dos viajes consecutivos, seguimiento pasivo mediante ID, historial de rechazos y reasignaciones por emergencia.
- **¿Qué queda fuera?** Pagos e ingresos, mapas, geolocalización en tiempo real y ruteo avanzado. El cobro seguirá gestionándose mediante la aplicación externa utilizada por el operario.

## Conclusión

La entrevista permitió definir la lógica principal de asignación y los roles del sistema, además de acordar un MVP centrado en la operación diaria. La solución priorizará la disponibilidad de repartidores, la asignación controlada de viajes, los cambios de estado, la consulta pasiva del destinatario y la trazabilidad de rechazos y emergencias. Los pagos y la optimización de rutas no formarán parte de esta primera versión.

### Informe final

Se consolidaron reglas de negocio suficientes para avanzar con el modelado funcional del MVP. Antes de cerrar los requisitos deberán validarse el criterio de clasificación de paquetes, la definición exacta de los estados, el canal de ingreso de pedidos y el tratamiento de los casos en los que un repartidor no responde dentro del plazo establecido.

### Información obtenida en detalle

- **Clasificación y transporte:** el operario clasifica el paquete y selecciona moto, auto o camión.
- **Asignación:** cola FIFO de repartidores activos, filtrada por vehículo y limitada por la regla de dos viajes consecutivos.
- **Aceptación:** plazo de cinco minutos e historial de rechazos.
- **Estados:** pendiente o registrado, asignado, en proceso y entregado o finalizado.
- **Emergencias:** botón de auxilio y preferencia por la reasignación automática con supervisión del operario.
- **Accesos:** PIN para repartidores y consulta mediante ID seguro para destinatarios.
- **Entrega:** validación mediante fotografía, DNI o ambas, según lo definido por cada comercio.
- **MVP:** sin pagos, geolocalización activa ni ruteo avanzado.

### Información pendiente

- **Canal de ingreso:** confirmar si los comercios continuarán enviando pedidos por WhatsApp.
- **Clasificación:** definir categorías, metros cúbicos y peso volumétrico.
- **Estados:** confirmar los cuatro nombres definitivos y si "En proceso" tendrá subestados.
- **Pago:** aclarar quién paga el envío, quién recibe el dinero y en qué momento se registra el pedido respecto del pago.
- **Falta de respuesta:** definir qué hace el sistema cuando vence el plazo de cinco minutos.
- **Reasignación:** precisar cómo se selecciona al reemplazo y qué intervención conserva el operario.

**Próxima entrevista:** fecha a confirmar.
