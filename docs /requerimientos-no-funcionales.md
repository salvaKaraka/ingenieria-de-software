# Requerimientos no funcionales

> Transcripción de [`originales/requerimientos_no_funcionales-grupo_9.pdf`](originales/requerimientos_no_funcionales-grupo_9.pdf). Identificación: RNF-DEVIX-001.

Consideraciones técnicas acordadas para la primera versión del sistema (MVP): seguridad, mantenimiento, facilidad de uso en celulares y tiempos de respuesta.

## Seguridad y privacidad

**¿Los datos se van a guardar encriptados?**

- **RNF-01 · Cifrado de datos guardados.** Toda la información personal del cliente (DNI, nombre y dirección) y el código de seguimiento se guardarán de forma codificada e ilegible en la base de datos para evitar accesos indebidos.

**¿Las contraseñas van a estar visibles en algún lugar?**

- **RNF-02 · Ocultamiento de credenciales y PIN.** La contraseña del operario y los PINes de los repartidores nunca se mostrarán en texto claro en pantallas, formularios ni reportes impresos o digitales.
- **RNF-03 · Registro de acciones clave.** El sistema guardará un historial automático indicando qué usuario (operario o repartidor) realizó cada cambio importante en un envío (como cancelaciones o reasignaciones) y la hora exacta, para resolver eventuales confusiones en la operación.
- **RNF-04 · Cierre automático de sesión por inactividad.** Si el panel de gestión del operario permanece inactivo durante más de 30 minutos, la sesión se cerrará de forma automática requiriendo nueva autenticación para evitar accesos físicos no autorizados en la base.

## Soporte y cambios a futuro

**¿Cómo vamos a manejarnos si el cliente informa que detectó un bug 3 meses después de estar usando el producto?**

- **RNF-05 · Garantía de corrección de fallas críticas (mantenimiento).** El sistema contará con una garantía técnica. Cualquier fallo crítico que impida la operación diaria de envíos o repartidores será subsanado y puesto a prueba en menos de 24 horas durante el período de garantía, asegurando que la solución no interrumpa el funcionamiento.

**¿Cómo vamos a manejarnos si el cliente solicita agregar nueva funcionalidad después de un tiempo?**

- **RNF-06 · Facilidad para agregar funciones (mantenibilidad).** El sistema se construirá mediante bloques o módulos independientes. Esto permitirá que en el futuro se puedan incorporar nuevas herramientas (como cobros o mapas) sin tener que rehacer el programa desde cero ni alterar los datos guardados.
- **RNF-07 · Disponibilidad del servicio.** El sistema garantizará una disponibilidad operativa del 99,5% durante el horario de actividad logística (lunes a sábados de 08:00 a 21:00 h), minimizando caídas del servicio en horas pico de entrega.
- **RNF-08 · Tolerancia a fallos y reanudación rápida.** Si el servidor sufre una caída imprevista, el sistema deberá reanudar su operación y restablecer el estado exacto de los envíos en curso en un tiempo máximo no superior a 15 minutos.

## Uso en celulares y facilidad de uso

**¿El producto se va a tener que poder ver bien en un celular o no es necesario?**

- **RNF-09 · Uso en celulares de repartidores.** La aplicación para repartidores debe estar optimizada para operar durante una jornada completa de trabajo (al menos 8 horas continuas) sin agotar la batería del dispositivo ni requerir conexiones de alta velocidad.
- **RNF-10 · Facilidad y agilidad de interacción en calle.** La interfaz del repartidor presentará botones grandes y de alto contraste (visibles a la luz del día), permitiendo confirmar un cambio de estado de entrega con no más de dos toques de pantalla.
- **RNF-11 · Acceso web para clientes.** La pantalla de seguimiento del envío se ajustará automáticamente al tamaño de la pantalla del dispositivo que use el cliente (celular, tablet o computadora). Será muy fácil de leer y funcionará directamente desde internet, sin pedir la instalación de ninguna aplicación.

## Rapidez y operativa (rendimiento)

- **RNF-12 · Tiempo de asignación.** El cálculo automático para buscar, filtrar y asignar un envío al repartidor adecuado (evaluando el turno de llegada y el vehículo necesario según el paquete) no tardará más de 3 segundos.
- **RNF-13 · Tiempo de respuesta ante emergencias.** La respuesta ante imprevistos será inmediata. Si un repartidor sufre un problema con su vehículo y presiona el botón de auxilio en su celular, el sistema desestimará a ese chofer y le reasignará el pedido a otro disponible en menos de 5 segundos, actualizando la dirección de partida.
- **RNF-14 · Capacidad para usuarios simultáneos.** El sistema deberá soportar el acceso concurrente de 1 único operario en el panel de gestión (para el MVP y la primera versión) y la operatoria en paralelo de toda la flota activa de repartidores (estimada en hasta 30 repartidores simultáneos), junto con la consulta pasiva de hasta 100 clientes visualizando el estado de sus envíos por hora, garantizando que ninguna interfaz sufra demoras ni bloqueos en la sincronización de estados.
