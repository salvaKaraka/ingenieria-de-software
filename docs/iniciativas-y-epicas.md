# Iniciativas y épicas

> Transcripción de [`originales/iniciativas_y_epicas.pdf`](originales/iniciativas_y_epicas.pdf). Las épicas están numeradas `<iniciativa>.<épica>` (por ejemplo, 2.3) para poder referenciarlas desde [TAREAS.md](../TAREAS.md).

---

## Iniciativa 1: Centralizar la gestión de pedidos

**Objetivo:** reemplazar la gestión dispersa entre WhatsApp y planillas por un espacio único donde el operario pueda registrar, consultar y supervisar los envíos de la jornada. Se busca evitar que se traspapelen pedidos y sostener la operación cuando se reciben 50 pedidos diarios, volumen que Martín identificó como problemático.

**Resultado esperado:** que el operario pueda registrar los pedidos en el sistema y gestionar los envíos durante la jornada, con sus datos y estado disponibles para consulta. La cifra de 50 pedidos diarios se toma como referencia de la primera entrevista; la capacidad objetivo deberá poder escalar con el negocio.

### Épica 1.1 · Registro y consulta de envíos
El operario necesita registrar en el sistema los datos necesarios para gestionar cada pedido (comercio, origen, destino, destinatario y características del paquete) y poder consultar posteriormente la información de los envíos. Esta épica reúne las funciones de carga, búsqueda y visualización de pedidos.

### Épica 1.2 · Administración de comercios
El operario necesita mantener la información de los comercios que solicitan repartos y las condiciones que establecen para sus entregas, como la exigencia de fotografía, DNI o ambas evidencias. Esto permite asociar cada envío con su comercio y aplicar sus requisitos durante la operación.

### Épica 1.3 · Panel de gestión de pedidos
El operario necesita visualizar los envíos pendientes y en curso desde un panel central para identificar qué pedidos requieren atención y supervisar el trabajo de la jornada sin recurrir constantemente a WhatsApp o Excel.

**Alcance:** el operario carga los pedidos que recibe por WhatsApp u otros medios de forma manual. El sistema organiza y facilita la gestión de esa información una vez ingresada; la recepción de mensajes queda fuera de esta iniciativa.

---

## Iniciativa 2: Dar visibilidad de los envíos a los destinatarios

**Objetivo:** ofrecer al destinatario un portal web seguro y autónomo que le permita consultar el estado y horario de su paquete desde su celular, eliminando la necesidad de registrarse, instalar aplicaciones o comunicarse por WhatsApp. Se busca que el 100% de los envíos cuente con un enlace de seguimiento desde su registro.

**Resultado esperado:** eliminar la sobrecarga de mensajes de consulta ("¿dónde está mi paquete?") en WhatsApp y reducir la atención manual por parte del operario. Permitir que los destinatarios accedan directamente desde sus celulares mediante un código o enlace seguro, sin barreras de registro ni instalación de software. Brindar información útil (como la hora en que el paquete salió hacia el domicilio o ventanas estimativas) excluyendo intencionalmente rastreos GPS en tiempo real o mapas complejos.

### Épica 2.1 · Consulta mediante identificador único y seguro
El destinatario puede acceder a la pantalla de seguimiento haciendo clic en un enlace único o ingresando su código de seguimiento privado. Puede consultar la información de su paquete de forma inmediata, sin crear una cuenta, iniciar sesión ni recordar contraseñas.

### Épica 2.2 · Navegación web adaptativa desde dispositivos móviles
El destinatario puede abrir el portal desde cualquier navegador web en su celular, tablet o computadora. La interfaz se adapta automáticamente a la pantalla (responsive) para consultar el envío de forma liviana y rápida, sin descargar ni instalar ninguna aplicación.

### Épica 2.3 · Seguimiento del estado del paquete y registro histórico
El destinatario puede visualizar la línea de progreso del ciclo de entrega (Pendiente, Asignado, En camino a retirar, Paquete retirado, En domicilio de entrega y Entregado) y consultar la fecha y hora exacta en que se registró cada cambio de estado de su paquete.

### Épica 2.4 · Consulta de horarios clave y ventana estimada de entrega
El destinatario puede verificar el horario en que su paquete salió hacia su domicilio y el rango estimado de llegada. Esto le permite organizarse para recibir el pedido con previsibilidad, sin necesidad de un mapa ni de seguimiento GPS en tiempo real.

### Épica 2.5 · Privacidad y protección de datos sensibles
El destinatario puede verificar el progreso de su envío sin exponer su información privada. La pantalla oculta o enmascara los datos sensibles (como el DNI o la dirección completa), lo que le permite compartir el enlace de seguimiento sin comprometer su seguridad personal.

### Épica 2.6 · Visualización de incidencias y excepciones de entrega
El destinatario puede consultar avisos claros si ocurrió una eventualidad en la calle (por ejemplo, si el repartidor pasó y no encontró a nadie en el domicilio o si hubo una reprogramación). Esto le da certeza inmediata sobre el estado de su envío sin necesidad de enviar mensajes de consulta.

