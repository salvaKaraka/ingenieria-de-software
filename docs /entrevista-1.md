# Entrevista 1

> Transcripción de [`originales/Entrevista_1-grupo_9.doc`](originales/Entrevista_1-grupo_9.doc).

| | |
|---|---|
| **Preparada por** | Grupo 9 |
| **Fecha de preparación** | 17/09/2026 |
| **Fase del proyecto** | Terminando de acomodar las ideas |
| **Lugar** | Facultad de Informática (UNLP), aula 10B |
| **Fecha, hora y duración** | 04/09/2026, 9:20 h, 40 minutos |
| **Entrevistado** | Martín (cliente) |
| **Objetivo** | Sacar la máxima información posible para saber cómo funciona el comercio, dónde están los problemas y hacia dónde se quiere llevar la solución. |

## Preguntas y respuestas

### Operación general y registro

- **¿Cómo reciben los pedidos de los comercios hoy?** Llegan por WhatsApp indicando origen, destino, tamaño del paquete y datos del cliente (nombre, DNI y teléfono).
- **¿Dónde registran la información de las entregas?** El operario pasa todo manualmente a una planilla de Excel que consulta de forma constante.
- **¿Cuál es el principal cuello de botella actual?** Al llegar a 50 pedidos diarios, por ejemplo, el WhatsApp colapsa, se traspapelan mensajes y los comercios se enojan por las demoras.

### Logística y repartidores

- **¿Qué criterio usan para asignar los vehículos?** Se clasifica el paquete según el tamaño y se asigna el transporte adecuado (moto, auto o camión).
- **¿Cómo gestionan a los repartidores en el día a día?** Tienen repartidores que avisan por WhatsApp cuando inician su jornada para quedar activos en el turno.
- **¿Cómo organizan las rutas de entrega?** El operario arma entregas en serie por zonas según disponibilidad, pero necesitan que el cálculo de rutas se automatice.
- **¿Qué estados necesita actualizar el repartidor?** Marcaciones rápidas: "Llegué al comercio", "En camino", "Demorado" y "Cliente no se encuentra".

### Seguimiento y clientes

- **¿Cómo quiere el cliente final ver el estado de su envío?** Quiere ver una actualización básica (saber a qué hora zarpó el pedido) de forma automática y sin hablar por WhatsApp.
- **¿Sirve un link de seguimiento en tiempo real como el de las grandes empresas?** No, descartado. Martín busca evitar enlaces complejos ("un quilombo") y reducir al mínimo la interacción directa con el cliente.

### Pagos y excepciones

- **¿Quién cobra el producto y quién el envío?** El comercio cobra su producto directamente; el pago del servicio de envío se registra en el Excel para liquidar después.
- **¿Cómo resuelven los imprevistos en la calle?** Si un auto se rompe o el cliente no está, se cancela o reorganiza el viaje manualmente mediante chats de WhatsApp.

### Expectativas del software

- **¿Qué necesita el operario del sistema?** Un panel centralizado para recibir pedidos de forma automática y delegar viajes sin saturarse de mensajes.
- **¿Qué necesita el repartidor?** Una aplicación o interfaz web para celular que sea muy simple y rápida de usar mientras manejan.

## Conclusión

### Informe final

Se habló sobre cómo funcionaba el comercio y cuáles eran los problemas por los que el cliente quería contratarnos. Después se hicieron preguntas generales para conocer el negocio y hacia dónde apuntar la solución, y luego preguntas puntuales sobre cómo funcionaban los envíos, si tenían geolocalización, etc. También se improvisaron preguntas en base a las respuestas. Esto sirvió para entender hacia dónde iba a ir el trabajo y cómo desarrollarlo.

### Información obtenida en detalle

**¿Qué necesita cada actor del sistema?**
- **Operario:** una herramienta central que automatice la recepción de envíos y permita delegarlos al sistema sin cargar el Excel.
- **Repartidor:** una aplicación rápida y fácil para usar desde el celular en la calle, ya que necesitan automatizar los avisos de estado y las rutas.
- **Cliente final:** la regla es "mientras menos se hable con el cliente, mejor". Necesitan ver el estado de su paquete de forma autónoma sin usar WhatsApp.

**¿El cliente final debería tener seguimiento GPS en tiempo real?** No. Se quiere evitar enlaces de rastreo complejos. El cliente solo debe ver un estado estimativo y discreto, como el horario en el que el paquete zarpó del depósito.

**Próxima entrevista:** 11/09/2026.
