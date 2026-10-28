import { armarHistorial, type EventoHistorial } from './historial';

const hora = (hhmm: string) => new Date(`2026-10-27T${hhmm}:00Z`);

const nombres = {
  operarios: new Map([[3, 'Ana']]),
  repartidores: new Map([[8, 'Juan Pérez']]),
};

function evento(cambios: Partial<EventoHistorial>): EventoHistorial {
  return {
    id: 1,
    tipo: 'CAMBIO_ESTADO',
    estadoNuevo: null,
    detalle: null,
    actorTipo: 'SISTEMA',
    actorId: null,
    creadoEn: hora('10:00'),
    ...cambios,
  };
}

const juan = { nombre: 'Juan', apellido: 'Pérez' };

describe('Historial del envío (A-6)', () => {
  it('ordena eventos y ofertas por hora, desde el registro hasta la entrega', () => {
    const historial = armarHistorial(
      [
        evento({
          id: 1,
          tipo: 'CREADO',
          estadoNuevo: 'PENDIENTE',
          actorTipo: 'OPERARIO',
          actorId: 3,
          creadoEn: hora('10:00'),
        }),
        evento({
          id: 2,
          estadoNuevo: 'ASIGNADO',
          actorTipo: 'REPARTIDOR',
          actorId: 8,
          creadoEn: hora('10:02'),
        }),
        evento({
          id: 3,
          estadoNuevo: 'ENTREGADO',
          actorTipo: 'REPARTIDOR',
          actorId: 8,
          creadoEn: hora('10:40'),
        }),
      ],
      [
        {
          id: 1,
          estado: 'ACEPTADA',
          creadaEn: hora('10:01'),
          expiraEn: hora('10:06'),
          respondidaEn: hora('10:02'),
          repartidor: juan,
        },
      ],
      nombres,
    );

    expect(historial.map((e) => [e.tipo, e.estadoNuevo])).toEqual([
      ['CREADO', 'PENDIENTE'],
      ['OFERTA_ENVIADA', null],
      ['CAMBIO_ESTADO', 'ASIGNADO'],
      ['CAMBIO_ESTADO', 'ENTREGADO'],
    ]);
    expect(historial[0].actorNombre).toBe('Ana');
    expect(historial[2].actorNombre).toBe('Juan Pérez');
  });

  it('registra una oferta vencida por inactividad con el repartidor y la hora en que venció', () => {
    const historial = armarHistorial(
      [],
      [
        {
          id: 4,
          estado: 'VENCIDA',
          creadaEn: hora('10:01'),
          expiraEn: hora('10:06'),
          respondidaEn: null,
          repartidor: juan,
        },
      ],
      nombres,
    );

    expect(historial[1]).toMatchObject({
      tipo: 'OFERTA_VENCIDA',
      fecha: hora('10:06'),
      actorTipo: 'SISTEMA',
      repartidorNombre: 'Juan Pérez',
    });
  });

  it('registra un rechazo como acción del repartidor', () => {
    const historial = armarHistorial(
      [],
      [
        {
          id: 4,
          estado: 'RECHAZADA',
          creadaEn: hora('10:01'),
          expiraEn: hora('10:06'),
          respondidaEn: hora('10:03'),
          repartidor: juan,
        },
      ],
      nombres,
    );

    expect(historial[1]).toMatchObject({
      tipo: 'OFERTA_RECHAZADA',
      fecha: hora('10:03'),
      actorTipo: 'REPARTIDOR',
      actorNombre: 'Juan Pérez',
    });
  });

  it('una oferta cerrada porque se canceló el envío no figura como vencida', () => {
    const historial = armarHistorial(
      [
        evento({
          estadoNuevo: 'CANCELADO',
          actorTipo: 'OPERARIO',
          actorId: 3,
          creadoEn: hora('10:02'),
        }),
      ],
      [
        {
          id: 4,
          estado: 'VENCIDA',
          creadaEn: hora('10:01'),
          expiraEn: hora('10:06'),
          respondidaEn: null,
          repartidor: juan,
        },
      ],
      nombres,
    );

    expect(historial.map((e) => e.tipo)).toEqual([
      'OFERTA_ENVIADA',
      'CAMBIO_ESTADO',
    ]);
    expect(historial[1].actorNombre).toBe('Ana');
  });

  it('una oferta cerrada porque el cambio de tamaño pidió otro vehículo no figura como vencida', () => {
    const historial = armarHistorial(
      [
        evento({
          tipo: 'REASIGNACION',
          estadoNuevo: 'PENDIENTE',
          actorTipo: 'OPERARIO',
          actorId: 3,
          creadoEn: hora('10:02'),
        }),
      ],
      [
        {
          id: 4,
          estado: 'VENCIDA',
          creadaEn: hora('10:01'),
          expiraEn: hora('10:06'),
          respondidaEn: null,
          repartidor: juan,
        },
        // La oferta al nuevo vehículo sí venció por inactividad.
        {
          id: 5,
          estado: 'VENCIDA',
          creadaEn: hora('10:03'),
          expiraEn: hora('10:08'),
          respondidaEn: null,
          repartidor: juan,
        },
      ],
      nombres,
    );

    expect(historial.map((e) => e.tipo)).toEqual([
      'OFERTA_ENVIADA',
      'REASIGNACION',
      'OFERTA_ENVIADA',
      'OFERTA_VENCIDA',
    ]);
  });

  it('si no encuentra al actor, deja el nombre vacío', () => {
    const [entrada] = armarHistorial(
      [evento({ actorTipo: 'OPERARIO', actorId: 99 })],
      [],
      nombres,
    );
    expect(entrada.actorNombre).toBeNull();
  });
});
