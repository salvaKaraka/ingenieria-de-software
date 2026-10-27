// Datos de prueba (F-2): borra todo y carga comercios, repartidores y envíos coherentes entre sí.
//   npm run db:seed
// Solo corre contra una base local. Para la base de staging de la demo: SEED_EN_STAGING=si.
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import { verificarBaseLocal } from '../dev/dev.constants';
import type {
  EstadoEnvio,
  TamanioPaquete,
  TipoVehiculo,
} from '../generated/prisma/client';
import { HashingService } from '../modules/auth/hashing.service';
import { generarCodigoSeguimiento } from '../modules/envios/codigo-seguimiento.util';
import { siguienteEstado } from '../modules/envios/domain/estado-envio';

const VEHICULO_MINIMO: Record<TamanioPaquete, TipoVehiculo> = {
  CHICO: 'MOTO',
  MEDIANO: 'AUTO',
  GRANDE: 'CAMION',
};

const COMERCIOS = [
  {
    nombre: 'Kiosco Don Pepe',
    direccion: 'Calle 7 1234',
    foto: false,
    dni: false,
  },
  {
    nombre: 'Librería del Bosque',
    direccion: 'Calle 8 845',
    foto: true,
    dni: false,
  },
  {
    nombre: 'Farmacia Plaza Moreno',
    direccion: 'Calle 12 1020',
    foto: false,
    dni: true,
  },
  {
    nombre: 'Ferretería La Tuerca',
    direccion: 'Diagonal 74 1520',
    foto: true,
    dni: true,
  },
  {
    nombre: 'Panadería Sol',
    direccion: 'Calle 47 610',
    foto: false,
    dni: false,
  },
];

// 3 por vehículo. El PIN es el número repetido: 1111, 2222… 9999.
const REPARTIDORES: {
  nombre: string;
  apellido: string;
  vehiculo: TipoVehiculo;
}[] = [
  { nombre: 'Lucas', apellido: 'Gómez', vehiculo: 'MOTO' },
  { nombre: 'Sofía', apellido: 'Díaz', vehiculo: 'MOTO' },
  { nombre: 'Mateo', apellido: 'Ruiz', vehiculo: 'MOTO' },
  { nombre: 'Valentina', apellido: 'López', vehiculo: 'AUTO' },
  { nombre: 'Tomás', apellido: 'Pérez', vehiculo: 'AUTO' },
  { nombre: 'Camila', apellido: 'Sosa', vehiculo: 'AUTO' },
  { nombre: 'Juan', apellido: 'Romero', vehiculo: 'CAMION' },
  { nombre: 'Martina', apellido: 'Álvarez', vehiculo: 'CAMION' },
  { nombre: 'Bruno', apellido: 'Torres', vehiculo: 'CAMION' },
];

// Cada envío: de qué comercio sale, para quién, hasta qué estado llegó y quién lo lleva.
// `repartidor` es el índice en REPARTIDORES. Cada repartidor tiene como máximo UN viaje activo,
// y los que tienen viaje activo quedan OCUPADO; el resto queda FUERA_DE_JORNADA para que en la
// demo inicien la jornada y el motor les ofrezca los PENDIENTE.
type EnvioSeed = {
  comercio: number;
  tamanio: TamanioPaquete;
  destino: string;
  destinatario: [string, string];
  final: EstadoEnvio;
  repartidor?: number;
  // Solo para CANCELADO: en qué estado estaba cuando el operario lo canceló.
  canceladoDesde?: EstadoEnvio;
  observaciones?: string;
};

