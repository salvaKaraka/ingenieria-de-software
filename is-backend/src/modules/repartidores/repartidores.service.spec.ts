import { Test, TestingModule } from '@nestjs/testing';
import { RepartidoresService } from './repartidores.service';
import { PrismaService } from '../../database/prisma.service';
import { ConflictException } from '@nestjs/common';

describe('RepartidoresService', () => {
  let service: RepartidoresService;
  let prisma: PrismaService;

  const mockPrismaService = {
    repartidor: {
      findMany: jest.fn().mockResolvedValue([{ id: 1, nombre: 'Juan', activo: true }]),
      create: jest.fn().mockResolvedValue({ id: 1, nombre: 'Juan' }),
      update: jest.fn().mockResolvedValue({ id: 1, activo: false }),
    },
    envio: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepartidoresService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<RepartidoresService>(RepartidoresService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  it('debe lanzar ConflictException (409) al intentar dar de baja a un repartidor con viaje activo', async () => {
    // Simulamos que encuentra un envío activo
    jest.spyOn(prisma.envio, 'findFirst').mockResolvedValueOnce({ id: 10 } as any);

    await expect(service.bajaLogica(1)).rejects.toThrow(ConflictException);
  });
});