**Alcance:** el destinatario consulta de forma autónoma el estado y los horarios clave de su paquete mediante un identificador seguro. Esta solución brinda una experiencia de acceso inmediato sin requerir registro de usuario, descarga de aplicaciones ni interacción por WhatsApp. Quedan excluidos de este alcance el rastreo GPS en tiempo real sobre mapa, el procesamiento de pagos y la atención por chat en vivo.

---

## Iniciativa 3: Distribuir los viajes de forma ágil y equitativa

**Objetivo:** automatizar la asignación de pedidos a los repartidores disponibles mediante un motor de despacho basado en una cola FIFO con reglas de negocio equitativas, eliminando la selección manual arbitraria del operario. Se busca resolver la asignación de cada envío en no más de 3 segundos y evitar la sobrecarga de trabajo entre los choferes activos.

**Resultado esperado:** suprimir la posibilidad de favoritismo o reparto desigual de viajes entre los choferes mediante un algoritmo transparente y determinista. Garantizar que ningún paquete quede sin despachar por falta de filtro vehicular (asociando correctamente motos, autos o camiones según el volumen) y mantener un flujo continuo de entregas respetando la regla de descanso/rotación de un máximo de 2 viajes consecutivos por repartidor.

### Épica 3.1 · Gestión de disponibilidad y estado de la flota
El sistema necesita conocer en tiempo real qué repartidores están operativos, su vehículo asociado (Moto, Auto o Camión) y su estado (Disponible, Ocupado, En pausa o Emergencia). Esta épica abarca el alta de repartidores, su ingreso a la jornada, el cambio de estado operativo y el mantenimiento de las colas de espera organizadas por tipo de vehículo.

### Épica 3.2 · Motor de asignación automática por cola FIFO y filtro vehicular
El sistema debe procesar los pedidos pendientes y cruzarlos con la flota activa, manteniendo una cola FIFO por cada tipo de vehículo para encontrar rápidamente al repartidor adecuado para cada paquete. La asignación evalúa en orden de llegada a los repartidores que disponen del vehículo requerido y aplica de forma estricta la regla de descarte temporal a quienes completaron 2 envíos consecutivos, garantizando una distribución equitativa del trabajo.

### Épica 3.3 · Oferta, temporización y gestión de aceptación del viaje
El repartidor seleccionado recibe la propuesta del viaje en su celular con un temporizador estricto de 5 minutos (300 segundos) para aceptarla o rechazarla. Esta épica contempla el control de la cuenta regresiva, la confirmación que pasa el paquete a estado Asignado y la reincorporación del pedido al motor de asignación si el repartidor rechaza la oferta o vence el tiempo límite.

### Épica 3.4 · Registro y auditoría de rechazos e inactividad
El sistema debe registrar las respuestas de cada repartidor: viajes aceptados, rechazados y ofertas vencidas por inactividad. Esta épica permite al operario monitorear el comportamiento de la flota, detectar demoras injustificadas en la aceptación y contar con datos objetivos para evaluar la permanencia de los repartidores en el servicio.

**Alcance:** comprende la lógica de cola FIFO, la correspondencia paquete-vehículo, el control de consecutividad de viajes, la emisión de ofertas temporizadas a 5 minutos y la auditoría de respuestas. Quedan explícitamente excluidos los algoritmos de optimización de rutas geográficas complejas, el cálculo de tarifas o comisiones por viaje, y el rastreo por mapa GPS en tiempo real.

---

## Iniciativa 4: Facilitar la ejecución de las entregas en la calle

**Objetivo:** proporcionar al repartidor una web móvil optimizada que le permita recibir, gestionar y confirmar sus asignaciones directamente desde la calle mediante interacciones breves y ágiles. Se busca reducir la fricción operativa y garantizar que cualquier actualización de estado o registro de entrega se realice en no más de 2 toques sobre la pantalla, cumpliendo con lo establecido en el RNF-10.

**Resultado esperado:** eliminar la necesidad de reportar estados mediante mensajes de texto o audios de WhatsApp. Conseguir que el repartidor pueda consultar la información esencial del pedido, informar el avance de su recorrido en tiempo real y registrar las evidencias de entrega de forma inmediata sin demorar el flujo de trabajo en la vía pública.

### Épica 4.1 · Vista y gestión de viajes del repartidor
El repartidor necesita ver de manera clara en la pantalla de su celular los envíos que tiene asignados. Esta épica abarca la presentación de los datos indispensables para ejecutar la entrega (dirección de origen y destino, nombre del destinatario, observaciones del paquete y requisitos fijados por el comercio), organizados de forma prioritaria para evitar distracciones mientras conduce.

### Épica 4.2 · Actualización rápida del recorrido en vía pública
El repartidor necesita informar los cambios de estado del envío ("En camino a retirar", "Paquete retirado" y "En domicilio de entrega") a medida que avanza su jornada. Para cumplir con el RNF-10, la interfaz permite confirmar cada hito en hasta 2 toques de pantalla y actualiza automáticamente el estado del pedido en el sistema central.

