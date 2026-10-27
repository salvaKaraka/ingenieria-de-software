import { ConflictException } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import type { EstadoEnvio } from '../src/generated/prisma/client';
import { ComerciosService } from '../src/modules/comercios/comercios.service';
import { vaciarBase } from './utils';

// Baja de comercio: qué envíos cuentan como "en curso" lo decide la consulta a la base.
describe('Baja de comercio (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let comercios: ComerciosService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    await app.init();
    prisma = app.get(PrismaService);
    comercios = app.get(ComerciosService);
  });

  beforeEach(() => vaciarBase(prisma));

  afterAll(() => app.close());

  async function comercioConEnvio(estado: EstadoEnvio) {
    const comercio = await prisma.comercio.create({
      data: { nombre: 'C', telefono: '1', email: 'c@test.com', direccion: 'x' },
    });
    await prisma.envio.create({
      data: {
        codigoSeguimiento: `COD-${estado}`,
        comercioId: comercio.id,
        origenDireccion: 'x',
        destinoDireccion: 'y',
        tamanio: 'CHICO',
        vehiculoRequerido: 'MOTO',
        requiereFoto: false,
        requiereDni: false,
        estado,
      },
    });
    return comercio;
  }

  it.each<EstadoEnvio>(['PENDIENTE', 'EN_CAMINO_A_RETIRAR'])(
    'no da de baja un comercio con un envío %s',
    async (estado) => {
      const comercio = await comercioConEnvio(estado);
      await expect(comercios.eliminarLogico(comercio.id)).rejects.toThrow(
        new ConflictException('El comercio tiene envíos en curso'),
      );
      const guardado = await prisma.comercio.findUniqueOrThrow({
        where: { id: comercio.id },
      });
      expect(guardado.activo).toBe(true);
    },
  );

  it.each<EstadoEnvio>(['ENTREGADO', 'CANCELADO'])(
    'da de baja un comercio cuyo envío está %s',
    async (estado) => {
      const comercio = await comercioConEnvio(estado);
      await comercios.eliminarLogico(comercio.id);
      const guardado = await prisma.comercio.findUniqueOrThrow({
        where: { id: comercio.id },
      });
      expect(guardado.activo).toBe(false);
    },
  );
});
