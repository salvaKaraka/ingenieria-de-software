// Datos para la demo (Q-1, guion en docs/guion-demo-1.md): borra todo y deja la base lista para
// recorrer las historias de usuario de punta a punta.
//   npm run db:seed:demo
// A diferencia de db:seed, no deja envíos en curso ni pendientes: los envíos de hoy se cargan
// en vivo durante la demo. Lo que hay es lo que no se puede mostrar en el momento (entregas
// de ayer con su historial completo, repartidores con viajes seguidos, una emergencia).
// Solo corre contra una base local. Para Supabase: SEED_EN_STAGING=si (ver el guion).
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import { verificarBaseLocal } from '../dev/dev.constants';
import type {
  EstadoEnvio,
  EstadoRepartidor,
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

// "Heladería Polo Norte" no tiene envíos: es la que se da de baja en la demo.
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
    nombre: 'Heladería Polo Norte',
    direccion: 'Calle 47 610',
    foto: false,
    dni: false,
  },
];

// El PIN es el número de la fila repetido: 1111, 2222… Todos arrancan fuera de jornada, salvo
// Martina, que está en emergencia para que la flota la muestre destacada (el botón de
// emergencia es de la Demo 2). Tomás está dado de baja para mostrar la reactivación.
const REPARTIDORES: {
  nombre: string;
  apellido: string;
  vehiculo: TipoVehiculo;
  estado?: EstadoRepartidor;
  activo?: boolean;
}[] = [
  { nombre: 'Lucas', apellido: 'Gómez', vehiculo: 'MOTO' },
  { nombre: 'Sofía', apellido: 'Díaz', vehiculo: 'MOTO' },
  { nombre: 'Mateo', apellido: 'Ruiz', vehiculo: 'MOTO' },
  { nombre: 'Valentina', apellido: 'López', vehiculo: 'AUTO' },
  { nombre: 'Tomás', apellido: 'Pérez', vehiculo: 'AUTO', activo: false },
  { nombre: 'Juan', apellido: 'Romero', vehiculo: 'CAMION' },
  {
    nombre: 'Martina',
    apellido: 'Álvarez',
    vehiculo: 'CAMION',
    estado: 'EMERGENCIA',
  },
];

// Envíos de ayer, todos terminados. `repartidor` es el índice en REPARTIDORES. Las dos
// últimas entregas de Lucas y de Mateo son seguidas: por eso arrancan con 2 viajes seguidos
// (regla de los 2 viajes consecutivos).
type EnvioDemo = {
  comercio: number;
  tamanio: TamanioPaquete;
  destino: string;
  destinatario: [string, string];
  dni: string;
  final: 'ENTREGADO' | 'CANCELADO';
  repartidor: number;
  // Solo para CANCELADO: en qué estado estaba cuando el operario lo canceló.
  canceladoDesde?: EstadoEnvio;
  // Ofertas que no prosperaron antes de la que aceptó `repartidor`.
  ofertasPrevias?: { repartidor: number; resultado: 'RECHAZADA' | 'VENCIDA' }[];
  evidencia?: string;
  observaciones?: string;
  // Para encontrarlo en la salida del script y en el guion.
  nota?: string;
};