const ENVIOS: EnvioSeed[] = [
  // Esperando repartidor
  {
    comercio: 0,
    tamanio: 'CHICO',
    destino: 'Calle 50 567',
    destinatario: ['Ana', 'Paz'],
    final: 'PENDIENTE',
    observaciones: 'Timbre 2B',
  },
  {
    comercio: 4,
    tamanio: 'CHICO',
    destino: 'Calle 13 1450',
    destinatario: ['Diego', 'Funes'],
    final: 'PENDIENTE',
  },
  {
    comercio: 1,
    tamanio: 'MEDIANO',
    destino: 'Calle 60 300',
    destinatario: ['Laura', 'Méndez'],
    final: 'PENDIENTE',
  },
  {
    comercio: 3,
    tamanio: 'GRANDE',
    destino: 'Calle 115 890',
    destinatario: ['Pablo', 'Herrera'],
    final: 'PENDIENTE',
    observaciones: 'Entregar en el portón',
  },
  // En curso: un repartidor por viaje
  {
    comercio: 0,
    tamanio: 'CHICO',
    destino: 'Calle 44 980',
    destinatario: ['Julia', 'Castro'],
    final: 'ASIGNADO',
    repartidor: 0,
  },
  {
    comercio: 2,
    tamanio: 'CHICO',
    destino: 'Calle 1 220',
    destinatario: ['Ramiro', 'Vega'],
    final: 'RETIRADO',
    repartidor: 1,
  },
  {
    comercio: 1,
    tamanio: 'MEDIANO',
    destino: 'Diagonal 80 1100',
    destinatario: ['Carla', 'Ibarra'],
    final: 'EN_CAMINO_A_RETIRAR',
    repartidor: 3,
  },
  {
    comercio: 3,
    tamanio: 'GRANDE',
    destino: 'Calle 32 715',
    destinatario: ['Hernán', 'Molina'],
    final: 'EN_DOMICILIO',
    repartidor: 6,
  },
  // Entregados (historial)
  {
    comercio: 4,
    tamanio: 'CHICO',
    destino: 'Calle 6 1300',
    destinatario: ['Lucía', 'Benítez'],
    final: 'ENTREGADO',
    repartidor: 2,
  },
  {
    comercio: 0,
    tamanio: 'CHICO',
    destino: 'Calle 19 540',
    destinatario: ['Nicolás', 'Acosta'],
    final: 'ENTREGADO',
    repartidor: 0,
  },
  {
    comercio: 2,
    tamanio: 'MEDIANO',
    destino: 'Calle 55 870',
    destinatario: ['Florencia', 'Ríos'],
    final: 'ENTREGADO',
    repartidor: 4,
  },
  {
    comercio: 1,
    tamanio: 'MEDIANO',
    destino: 'Calle 66 410',
    destinatario: ['Agustín', 'Navarro'],
    final: 'ENTREGADO',
    repartidor: 5,
  },
  {
    comercio: 3,
    tamanio: 'GRANDE',
    destino: 'Calle 137 2200',
    destinatario: ['Rocío', 'Medina'],
    final: 'ENTREGADO',
    repartidor: 7,
  },
  // Cancelados por el operario
  {
    comercio: 4,
    tamanio: 'CHICO',
    destino: 'Calle 10 960',
    destinatario: ['Marcos', 'Suárez'],
    final: 'CANCELADO',
    canceladoDesde: 'PENDIENTE',
  },
  {
    comercio: 2,
    tamanio: 'MEDIANO',
    destino: 'Calle 38 505',
    destinatario: ['Paula', 'Ortiz'],
    final: 'CANCELADO',
    canceladoDesde: 'ASIGNADO',
    repartidor: 5,
  },
];

const ACTIVOS: EstadoEnvio[] = [
  'ASIGNADO',
  'EN_CAMINO_A_RETIRAR',
  'RETIRADO',
  'EN_DOMICILIO',
];

// Estados por los que pasó el envío, desde PENDIENTE hasta `hasta` inclusive.
function caminoHasta(hasta: EstadoEnvio): EstadoEnvio[] {
  const camino: EstadoEnvio[] = ['PENDIENTE'];
  while (camino[camino.length - 1] !== hasta) {
    const siguiente = siguienteEstado(camino[camino.length - 1]);
    if (!siguiente) throw new Error(`No se llega a ${hasta} avanzando`);
    camino.push(siguiente);
  }
  return camino;
}

