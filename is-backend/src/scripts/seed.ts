import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import { HashingService } from '../modules/auth/hashing.service';
import { verificarBaseLocal } from '../dev/dev.constants';
import { generarCodigoSeguimiento } from '../modules/envios/codigo-seguimiento.util';
import type {
  EstadoEnvio,
  TamanioPaquete,
  TipoActor,
  TipoEvento,
  TipoVehiculo,
} from '../generated/prisma/client';

async function bootstrap() {
  // Verificación de seguridad
  if (process.env.SEED_EN_STAGING !== 'si') {
    verificarBaseLocal();
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const hashingService = app.get(HashingService);

  console.log('Iniciando carga de datos de prueba (F-2)...');

  try {
    // 1. Borrar todo en orden (dentro de una transacción)
    await prisma.$transaction(async (tx) => {
      await tx.oferta.deleteMany();
      await tx.eventoEnvio.deleteMany();
      await tx.envio.deleteMany();
      await tx.refreshToken.deleteMany();
      await tx.repartidor.deleteMany();
      await tx.comercio.deleteMany();
      await tx.operario.deleteMany();

      // 2. Crear Operario Admin
      const adminPassword = await hashingService.hashearPassword('admin1234');
      await tx.operario.create({
        data: {
          usuario: 'admin',
          nombre: 'Operario Demo',
          passwordHash: adminPassword,
        },
      });

      // 3. Crear 5 Comercios (Distintos requisitos)
      const comercios = await Promise.all([
        tx.comercio.create({
          data: {
            nombre: 'Kiosco 1',
            direccion: 'Calle 7 1234',
            telefono: '2210001',
            email: 'k1@test.com',
            requiereFoto: false,
            requiereDni: false,
            activo: true,
          },
        }),
        tx.comercio.create({
          data: {
            nombre: 'Kiosco 2',
            direccion: 'Calle 8 1234',
            telefono: '2210002',
            email: 'k2@test.com',
            requiereFoto: true,
            requiereDni: false,
            activo: true,
          },
        }),
        tx.comercio.create({
          data: {
            nombre: 'Libreria',
            direccion: 'Calle 9 1234',
            telefono: '2210003',
            email: 'lib@test.com',
            requiereFoto: false,
            requiereDni: true,
            activo: true,
          },
        }),
        tx.comercio.create({
          data: {
            nombre: 'Farmacia',
            direccion: 'Calle 10 1234',
            telefono: '2210004',
            email: 'far@test.com',
            requiereFoto: true,
            requiereDni: true,
            activo: true,
          },
        }),
        tx.comercio.create({
          data: {
            nombre: 'Ferreteria',
            direccion: 'Calle 11 1234',
            telefono: '2210005',
            email: 'fer@test.com',
            requiereFoto: false,
            requiereDni: false,
            activo: true,
          },
        }),
      ]);

      // 4. Crear 9 Repartidores y guardar sus PINs para imprimirlos
      const vehiculos: TipoVehiculo[] = ['MOTO', 'AUTO', 'CAMION'];
      const pines: { vehiculo: TipoVehiculo; email: string; pin: string }[] =
        [];
      const repartidores: { id: number }[] = [];

      let counter = 1;
      for (const vehiculo of vehiculos) {
        for (let i = 0; i < 3; i++) {
          const pinRaw = `${counter}${counter}${counter}${counter}`;
          pines.push({
            vehiculo,
            email: `rep${counter}@test.com`,
            pin: pinRaw,
          });
          const pinHash = hashingService.hmacPin(pinRaw);

          const rep = await tx.repartidor.create({
            data: {
              email: `rep${counter}@test.com`,
              nombre: `Repartidor ${counter}`,
              apellido: 'De prueba',
              telefono: `221111${counter}`,
              direccion: `Calle 20 ${counter}`,
              vehiculo,
              pinHmac: pinHash,
              estado: i === 0 ? 'OCUPADO' : 'FUERA_DE_JORNADA', // Uno ocupado por vehículo para viajes activos
            },
          });
          repartidores.push(rep);
          counter++;
        }
      }

      // 5. Crear 15 Envíos con Eventos (Ejemplo simplificado de creación)
      // Se crean envíos en estado PENDIENTE, EN_CAMINO_A_RETIRAR, etc. asegurando coherencia
      for (let i = 0; i < 15; i++) {
        const comercio = comercios[i % 5];
        const codigo = generarCodigoSeguimiento();
        const estado: EstadoEnvio =
          i < 5 ? 'PENDIENTE' : i < 10 ? 'ENTREGADO' : 'EN_CAMINO_A_RETIRAR';

        const envio = await tx.envio.create({
          data: {
            comercioId: comercio.id,
            codigoSeguimiento: codigo,
            estado,
            origenDireccion: comercio.direccion,
            destinatarioNombre: `Destinatario ${i}`,
            destinatarioTelefono: '2212222',
            destinoDireccion: `Calle 50 ${i}`,
            tamanio: 'CHICO' as TamanioPaquete,
            vehiculoRequerido: 'MOTO',
            requiereFoto: comercio.requiereFoto,
            requiereDni: comercio.requiereDni,
            repartidorId:
              estado === 'EN_CAMINO_A_RETIRAR' ? repartidores[0].id : null,
          },
        });

        await tx.eventoEnvio.create({
          data: {
            envioId: envio.id,
            tipo: estado === 'PENDIENTE' ? 'CREADO' : 'CAMBIO_ESTADO',
            estadoNuevo: 'PENDIENTE',
            actorTipo: 'OPERARIO' as TipoActor,
            creadoEn: new Date(Date.now() - 100000),
          },
        });
        // Si avanzó de estado, agregamos el evento correspondiente
        if (estado !== 'PENDIENTE') {
          await tx.eventoEnvio.create({
            data: {
              envioId: envio.id,
              tipo: 'CAMBIO_ESTADO' as TipoEvento,
              estadoAnterior: 'PENDIENTE',
              estadoNuevo: estado,
              actorTipo: 'REPARTIDOR' as TipoActor,
              actorId: repartidores[0].id,
            },
          });
        }
      }

      console.log('--- PINs DE REPARTIDORES GENERADOS ---');
      pines.forEach((p) =>
        console.log(`${p.vehiculo} - ${p.email} : PIN ${p.pin}`),
      );
      console.log('--------------------------------------');
    });

    console.log('¡Datos cargados con éxito!');
  } catch (error) {
    console.error('Error cargando la base de datos:', error);
  } finally {
    await app.close();
  }
}

void bootstrap();
