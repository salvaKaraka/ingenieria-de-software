import { ConflictException } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import type {
  EstadoRepartidor,
  TipoVehiculo,
} from '../src/generated/prisma/client';
import { RepartidoresService } from '../src/modules/repartidores/repartidores.service';
import { emailUnico, vaciarBase } from './utils';

// Cambiar el vehículo mueve al repartidor entre colas con un UPDATE condicionado a que esté
// libre: se prueba contra la base real porque depende de esa condición en SQL.
describe('Cambio de vehículo de un repartidor (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let repartidores: RepartidoresService;
  let comercioId: number;

  async function crearRepartidor(
    vehiculo: TipoVehiculo,
    estado: EstadoRepartidor,
    minutosEnCola: number | null,
  ) {
    const repartidor = await prisma.repartidor.create({
      data: {
        nombre: 'R',
        apellido: 'Test',
        telefono: '1',
        email: emailUnico(),
        direccion: 'x',
        vehiculo,
        estado,
        enColaDesde:
          minutosEnCola === null
            ? null
            : new Date(Date.now() - minutosEnCola * 60_000),
      },
    });
    return repartidor.id;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    await app.init();
    prisma = app.get(PrismaService);
    repartidores = app.get(RepartidoresService);
  });

  beforeEach(async () => {
    await vaciarBase(prisma);
    const comercio = await prisma.comercio.create({
      data: {
        nombre: 'Comercio',
        telefono: '1',
        email: 'c@test.com',
        direccion: 'x',
      },
    });
    comercioId = comercio.id;
  });

  afterAll(() => app.close());

  it('un repartidor disponible con moto pasa al final de la cola de autos', async () => {
    const conMoto = await crearRepartidor('MOTO', 'DISPONIBLE', 60);
    const conAuto = await crearRepartidor('AUTO', 'DISPONIBLE', 30);

    await repartidores.actualizar(conMoto, { vehiculo: 'AUTO' });

    const colaDeAutos = await prisma.repartidor.findMany({
      where: { vehiculo: 'AUTO', enColaDesde: { not: null } },
      orderBy: { enColaDesde: 'asc' },
    });
    expect(colaDeAutos.map((r) => r.id)).toEqual([conAuto, conMoto]);
  });

  it('a un repartidor en pausa le cambia el vehículo sin meterlo en la cola', async () => {
    const enPausa = await crearRepartidor('MOTO', 'EN_PAUSA', null);

    await repartidores.actualizar(enPausa, { vehiculo: 'CAMION' });

    const repartidor = await prisma.repartidor.findUniqueOrThrow({
      where: { id: enPausa },
    });
    expect(repartidor.vehiculo).toBe('CAMION');
    expect(repartidor.enColaDesde).toBeNull();
  });

  it('con un paquete retirado mantiene el vehículo y responde "El repartidor tiene un viaje en curso"', async () => {
    const ocupado = await crearRepartidor('MOTO', 'OCUPADO', null);
    await prisma.envio.create({
      data: {
        codigoSeguimiento: 'VEH1',
        comercioId,
        origenDireccion: 'Comercio',
        destinoDireccion: 'Destino',
        tamanio: 'CHICO',
        vehiculoRequerido: 'MOTO',
        requiereFoto: false,
        requiereDni: false,
        estado: 'RETIRADO',
        repartidorId: ocupado,
      },
    });

    await expect(
      repartidores.actualizar(ocupado, { vehiculo: 'AUTO' }),
    ).rejects.toThrow(
      new ConflictException('El repartidor tiene un viaje en curso'),
    );
    const repartidor = await prisma.repartidor.findUniqueOrThrow({
      where: { id: ocupado },
    });
    expect(repartidor.vehiculo).toBe('MOTO');
  });
});
