import { Test, TestingModule } from '@nestjs/testing';
import { EstadoOferta } from '../../generated/prisma/client';
import { AsignacionService } from './asignacion.service';
import { OfertasRepository } from './ofertas.repository';
import { OfertasService } from './ofertas.service';

describe('OfertasService - consultarHistorial (HU #28)', () => {
  let service: OfertasService;
  let repo: jest.Mocked<OfertasRepository>;
  let asignacion: jest.Mocked<AsignacionService>;

  beforeEach(async () => {
    repo = {
      buscarHistorialPorRepartidor: jest.fn(),
      buscarVigenteDe: jest.fn(),
      bloquear: jest.fn(),
      aceptar: jest.fn(),
      rechazar: jest.fn(),
      vencerExpiradas: jest.fn(),
      transaccion: jest.fn(),
    } as unknown as jest.Mocked<OfertasRepository>;

    asignacion = {
      reintentarPendientes: jest.fn(),
    } as unknown as jest.Mocked<AsignacionService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OfertasService,
        { provide: OfertasRepository, useValue: repo },
        { provide: AsignacionService, useValue: asignacion },
      ],
    }).compile();

    service = module.get<OfertasService>(OfertasService);
  });

  it('Escenario 1: devuelve los totales correctos (8 aceptadas, 2 rechazadas, 1 vencida) y el detalle cronológico', async () => {
    const ofertasMock = [
      ...Array.from({ length: 8 }, (_, i) => ({
        id: i + 1,
        envioId: 100 + i,
        repartidorId: 1,
        estado: EstadoOferta.ACEPTADA,
        creadaEn: new Date(`2026-11-01T10:0${i}:00Z`),
        expiraEn: new Date(`2026-11-01T10:0${i + 5}:00Z`),
        respondidaEn: new Date(`2026-11-01T10:0${i + 1}:00Z`),
        envio: { id: 100 + i, codigoSeguimiento: `ENV${i}` },
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        id: 9 + i,
        envioId: 200 + i,
        repartidorId: 1,
        estado: EstadoOferta.RECHAZADA,
        creadaEn: new Date(`2026-11-02T10:0${i}:00Z`),
        expiraEn: new Date(`2026-11-02T10:0${i + 5}:00Z`),
        respondidaEn: new Date(`2026-11-02T10:0${i + 1}:00Z`),
        envio: { id: 200 + i, codigoSeguimiento: `ENV-RECH${i}` },
      })),
      {
        id: 11,
        envioId: 300,
        repartidorId: 1,
        estado: EstadoOferta.VENCIDA,
        creadaEn: new Date('2026-11-03T10:00:00Z'),
        expiraEn: new Date('2026-11-03T10:05:00Z'),
        respondidaEn: null,
        envio: { id: 300, codigoSeguimiento: 'ENV-VENC' },
      },
    ];

    repo.buscarHistorialPorRepartidor.mockResolvedValue(ofertasMock);

    const resultado = await service.consultarHistorial(1);

    expect(resultado.repartidorId).toBe(1);
    expect(resultado.totales).toEqual({
      aceptadas: 8,
      rechazadas: 2,
      vencidas: 1,
    });
    expect(resultado.detalle).toHaveLength(11);
    // Orden cronológico descendente: la última (vencida en nov 3) debe quedar primera
    expect(resultado.detalle[0].id).toBe(11);
    expect(resultado.detalle[0].estado).toBe('VENCIDA');
  });

  it('Escenario 2: si se define un rango temporal, filtra respuestas y totales dentro del período', async () => {
    const ofertasMock = [
      {
        id: 1,
        envioId: 101,
        repartidorId: 1,
        estado: EstadoOferta.ACEPTADA,
        creadaEn: new Date('2026-10-25T10:00:00Z'),
        expiraEn: new Date('2026-10-25T10:05:00Z'),
        respondidaEn: new Date('2026-10-25T10:02:00Z'),
        envio: { id: 101, codigoSeguimiento: 'ENV-VIEJO' },
      },
      {
        id: 2,
        envioId: 102,
        repartidorId: 1,
        estado: EstadoOferta.RECHAZADA,
        creadaEn: new Date('2026-11-02T12:00:00Z'),
        expiraEn: new Date('2026-11-02T12:05:00Z'),
        respondidaEn: new Date('2026-11-02T12:01:00Z'),
        envio: { id: 102, codigoSeguimiento: 'ENV-SEMANA' },
      },
      {
        id: 3,
        envioId: 103,
        repartidorId: 1,
        estado: EstadoOferta.VENCIDA,
        creadaEn: new Date('2026-11-03T15:00:00Z'),
        expiraEn: new Date('2026-11-03T15:05:00Z'),
        respondidaEn: null,
        envio: { id: 103, codigoSeguimiento: 'ENV-SEMANA2' },
      },
    ];

    repo.buscarHistorialPorRepartidor.mockResolvedValue(ofertasMock);

    const resultado = await service.consultarHistorial(1, {
      desde: '2026-11-01',
      hasta: '2026-11-05',
    });

    expect(resultado.rango).toEqual({
      desde: '2026-11-01',
      hasta: '2026-11-05',
    });
    expect(resultado.totales).toEqual({
      aceptadas: 0,
      rechazadas: 1,
      vencidas: 1,
    });
    expect(resultado.detalle).toHaveLength(2);
    expect(resultado.detalle.map((d) => d.id)).toEqual([3, 2]);
  });

  it('Escenario 3: repartidor sin ofertas devuelve lista vacía y totales en 0 sin errores', async () => {
    repo.buscarHistorialPorRepartidor.mockResolvedValue([]);

    const resultado = await service.consultarHistorial(5);

    expect(resultado).toEqual({
      repartidorId: 5,
      rango: { desde: null, hasta: null },
      totales: {
        aceptadas: 0,
        rechazadas: 0,
        vencidas: 0,
      },
      detalle: [],
    });
  });
});
