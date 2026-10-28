import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { OfertasService } from '../src/modules/asignacion/ofertas.service';
import { EnviosService } from '../src/modules/envios/envios.service';
import { emailUnico, vaciarBase } from './utils';

// Historial del envío (A-6): los nombres de los responsables salen de otras tablas y las
// ofertas las vence el job, así que se prueba contra la base real.
describe('Historial del envío (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let envios: EnviosService;
  let ofertas: OfertasService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    await app.init();
    prisma = app.get(PrismaService);
    envios = app.get(EnviosService);
    ofertas = app.get(OfertasService);
  });

  beforeEach(() => vaciarBase(prisma));

  afterAll(() => app.close());

  it('muestra la oferta vencida con el repartidor y la cancelación con el operario', async () => {
    const comercio = await prisma.comercio.create({
      data: { nombre: 'C', telefono: '1', email: 'c@test.com', direccion: 'x' },
    });
    const operario = await prisma.operario.create({
      data: { nombre: 'Ana Gómez', usuario: 'ana', passwordHash: 'x' },
    });
    await prisma.repartidor.create({
      data: {
        nombre: 'Juan',
        apellido: 'Pérez',
        telefono: '1',
        email: emailUnico(),
        direccion: 'x',
        vehiculo: 'MOTO',
        estado: 'DISPONIBLE',
        enColaDesde: new Date(),
      },
    });
    const envio = await envios.crear(
      {
        comercioId: comercio.id,
        destinoDireccion: 'Destino',
        destinatarioNombre: 'Luis',
        destinatarioApellido: 'Díaz',
        destinatarioTelefono: '2',
        tamanio: 'CHICO',
      },
      operario.id,
    );

    // Pasan los 5 minutos sin respuesta.
    await prisma.oferta.updateMany({
      where: { envioId: envio.id },
      data: { expiraEn: new Date() },
    });
    await ofertas.vencerYReasignar();
    await envios.cancelar(envio.id, operario.id);

    const { historial } = await envios.obtenerDetalle(envio.id);
    expect(
      historial.map((e) => [
        e.tipo,
        e.estadoNuevo,
        e.actorNombre,
        e.repartidorNombre,
      ]),
    ).toEqual([
      ['CREADO', 'PENDIENTE', 'Ana Gómez', null],
      ['OFERTA_ENVIADA', null, null, 'Juan Pérez'],
      ['OFERTA_VENCIDA', null, null, 'Juan Pérez'],
      ['CAMBIO_ESTADO', 'CANCELADO', 'Ana Gómez', null],
    ]);
  });
});
