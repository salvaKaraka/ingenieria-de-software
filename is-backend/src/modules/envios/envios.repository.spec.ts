import type { PrismaService } from '../../database/prisma.service';
import { EnviosRepository } from './envios.repository';

describe('EnviosRepository.reportarIncidente', () => {
  const tx = {
    $queryRaw: jest.fn(),
    envio: { update: jest.fn() },
    repartidor: { update: jest.fn() },
    eventoEnvio: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(
      (trabajo: (txActual: typeof tx) => Promise<unknown>) => trabajo(tx),
    ),
  };
  const repository = new EnviosRepository(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    tx.envio.update.mockResolvedValue(undefined);
    tx.repartidor.update.mockResolvedValue(undefined);
    tx.eventoEnvio.create.mockResolvedValue(undefined);
  });

  it('actualiza el origen y pone al repartidor en emergencia si ya retiró el paquete', async () => {
    tx.$queryRaw
      .mockResolvedValueOnce([{ id: 5, estado: 'RETIRADO' }])
      .mockResolvedValueOnce([{ estado: 'OCUPADO' }]);

    await expect(
      repository.reportarIncidente(9, 'Calle 50 123'),
    ).resolves.toEqual({ envioId: 5, estadoAnterior: 'RETIRADO' });

    expect(tx.envio.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: {
        estado: 'INTERRUMPIDO',
        repartidorId: null,
        origenDireccion: 'Calle 50 123',
      },
    });
    expect(tx.repartidor.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { estado: 'EMERGENCIA', enColaDesde: null },
    });
    expect(tx.eventoEnvio.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: 'INCIDENTE',
        estadoAnterior: 'RETIRADO',
        estadoNuevo: 'INTERRUMPIDO',
        actorTipo: 'REPARTIDOR',
        actorId: 9,
      }),
    });
  });

  it('conserva el comercio como origen si todavía no retiró el paquete', async () => {
    tx.$queryRaw
      .mockResolvedValueOnce([{ id: 5, estado: 'EN_CAMINO_A_RETIRAR' }])
      .mockResolvedValueOnce([{ estado: 'OCUPADO' }]);

    await repository.reportarIncidente(9, 'Calle 50 123');

    expect(tx.envio.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { estado: 'INTERRUMPIDO', repartidorId: null },
    });
  });
});
