import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import type { TamanioPaquete, TipoVehiculo } from '../generated/prisma/client';
import { AsignacionService } from '../modules/asignacion/asignacion.service';
import { AuthService } from '../modules/auth/auth.service';

const VEHICULO_MINIMO = {
  CHICO: 'MOTO',
  MEDIANO: 'AUTO',
  GRANDE: 'CAMION',
} as const;
const NOMBRE_VEHICULO = {
  MOTO: 'Moto',
  AUTO: 'Auto',
  CAMION: 'Camión',
} as const;

// Atajos para probar el motor de punta a punta mientras no existen las pantallas reales
// (alta de envíos B-3/B-5, jornada C-3/C-4). Se borra cuando esas tareas estén hechas.
@Injectable()
export class DevService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asignacion: AsignacionService,
    private readonly auth: AuthService,
  ) {}

  async estado() {
    const [repartidores, envios] = await Promise.all([
      this.prisma.repartidor.findMany({
        orderBy: [
          { enColaDesde: { sort: 'asc', nulls: 'last' } },
          { id: 'asc' },
        ],
        select: {
          id: true,
          nombre: true,
          apellido: true,
          vehiculo: true,
          estado: true,
          enColaDesde: true,
          viajesConsecutivos: true,
        },
      }),
      this.prisma.envio.findMany({
        orderBy: { id: 'desc' },
        take: 20,
        select: {
          id: true,
          estado: true,
          tamanio: true,
          destinoDireccion: true,
          repartidorId: true,
          ofertas: {
            orderBy: { id: 'asc' },
            select: {
              id: true,
              repartidorId: true,
              estado: true,
              expiraEn: true,
            },
          },
        },
      }),
    ]);
    return { repartidores, envios };
  }

  async crearEnvio(tamanio: TamanioPaquete) {
    const comercio =
      (await this.prisma.comercio.findFirst({
        where: { nombre: 'Comercio de prueba' },
      })) ??
      (await this.prisma.comercio.create({
        data: {
          nombre: 'Comercio de prueba',
          telefono: '221 000-0000',
          email: 'comercio@example.com',
          direccion: 'Calle 7 1234',
        },
      }));
    const envio = await this.prisma.envio.create({
      data: {
        codigoSeguimiento: randomBytes(5).toString('hex').toUpperCase(),
        comercioId: comercio.id,
        origenDireccion: comercio.direccion,
        destinoDireccion: `Calle ${10 + Math.floor(Math.random() * 60)} ${100 + Math.floor(Math.random() * 1900)}`,
        tamanio,
        vehiculoRequerido: VEHICULO_MINIMO[tamanio],
        requiereFoto: comercio.requiereFoto,
        requiereDni: comercio.requiereDni,
        eventos: {
          create: {
            tipo: 'CREADO',
            estadoNuevo: 'PENDIENTE',
            actorTipo: 'SISTEMA',
          },
        },
      },
    });
    const oferta = await this.asignacion.asignar(envio.id);
    return { envioId: envio.id, ofrecidoA: oferta?.repartidorId ?? null };
  }

  // Crea un repartidor con PIN y lo pone directo en la cola (como si hubiera iniciado la jornada).
  async crearRepartidor(vehiculo: TipoVehiculo) {
    const delMismoVehiculo = await this.prisma.repartidor.count({
      where: { vehiculo },
    });
    const repartidor = await this.prisma.repartidor.create({
      data: {
        nombre: NOMBRE_VEHICULO[vehiculo],
        apellido: String(delMismoVehiculo + 1),
        telefono: '221 000-0000',
        email: 'prueba@example.com',
        direccion: 'La Plata',
        vehiculo,
      },
    });
    const pin = await this.auth.asignarNuevoPin(repartidor.id);
    const { ofertasCreadas } = await this.ponerDisponible(repartidor.id);
    return {
      id: repartidor.id,
      nombre: `${repartidor.nombre} ${repartidor.apellido}`,
      pin,
      ofertasCreadas,
    };
  }

  // Simula "iniciar jornada" (C-3): entra al final de la cola y el motor reintenta los pendientes.
  async ponerDisponible(repartidorId: number) {
    await this.prisma.repartidor.update({
      where: { id: repartidorId },
      data: { estado: 'DISPONIBLE', enColaDesde: new Date() },
    });
    return { ofertasCreadas: await this.asignacion.reintentarPendientes() };
  }

  // Adelanta el vencimiento de las ofertas pendientes: el job las procesa en la próxima vuelta (≤ 10 s).
  async vencerOfertas() {
    const { count } = await this.prisma.oferta.updateMany({
      where: { estado: 'PENDIENTE' },
      data: { expiraEn: new Date(Date.now() - 1000) },
    });
    return { adelantadas: count };
  }
}
