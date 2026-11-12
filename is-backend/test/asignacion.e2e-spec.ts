import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import type {
  EstadoRepartidor,
  TipoVehiculo,
} from '../src/generated/prisma/client';
import { OFERTA_SEGUNDOS } from '../src/modules/asignacion/asignacion.constants';
import { AsignacionService } from '../src/modules/asignacion/asignacion.service';
import { emailUnico, vaciarBase } from './utils';

// Motor de asignación contra una base real: las reglas viven en SQL y en los bloqueos de Postgres,
// así que no se pueden probar con mocks.
describe('Motor de asignación (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let motor: AsignacionService;
  let comercioId: number;

  // Repartidores con un orden de llegada a la cola controlado: minuto 0, 1, 2... contados desde hace
  // una hora, así "ahora" (lo que usa el motor para mandar al final de la cola) siempre es posterior.
  const haceUnaHora = Date.now() - 3_600_000;
  const enMinuto = (minuto: number) => new Date(haceUnaHora + minuto * 60_000);

  async function crearRepartidor(
    opciones: {
      vehiculo?: TipoVehiculo;
      estado?: EstadoRepartidor;
      llegoEnMinuto?: number;
      viajesConsecutivos?: number;
    } = {},
  ) {
    const {
      vehiculo = 'MOTO',
      estado = 'DISPONIBLE',
      llegoEnMinuto = 0,
      viajesConsecutivos = 0,
    } = opciones;
    const repartidor = await prisma.repartidor.create({
      data: {
        nombre: 'R',
        apellido: `${vehiculo}-${llegoEnMinuto}`,
        telefono: '1',
        email: emailUnico(),
        direccion: 'x',
        vehiculo,
        estado,
        enColaDesde: estado === 'DISPONIBLE' ? enMinuto(llegoEnMinuto) : null,
        viajesConsecutivos,
      },
    });
    return repartidor.id;
  }

  let codigo = 0;
  async function crearEnvio(vehiculo: TipoVehiculo = 'MOTO') {
    const tamanio = {
      MOTO: 'CHICO',
      AUTO: 'MEDIANO',
      CAMION: 'GRANDE',
    } as const;
    const envio = await prisma.envio.create({
      data: {
        codigoSeguimiento: `TEST${++codigo}`,
        comercioId,
        origenDireccion: 'Comercio',
        destinoDireccion: 'Destino',
        tamanio: tamanio[vehiculo],
        vehiculoRequerido: vehiculo,
        requiereFoto: false,
        requiereDni: false,
      },
    });
    return envio.id;
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
    motor = app.get(AsignacionService);
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

  it('ofrece al primero de la cola que tiene el vehículo requerido', async () => {
    await crearRepartidor({ vehiculo: 'AUTO', llegoEnMinuto: 0 }); // llegó antes, pero es auto
    const segundaMoto = await crearRepartidor({
      vehiculo: 'MOTO',
      llegoEnMinuto: 2,
    });
    const primeraMoto = await crearRepartidor({
      vehiculo: 'MOTO',
      llegoEnMinuto: 1,
    });
    await crearRepartidor({ vehiculo: 'MOTO', estado: 'EN_PAUSA' }); // no está en la cola

    const oferta = await motor.asignar(await crearEnvio('MOTO'));

    expect(oferta?.repartidorId).toBe(primeraMoto);
    expect(oferta?.repartidorId).not.toBe(segundaMoto);
  });

  describe('vehículo mínimo: uno más grande también puede llevar el paquete', () => {
    it('un envío chico sin motos disponibles se le ofrece a un camión', async () => {
      const camion = await crearRepartidor({ vehiculo: 'CAMION' });

      const oferta = await motor.asignar(await crearEnvio('MOTO'));

      expect(oferta?.repartidorId).toBe(camion);
    });

    it('prefiere el vehículo más chico que sirva, aunque otro haya llegado antes a la cola', async () => {
      await crearRepartidor({ vehiculo: 'CAMION', llegoEnMinuto: 0 });
      const auto = await crearRepartidor({
        vehiculo: 'AUTO',
        llegoEnMinuto: 5,
      });

      const oferta = await motor.asignar(await crearEnvio('MOTO'));

      expect(oferta?.repartidorId).toBe(auto);
    });

    it('un envío mediano nunca se le ofrece a una moto', async () => {
      await crearRepartidor({ vehiculo: 'MOTO' });

      await expect(motor.asignar(await crearEnvio('AUTO'))).resolves.toBeNull();
    });
  });

  it('la oferta vence a los 5 minutos', async () => {
    await crearRepartidor();
    const antes = Date.now();

    const oferta = await motor.asignar(await crearEnvio());

    const segundos = (oferta!.expiraEn.getTime() - antes) / 1000;
    expect(segundos).toBeGreaterThanOrEqual(OFERTA_SEGUNDOS - 1);
    expect(segundos).toBeLessThanOrEqual(OFERTA_SEGUNDOS + 1);
  });

  it('al recibir una oferta, el repartidor sale de la cola', async () => {
    const repartidorId = await crearRepartidor();

    await motor.asignar(await crearEnvio());

    const repartidor = await prisma.repartidor.findUniqueOrThrow({
      where: { id: repartidorId },
    });
    expect(repartidor.enColaDesde).toBeNull();
  });

  it('no ofrece a quien ya tiene una oferta pendiente (un viaje a la vez)', async () => {
    const ocupado = await crearRepartidor({ llegoEnMinuto: 0 });
    const libre = await crearRepartidor({ llegoEnMinuto: 1 });
    await motor.asignar(await crearEnvio()); // se lo ofrece a `ocupado`

    const segunda = await motor.asignar(await crearEnvio());

    expect(segunda?.repartidorId).toBe(libre);
    expect(segunda?.repartidorId).not.toBe(ocupado);
  });

  it('no vuelve a ofrecerle un envío a quien lo rechazó', async () => {
    const rechazo = await crearRepartidor({ llegoEnMinuto: 0 });
    const otro = await crearRepartidor({ llegoEnMinuto: 1 });
    const envioId = await crearEnvio();
    await prisma.oferta.create({
      data: {
        envioId,
        repartidorId: rechazo,
        estado: 'RECHAZADA',
        expiraEn: new Date(),
      },
    });

    const oferta = await motor.asignar(envioId);

    expect(oferta?.repartidorId).toBe(otro);
  });

  it('Escenario 1 y 3: con 2 viajes consecutivos y otro disponible, el repartidor descansa, es salteado y su contador vuelve a 0', async () => {
    const cansado = await crearRepartidor({
      llegoEnMinuto: 0,
      viajesConsecutivos: 2,
    });
    const siguiente = await crearRepartidor({ llegoEnMinuto: 1 });

    const envioId = await crearEnvio();
    const oferta = await motor.asignar(envioId);

    // Escenario 1: salteado y ofrecido al segundo repartidor
    expect(oferta?.repartidorId).toBe(siguiente);

    // Escenario 3: contador vuelve a 0 y pasa al final de la cola
    const despues = await prisma.repartidor.findUniqueOrThrow({
      where: { id: cansado },
    });
    expect(despues.viajesConsecutivos).toBe(0);
    expect(despues.enColaDesde!.getTime()).toBeGreaterThan(
      enMinuto(1).getTime(),
    );

    // No debe haber aviso de excepción
    const eventoExcepcion = await prisma.eventoEnvio.findFirst({
      where: {
        envioId,
        detalle: 'Asignación por excepción: único repartidor disponible',
      },
    });
    expect(eventoExcepcion).toBeNull();
  });

  it('Escenario 2: si el único disponible tiene 2 consecutivos, se le asigna igual y se avisa al operario', async () => {
    const unico = await crearRepartidor({ viajesConsecutivos: 2 });
    const envioId = await crearEnvio();

    const oferta = await motor.asignar(envioId);

    expect(oferta?.repartidorId).toBe(unico);

    // Aviso al operario en EventoEnvio
    const eventoExcepcion = await prisma.eventoEnvio.findFirst({
      where: {
        envioId,
        detalle: 'Asignación por excepción: único repartidor disponible',
      },
    });
    expect(eventoExcepcion).not.toBeNull();
    expect(eventoExcepcion?.actorTipo).toBe('SISTEMA');
  });

  it('sin candidatos no crea oferta y el envío queda pendiente', async () => {
    await crearRepartidor({ vehiculo: 'AUTO' });
    const envioId = await crearEnvio('CAMION');

    await expect(motor.asignar(envioId)).resolves.toBeNull();
    const envio = await prisma.envio.findUniqueOrThrow({
      where: { id: envioId },
    });
    expect(envio.estado).toBe('PENDIENTE');
  });

  it('no crea una segunda oferta para un envío que ya tiene una vigente', async () => {
    await crearRepartidor({ llegoEnMinuto: 0 });
    await crearRepartidor({ llegoEnMinuto: 1 });
    const envioId = await crearEnvio();
    await motor.asignar(envioId);

    await expect(motor.asignar(envioId)).resolves.toBeNull();
    expect(await prisma.oferta.count({ where: { envioId } })).toBe(1);
  });

  describe('concurrencia (riesgo 7)', () => {
    it('dos envíos simultáneos con un solo repartidor generan una sola oferta', async () => {
      await crearRepartidor();
      const [envio1, envio2] = [await crearEnvio(), await crearEnvio()];

      const resultados = await Promise.all([
        motor.asignar(envio1),
        motor.asignar(envio2),
      ]);

      expect(resultados.filter((oferta) => oferta !== null)).toHaveLength(1);
      expect(await prisma.oferta.count()).toBe(1);
    });

    it('el mismo envío asignado dos veces a la vez genera una sola oferta', async () => {
      await crearRepartidor({ llegoEnMinuto: 0 });
      await crearRepartidor({ llegoEnMinuto: 1 });
      const envioId = await crearEnvio();

      await Promise.all([motor.asignar(envioId), motor.asignar(envioId)]);

      expect(await prisma.oferta.count({ where: { envioId } })).toBe(1);
    });

    it('10 envíos simultáneos con 10 repartidores: cada uno recibe exactamente una oferta', async () => {
      for (let i = 0; i < 10; i++) await crearRepartidor({ llegoEnMinuto: i });
      const envios: number[] = [];
      for (let i = 0; i < 10; i++) envios.push(await crearEnvio());

      await Promise.all(envios.map((id) => motor.asignar(id)));

      const ofertas = await prisma.oferta.findMany();
      expect(ofertas).toHaveLength(10);
      expect(new Set(ofertas.map((oferta) => oferta.repartidorId)).size).toBe(
        10,
      );
    });
  });

  it('reintentarPendientes asigna primero el envío más viejo', async () => {
    const primero = await crearRepartidor({ llegoEnMinuto: 0 });
    const viejo = await crearEnvio();
    const nuevo = await crearEnvio();

    const creadas = await motor.reintentarPendientes();

    expect(creadas).toBe(1);
    const oferta = await prisma.oferta.findFirstOrThrow();
    expect(oferta).toMatchObject({ envioId: viejo, repartidorId: primero });
    expect(oferta.envioId).not.toBe(nuevo);
  });

  it('asigna en menos de 3 segundos con 30 repartidores y 50 envíos pendientes (RNF-12)', async () => {
    for (let i = 0; i < 30; i++) await crearRepartidor({ llegoEnMinuto: i });
    for (let i = 0; i < 50; i++) await crearEnvio();
    const envioId = await crearEnvio();

    const inicio = performance.now();
    await motor.asignar(envioId);
    const milisegundos = performance.now() - inicio;

    expect(milisegundos).toBeLessThan(3000);
  });
});