async function main() {
  if (process.env.SEED_EN_STAGING !== 'si') verificarBaseLocal();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  try {
    const prisma = app.get(PrismaService);
    const hashing = app.get(HashingService);
    // Fuera de la transacción: argon2 es lento a propósito.
    const passwordHash = await hashing.hashearPassword('admin1234');

    // Cada envío arranca 25 min después del anterior; cada paso tarda 12 min.
    const inicio = Date.now() - ENVIOS.length * 25 * 60_000 - 2 * 3_600_000;
    const minutos = (m: number) => new Date(inicio + m * 60_000);

    // Más tiempo que el límite por defecto (5 s): son unas 150 consultas.
    await prisma.$transaction(
      async (tx) => {
        await tx.oferta.deleteMany();
        await tx.eventoEnvio.deleteMany();
        await tx.envio.deleteMany();
        await tx.refreshToken.deleteMany();
        await tx.repartidor.deleteMany();
        await tx.comercio.deleteMany();
        await tx.operario.deleteMany();

        const operario = await tx.operario.create({
          data: { usuario: 'admin', nombre: 'Operario Demo', passwordHash },
        });

        const comercios = [];
        for (const [i, c] of COMERCIOS.entries()) {
          comercios.push(
            await tx.comercio.create({
              data: {
                nombre: c.nombre,
                direccion: c.direccion,
                telefono: `221 400-00${i + 1}0`,
                email: `comercio${i + 1}@example.com`,
                requiereFoto: c.foto,
                requiereDni: c.dni,
              },
            }),
          );
        }

        const conViajeActivo = new Set(
          ENVIOS.filter((e) => ACTIVOS.includes(e.final)).map(
            (e) => e.repartidor,
          ),
        );
        const repartidores = [];
        for (const [i, r] of REPARTIDORES.entries()) {
          const pin = String(i + 1).repeat(4);
          repartidores.push(
            await tx.repartidor.create({
              data: {
                nombre: r.nombre,
                apellido: r.apellido,
                telefono: `221 500-00${i + 1}0`,
                email: `repartidor${i + 1}@example.com`,
                dni: String(30_000_001 + i),
                direccion: 'La Plata',
                vehiculo: r.vehiculo,
                pinHmac: hashing.hmacPin(pin),
                estado: conViajeActivo.has(i) ? 'OCUPADO' : 'FUERA_DE_JORNADA',
              },
            }),
          );
        }

        for (const [i, e] of ENVIOS.entries()) {
          const comercio = comercios[e.comercio];
          const repartidor =
            e.repartidor === undefined ? null : repartidores[e.repartidor];
          const camino =
            e.final === 'CANCELADO'
              ? [
                  ...caminoHasta(e.canceladoDesde ?? 'PENDIENTE'),
                  'CANCELADO' as const,
                ]
              : caminoHasta(e.final);
          const creadoEn = minutos(i * 25);
          const enPaso = (paso: number) => minutos(i * 25 + paso * 12);

          const envio = await tx.envio.create({
            data: {
              codigoSeguimiento: generarCodigoSeguimiento(),
              comercioId: comercio.id,
              origenDireccion: comercio.direccion,
              destinoDireccion: e.destino,
              destinatarioNombre: e.destinatario[0],
              destinatarioApellido: e.destinatario[1],
              destinatarioTelefono: `221 600-0${String(i).padStart(3, '0')}`,
              tamanio: e.tamanio,
              vehiculoRequerido: VEHICULO_MINIMO[e.tamanio],
              observaciones: e.observaciones,
              requiereFoto: comercio.requiereFoto,
              requiereDni: comercio.requiereDni,
              estado: e.final,
              // Un cancelado que nunca se asignó no tiene repartidor.
              repartidorId: camino.includes('ASIGNADO') ? repartidor?.id : null,
              creadoEn,
            },
          });

          await tx.eventoEnvio.create({
            data: {
              envioId: envio.id,
              tipo: 'CREADO',
              estadoNuevo: 'PENDIENTE',
              actorTipo: 'OPERARIO',
              actorId: operario.id,
              creadoEn,
            },
          });

          for (let paso = 1; paso < camino.length; paso++) {
            const estadoNuevo = camino[paso];
            const porOperario = estadoNuevo === 'CANCELADO';
            if (estadoNuevo === 'ASIGNADO' && repartidor) {
              // Se asignó porque el repartidor aceptó la oferta del motor (D-2).
              await tx.oferta.create({
                data: {
                  envioId: envio.id,
                  repartidorId: repartidor.id,
                  estado: 'ACEPTADA',
                  creadaEn: enPaso(paso - 0.5),
                  expiraEn: enPaso(paso + 4.5),
                  respondidaEn: enPaso(paso),
                },
              });
            }
            await tx.eventoEnvio.create({
              data: {
                envioId: envio.id,
                tipo: 'CAMBIO_ESTADO',
                estadoAnterior: camino[paso - 1],
                estadoNuevo,
                actorTipo: porOperario ? 'OPERARIO' : 'REPARTIDOR',
                actorId: porOperario ? operario.id : repartidor?.id,
                creadoEn: enPaso(paso),
              },
            });
          }
        }
      },
      { timeout: 30_000 },
    );

    console.log('Datos de prueba cargados:');
    console.log('  Operario   → usuario "admin", contraseña "admin1234"');
    for (const [i, r] of REPARTIDORES.entries()) {
      console.log(
        `  Repartidor → PIN ${String(i + 1).repeat(4)}  ${r.nombre} ${r.apellido} (${r.vehiculo})`,
      );
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