const ENVIOS: EnvioDemo[] = [
  {
    comercio: 2,
    tamanio: 'CHICO',
    destino: 'Calle 50 567, 3° B',
    destinatario: ['Carlos', 'Medina'],
    dni: '25111222',
    final: 'ENTREGADO',
    repartidor: 0,
    ofertasPrevias: [
      { repartidor: 2, resultado: 'VENCIDA' },
      { repartidor: 1, resultado: 'RECHAZADA' },
    ],
    evidencia: 'Evidencia: DNI verificado',
    observaciones: 'Timbre 3B',
    nota: 'historial completo: oferta vencida, rechazada y entrega con DNI',
  },
  {
    comercio: 1,
    tamanio: 'MEDIANO',
    destino: 'Calle 60 300',
    destinatario: ['Laura', 'Méndez'],
    dni: '26222333',
    final: 'ENTREGADO',
    repartidor: 3,
    evidencia: 'Evidencia: foto enviada por WhatsApp',
  },
  {
    comercio: 3,
    tamanio: 'GRANDE',
    destino: 'Calle 115 890',
    destinatario: ['Pablo', 'Herrera'],
    dni: '27333444',
    final: 'ENTREGADO',
    repartidor: 5,
    evidencia: 'Evidencia: DNI verificado, foto enviada por WhatsApp',
    observaciones: 'Entregar en el portón',
  },
  {
    comercio: 0,
    tamanio: 'CHICO',
    destino: 'Calle 10 960',
    destinatario: ['Marcos', 'Suárez'],
    dni: '28444555',
    final: 'CANCELADO',
    canceladoDesde: 'ASIGNADO',
    repartidor: 1,
    nota: 'cancelado por el operario',
  },
  {
    comercio: 0,
    tamanio: 'CHICO',
    destino: 'Calle 19 540',
    destinatario: ['Nicolás', 'Acosta'],
    dni: '29555666',
    final: 'ENTREGADO',
    repartidor: 1,
  },
  {
    comercio: 0,
    tamanio: 'CHICO',
    destino: 'Calle 6 1300',
    destinatario: ['Lucía', 'Benítez'],
    dni: '30666777',
    final: 'ENTREGADO',
    repartidor: 0,
  },
  {
    comercio: 1,
    tamanio: 'CHICO',
    destino: 'Calle 44 980',
    destinatario: ['Julia', 'Castro'],
    dni: '31777888',
    final: 'ENTREGADO',
    repartidor: 2,
    evidencia: 'Evidencia: foto enviada por WhatsApp',
  },
  {
    comercio: 0,
    tamanio: 'CHICO',
    destino: 'Calle 1 220',
    destinatario: ['Ramiro', 'Vega'],
    dni: '32888999',
    final: 'ENTREGADO',
    repartidor: 2,
  },
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

// Viajes seguidos con los que queda cada repartidor: cuenta sus entregas desde la última
// vez que otra cosa (un rechazo, un vencimiento o un cancelado) cortó la racha.
function viajesSeguidos(repartidor: number): number {
  let seguidos = 0;
  for (const envio of ENVIOS) {
    const corto =
      envio.ofertasPrevias?.some((o) => o.repartidor === repartidor) ||
      (envio.final === 'CANCELADO' && envio.repartidor === repartidor);
    if (corto) seguidos = 0;
    else if (envio.final === 'ENTREGADO' && envio.repartidor === repartidor)
      seguidos++;
  }
  return seguidos;
}

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? '').hostname;
  if (process.env.SEED_EN_STAGING !== 'si') verificarBaseLocal();
  console.log(
    `Cargando los datos de la demo en "${host}" (se borra todo lo que había)…`,
  );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  try {
    const prisma = app.get(PrismaService);
    const hashing = app.get(HashingService);
    const password = process.env.OPERARIO_PASSWORD || 'admin1234';
    // Fuera de la transacción: argon2 es lento a propósito.
    const passwordHash = await hashing.hashearPassword(password);

    // Ayer desde las 9:00: cada envío arranca 40 min después del anterior.
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 1);
    inicio.setHours(9, 0, 0, 0);
    const minutos = (m: number) => new Date(inicio.getTime() + m * 60_000);

    const codigos: string[] = [];
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
          data: { usuario: 'admin', nombre: 'Ana Pérez', passwordHash },
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

        const repartidores = [];
        for (const [i, r] of REPARTIDORES.entries()) {
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
                pinHmac: hashing.hmacPin(String(i + 1).repeat(4)),
                estado: r.estado ?? 'FUERA_DE_JORNADA',
                activo: r.activo ?? true,
                viajesConsecutivos: viajesSeguidos(i),
              },
            }),
          );
        }

        for (const [i, e] of ENVIOS.entries()) {
          const comercio = comercios[e.comercio];
          const repartidor = repartidores[e.repartidor];
          const camino =
            e.final === 'CANCELADO'
              ? [
                  ...caminoHasta(e.canceladoDesde ?? 'PENDIENTE'),
                  'CANCELADO' as const,
                ]
              : caminoHasta(e.final);
          const creadoEn = minutos(i * 40);
          // Las ofertas que no prosperaron ocupan los primeros minutos; después cada paso tarda 6 min.
          const previas = e.ofertasPrevias ?? [];
          const arranque = 1 + previas.length * 6;
          const enPaso = (paso: number) =>
            minutos(i * 40 + arranque + (paso - 1) * 6);

          const envio = await tx.envio.create({
            data: {
              codigoSeguimiento: generarCodigoSeguimiento(),
              comercioId: comercio.id,
              origenDireccion: comercio.direccion,
              destinoDireccion: e.destino,
              destinatarioNombre: e.destinatario[0],
              destinatarioApellido: e.destinatario[1],
              destinatarioTelefono: `221 600-0${String(i).padStart(3, '0')}`,
              destinatarioDni: e.dni,
              tamanio: e.tamanio,
              vehiculoRequerido: VEHICULO_MINIMO[e.tamanio],
              observaciones: e.observaciones,
              requiereFoto: comercio.requiereFoto,
              requiereDni: comercio.requiereDni,
              estado: e.final,
              repartidorId: camino.includes('ASIGNADO') ? repartidor.id : null,
              creadoEn,
            },
          });
          codigos.push(envio.codigoSeguimiento);

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

          for (const [n, previa] of previas.entries()) {
            const creadaEn = minutos(i * 40 + 1 + n * 6);
            await tx.oferta.create({
              data: {
                envioId: envio.id,
                repartidorId: repartidores[previa.repartidor].id,
                estado: previa.resultado,
                creadaEn,
                expiraEn: new Date(creadaEn.getTime() + 5 * 60_000),
                respondidaEn:
                  previa.resultado === 'RECHAZADA'
                    ? new Date(creadaEn.getTime() + 60_000)
                    : null,
              },
            });
          }

          for (let paso = 1; paso < camino.length; paso++) {
            const estadoNuevo = camino[paso];
            const porOperario = estadoNuevo === 'CANCELADO';
            if (estadoNuevo === 'ASIGNADO') {
              // Se asignó porque el repartidor aceptó la oferta del motor.
              await tx.oferta.create({
                data: {
                  envioId: envio.id,
                  repartidorId: repartidor.id,
                  estado: 'ACEPTADA',
                  creadaEn: new Date(enPaso(paso).getTime() - 60_000),
                  expiraEn: new Date(enPaso(paso).getTime() + 4 * 60_000),
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
                detalle: estadoNuevo === 'ENTREGADO' ? e.evidencia : undefined,
                actorTipo: porOperario ? 'OPERARIO' : 'REPARTIDOR',
                actorId: porOperario ? operario.id : repartidor.id,
                creadoEn: enPaso(paso),
              },
            });
          }
        }
      },
      { timeout: 60_000 },
    );

    console.log('\nDatos de la demo cargados.\n');
    console.log(
      `Operario   → usuario "admin", contraseña "${password}" (Ana Pérez)`,
    );
    for (const [i, r] of REPARTIDORES.entries()) {
      const extra = [
        r.activo === false && 'dado de baja',
        r.estado === 'EMERGENCIA' && 'en emergencia',
        viajesSeguidos(i) >= 2 && `${viajesSeguidos(i)} viajes seguidos`,
      ].filter(Boolean);
      console.log(
        `Repartidor → PIN ${String(i + 1).repeat(4)}  ${r.nombre} ${r.apellido} (${r.vehiculo})${extra.length ? ` — ${extra.join(', ')}` : ''}`,
      );
    }
    console.log('\nEnvíos de ayer (código de seguimiento):');
    for (const [i, e] of ENVIOS.entries()) {
      console.log(
        `  ${codigos[i]}  ${e.destinatario.join(' ')} — ${COMERCIOS[e.comercio].nombre}, ${e.final.toLowerCase()}${e.nota ? ` (${e.nota})` : ''}`,
      );
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  // Sin conexión a la base, Node tira un AggregateError con el mensaje vacío.
  console.error(
    error instanceof Error && error.message ? error.message : error,
  );
  process.exit(1);
});
