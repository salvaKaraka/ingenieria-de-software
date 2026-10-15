import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { HealthController } from './health.controller';

// Ejemplo de test unitario con un mock: reemplazamos PrismaService por un objeto falso,
// así el test no necesita una base de datos real.
describe('HealthController', () => {
  let controller: HealthController;
  const prismaMock = { $queryRaw: jest.fn() };

  beforeEach(async () => {
    prismaMock.$queryRaw.mockReset();
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prismaMock }],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('responde ok cuando la base responde', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      db: 'ok',
    });
  });

  it('responde 503 cuando la base no responde', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error('connection refused'));
    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