### Épica 4.3 · Captura y registro de evidencia de entrega
El repartidor necesita registrar la constancia que valida la recepción del paquete según las exigencias configuradas por cada comercio. Esta épica contempla tomar fotografías del paquete entregado, ingresar el DNI del receptor o capturar ambas evidencias en el momento de la entrega, asociándolas al historial del envío antes de marcarlo como completado.

### Épica 4.4 · Notificación y registro de eventualidades en ruta
El repartidor necesita un canal directo dentro de la web móvil para reportar imprevistos menores durante la entrega (como "Cliente ausente" o "Dirección incorrecta"). La épica contempla la selección rápida del tipo de novedad y el registro de comentarios breves, para que el operario quede notificado al instante y pueda gestionar la reprogramación o devolución del envío.

**Alcance:** comprende la web móvil para el repartidor, la visualización de datos de entrega, el cambio de estados en un máximo de 2 toques, el registro de evidencias (foto/DNI) y la notificación de novedades simples en ruta. Quedan explícitamente excluidos el seguimiento por mapa GPS en tiempo real, la reasignación automática por avería o accidente grave (tratados en la gestión de incidentes), el cálculo de cobros/liquidaciones en efectivo y el chat de soporte en vivo.

---

## Iniciativa 5: Resolver imprevistos sin perder el control de la operación

**Objetivo:** establecer un mecanismo de respuesta rápida ante imprevistos durante los repartos. Se busca evitar que los incidentes (como alguna falla de vehículo en un repartidor u otro problema que impida la continuación del reparto) frenen las entregas, garantizando que el sistema pueda reasignar los pedidos afectados a otro conductor en menos de 5 segundos, conforme a lo exigido en el RNF-13.

**Resultado esperado:** que el sistema cuente con un flujo de emergencia donde el repartidor pueda notificar su impedimento y la plataforma reasigne automáticamente el pedido, manteniendo los tiempos de entrega. Los casos que fallen en la reasignación automática deberán quedar a disposición del operario para su resolución manual.

### Épica 5.1 · Reporte de incidentes
El repartidor necesita una función en la web móvil que le permita avisar de manera rápida y fácil sobre una emergencia, falla o problema que le impida continuar con la entrega. Esto alerta al sistema de forma inmediata para frenar su recorrido y activar el protocolo de emergencia.

### Épica 5.2 · Reasignación de envíos
El sistema necesita buscar automáticamente un reemplazo apto (otro repartidor disponible con el mismo tipo de vehículo) y actualizar el punto de partida del envío original. Esta reasignación de emergencia debe ocurrir en menos de 5 segundos (RNF-13).

### Épica 5.3 · Supervisión de excepciones
El operario necesita visualizar y gestionar desde su panel los incidentes que el sistema no pudo reasignar automáticamente, para revisar el estado del pedido detenido y resolverlo de forma manual.

**Alcance:** el sistema contempla la notificación del incidente por parte del repartidor, la lógica de reasignación automática y la vista de resolución manual para el operario. Quedan excluidas de esta iniciativa las gestiones físicas de recuperación del paquete parado o la comunicación externa con seguros y grúas.

---

## Iniciativa 6: Controlar el cierre de jornada y la logística inversa de devoluciones

**Objetivo:** automatizar la conciliación de paquetes al finalizar el turno de cada repartidor y estructurar la devolución de mercancía no entregada (por ausencias o averías) hacia los comercios de origen, garantizando el control físico del 100% de las devoluciones.

**Resultado esperado:** conseguir que al finalizar la jornada laboral cada repartidor rinda digitalmente desde la web móvil el estado de sus viajes realizados vs. los paquetes que debe devolver físicamente en la base. Eliminar la pérdida de stock y la falta de trazabilidad de los paquetes no entregados mediante la emisión automatizada de órdenes de retorno hacia los comercios de origen y el registro inalterable del reingreso a depósito.

### Épica 6.1 · Rendición digital de cierre de jornada
El repartidor necesita solicitar el cierre de su jornada desde la web móvil y rendir los paquetes entregados frente a los que debe devolver en la base. El operario necesita validar esa rendición antes de cerrar el turno, de modo que ningún paquete quede sin conciliar.

### Épica 6.2 · Recepción y custodia temporal en depósito
El operario necesita registrar el reingreso de cada paquete no entregado mediante su código de seguimiento, para que quede en custodia del depósito con registro inalterable de fecha, hora y responsable. También necesita alertas sobre los paquetes que llevan demasiado tiempo en custodia sin devolverse.

### Épica 6.3 · Programación y confirmación de devoluciones a comercios
El operario necesita agrupar los paquetes en custodia por comercio de origen y generar la orden de devolución, que se asigna a un repartidor como un viaje más. El repartidor registra la constancia de recepción del comercio, y con eso se cierra el ciclo del paquete.

**Alcance:** comprende la solicitud de cierre de jornada desde la web móvil, la validación del reingreso físico a depósito por el operario, la agrupación de paquetes devueltos por comercio de origen, la generación de la orden de retorno y el registro de la evidencia final de recepción por el comercio. Quedan explícitamente excluidos la gestión de cobros o reembolsos monetarios en efectivo, el pago de comisiones a repartidores y la reprogramación automática de franjas horarias con el cliente final.
