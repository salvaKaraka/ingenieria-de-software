import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  EstadoRepartidor,
  Prisma,
  RolUsuario,
  TipoVehiculo,
} from '../../generated/prisma/client';
import type { AsignacionService } from '../asignacion/asignacion.service';
import type { AuthService } from '../auth/auth.service';
import type {
  RepartidoresRepository,
  RepartidorPublico,
} from './repartidores.repository';
import { RepartidoresService } from './repartidores.service';

describe('RepartidoresService', () => {
  let servicio: RepartidoresService;
  let repo: jest.Mocked<RepartidoresRepository>;
  let authService: jest.Mocked<AuthService>;
  let asignacion: jest.Mocked<AsignacionService>;

  const repartidorEjemplo: RepartidorPublico = {
    id: 1,
    nombre: 'Carlos',
    apellido: 'Gómez',
    dni: '30123456',
    telefono: '1122334455',
    email: 'carlos@repartos.com',
    direccion: 'Av. Siempre Viva 123',
    vehiculo: TipoVehiculo.MOTO,
    estado: EstadoRepartidor.FUERA_DE_JORNADA,
    enColaDesde: null,
    viajesConsecutivos: 0,
    activo: true,
    creadoEn: new Date('2026-01-01T10:00:00Z'),
    actualizadoEn: new Date('2026-01-01T10:00:00Z'),
  };
  // Lo que ve el operario: el DNI nunca sale completo de la API.
  const repartidorVisible = { ...repartidorEjemplo, dni: '•••••456' };

  beforeEach(() => {
    repo = {
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      crear: jest.fn(),
      actualizar: jest.fn(),
      tieneViajeActivo: jest.fn(),
      tieneOfertaPendiente: jest.fn(),
      darDeBajaSiEstaLibre: jest.fn(),
      cambiarVehiculoSiEstaLibre: jest.fn(),
      reactivarSiEstaInactivo: jest.fn(),
    } as unknown as jest.Mocked<RepartidoresRepository>;

    authService = {
      asignarNuevoPin: jest.fn(),
      cerrarSesiones: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    asignacion = {
      reintentarPendientes: jest.fn(),
    } as unknown as jest.Mocked<AsignacionService>;

    servicio = new RepartidoresService(repo, authService, asignacion);
  });

  describe('listar', () => {
    it('debe devolver la lista de repartidores retornada por el repositorio', async () => {
      repo.listar.mockResolvedValue([repartidorEjemplo]);

      const resultado = await servicio.listar();

      expect(resultado).toEqual([repartidorVisible]);
      expect(repo.listar).toHaveBeenCalledTimes(1);
    });
  });

  describe('buscarPorId', () => {
    it('debe devolver el repartidor cuando existe', async () => {
      repo.buscarPorId.mockResolvedValue(repartidorEjemplo);

      const resultado = await servicio.buscarPorId(1);

      expect(resultado).toEqual(repartidorVisible);
      expect(repo.buscarPorId).toHaveBeenCalledWith(1);
    });

    it('debe lanzar NotFoundException cuando el repartidor no existe', async () => {
      repo.buscarPorId.mockResolvedValue(null);

      await expect(servicio.buscarPorId(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('crear', () => {
    it('crea el repartidor, genera su PIN de acceso y lo devuelve junto con los datos', async () => {
      repo.crear.mockResolvedValue(repartidorEjemplo);
      authService.asignarNuevoPin.mockResolvedValue('4321');

      const dto = {
        nombre: '  Carlos ',
        apellido: ' Gómez  ',
        dni: '30123456',
        telefono: ' 1122334455 ',
        email: ' Carlos@Repartos.COM ',
        direccion: '  Av. Siempre Viva 123  ',
        vehiculo: TipoVehiculo.MOTO,
      };

      const resultado = await servicio.crear(dto);

      expect(repo.crear).toHaveBeenCalledWith({
        nombre: 'Carlos',
        apellido: 'Gómez',
        dni: '30123456',
        telefono: '1122334455',
        email: 'carlos@repartos.com',
        direccion: 'Av. Siempre Viva 123',
        vehiculo: TipoVehiculo.MOTO,
      });
      expect(authService.asignarNuevoPin).toHaveBeenCalledWith(1);
      expect(resultado).toEqual({
        ...repartidorVisible,
        pin: '4321',
      });
    });
  });

  describe('DNI y email únicos', () => {
    // Así informa Prisma (con el adapter de pg) qué índice único se violó.
    const repetido = (indice: string) =>
      new Prisma.PrismaClientKnownRequestError('duplicado', {
        code: 'P2002',
        clientVersion: 'test',
        meta: {
          modelName: 'Repartidor',
          driverAdapterError: {
            cause: {
              kind: 'UniqueConstraintViolation',
              constraint: { index: indice },
            },
          },
        },
      });
    const altaNueva = {
      nombre: 'Ana',
      apellido: 'Paz',
      dni: '28111222',
      telefono: '221 555-0000',
      email: 'ana@repartos.com',
      direccion: 'Calle 7 1234',
      vehiculo: TipoVehiculo.MOTO,
    };

    it('al crear con un DNI que ya existe responde 409 "El repartidor ya se encuentra registrado" y no genera PIN', async () => {
      repo.crear.mockRejectedValue(repetido('repartidores_dni_key'));

      await expect(servicio.crear(altaNueva)).rejects.toThrow(
        new ConflictException('El repartidor ya se encuentra registrado'),
      );
      expect(authService.asignarNuevoPin).not.toHaveBeenCalled();
    });

    it('al crear con un email que ya existe responde 409 y no genera PIN', async () => {
      repo.crear.mockRejectedValue(repetido('repartidores_email_key'));

      await expect(servicio.crear(altaNueva)).rejects.toThrow(
        new ConflictException('Ya existe un repartidor con ese email'),
      );
      expect(authService.asignarNuevoPin).not.toHaveBeenCalled();
    });

    it('al editar con el DNI de otro repartidor responde 409', async () => {
      repo.buscarPorId.mockResolvedValue(repartidorEjemplo);
      repo.actualizar.mockRejectedValue(repetido('repartidores_dni_key'));

      await expect(servicio.actualizar(1, { dni: '28111222' })).rejects.toThrow(
        new ConflictException('El repartidor ya se encuentra registrado'),
      );
    });

    it('al editar con un email de otro repartidor responde 409', async () => {
      repo.buscarPorId.mockResolvedValue(repartidorEjemplo);
      repo.actualizar.mockRejectedValue(repetido('repartidores_email_key'));

      await expect(
        servicio.actualizar(1, { email: 'otro@repartos.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('actualizar', () => {
    it('actualiza los datos cuando el repartidor existe', async () => {
      repo.buscarPorId.mockResolvedValue(repartidorEjemplo);
      repo.actualizar.mockResolvedValue({
        ...repartidorEjemplo,
        nombre: 'Carlos Alberto',
      });

      const resultado = await servicio.actualizar(1, {
        nombre: '  Carlos Alberto ',
      });

      expect(resultado.nombre).toBe('Carlos Alberto');
      expect(repo.actualizar).toHaveBeenCalledWith(1, {
        nombre: 'Carlos Alberto',
      });
    });

    it('lanza NotFoundException si el repartidor no existe', async () => {
      repo.buscarPorId.mockResolvedValue(null);

      await expect(
        servicio.actualizar(999, { nombre: 'Otro' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cambio de vehículo', () => {
    const conMoto = { ...repartidorEjemplo, vehiculo: TipoVehiculo.MOTO };
    const conAuto = { ...repartidorEjemplo, vehiculo: TipoVehiculo.AUTO };

    it('cambia el vehículo con los demás datos y vuelve a correr el motor', async () => {
      repo.buscarPorId
        .mockResolvedValueOnce(conMoto)
        .mockResolvedValueOnce(conAuto);
      repo.tieneViajeActivo.mockResolvedValue(false);
      repo.tieneOfertaPendiente.mockResolvedValue(false);
      repo.cambiarVehiculoSiEstaLibre.mockResolvedValue(true);

      const resultado = await servicio.actualizar(1, {
        telefono: ' 221 ',
        vehiculo: TipoVehiculo.AUTO,
      });

      expect(repo.cambiarVehiculoSiEstaLibre).toHaveBeenCalledWith(1, {
        telefono: '221',
        vehiculo: TipoVehiculo.AUTO,
      });
      expect(repo.actualizar).not.toHaveBeenCalled();
      expect(asignacion.reintentarPendientes).toHaveBeenCalled();
      expect(resultado.vehiculo).toBe(TipoVehiculo.AUTO);
    });

    it('rechaza el cambio (409) con "El repartidor tiene un viaje en curso" y no lo modifica', async () => {
      repo.buscarPorId.mockResolvedValue(conMoto);
      repo.tieneViajeActivo.mockResolvedValue(true);

      await expect(
        servicio.actualizar(1, { vehiculo: TipoVehiculo.AUTO }),
      ).rejects.toThrow(
        new ConflictException('El repartidor tiene un viaje en curso'),
      );
      expect(repo.cambiarVehiculoSiEstaLibre).not.toHaveBeenCalled();
      expect(repo.actualizar).not.toHaveBeenCalled();
    });

    it('rechaza el cambio (409) si tiene una oferta sin responder', async () => {
      repo.buscarPorId.mockResolvedValue(conMoto);
      repo.tieneViajeActivo.mockResolvedValue(false);
      repo.tieneOfertaPendiente.mockResolvedValue(true);

      await expect(
        servicio.actualizar(1, { vehiculo: TipoVehiculo.AUTO }),
      ).rejects.toThrow(ConflictException);
      expect(repo.cambiarVehiculoSiEstaLibre).not.toHaveBeenCalled();
    });

    it('si recibió un viaje mientras se guardaba, responde 409 y no corre el motor', async () => {
      repo.buscarPorId.mockResolvedValue(conMoto);
      repo.tieneViajeActivo.mockResolvedValue(false);
      repo.tieneOfertaPendiente.mockResolvedValue(false);
      repo.cambiarVehiculoSiEstaLibre.mockResolvedValue(false);

      await expect(
        servicio.actualizar(1, { vehiculo: TipoVehiculo.AUTO }),
      ).rejects.toThrow(ConflictException);
      expect(asignacion.reintentarPendientes).not.toHaveBeenCalled();
    });

    it('con el mismo vehículo es una edición común y se permite aunque esté en un viaje', async () => {
      repo.buscarPorId.mockResolvedValue(conMoto);
      repo.actualizar.mockResolvedValue(conMoto);

      await servicio.actualizar(1, {
        telefono: '221',
        vehiculo: TipoVehiculo.MOTO,
      });

      expect(repo.tieneViajeActivo).not.toHaveBeenCalled();
      expect(repo.actualizar).toHaveBeenCalledWith(1, { telefono: '221' });
      expect(repo.cambiarVehiculoSiEstaLibre).not.toHaveBeenCalled();
    });
  });

  describe('darDeBaja', () => {
    it('lanza NotFoundException si el repartidor no existe', async () => {
      repo.buscarPorId.mockResolvedValue(null);

      await expect(servicio.darDeBaja(999)).rejects.toThrow(NotFoundException);
    });

    it('rechaza la baja (409) con "El repartidor tiene un viaje en curso" y no lo modifica', async () => {
      repo.buscarPorId.mockResolvedValue(repartidorEjemplo);
      repo.tieneViajeActivo.mockResolvedValue(true);

      await expect(servicio.darDeBaja(1)).rejects.toThrow(
        new ConflictException('El repartidor tiene un viaje en curso'),
      );
      expect(repo.darDeBajaSiEstaLibre).not.toHaveBeenCalled();
      expect(authService.cerrarSesiones).not.toHaveBeenCalled();
    });

    it('rechaza la baja (409) si el repartidor tiene una oferta sin responder', async () => {
      repo.buscarPorId.mockResolvedValue(repartidorEjemplo);
      repo.tieneViajeActivo.mockResolvedValue(false);
      repo.tieneOfertaPendiente.mockResolvedValue(true);

      await expect(servicio.darDeBaja(1)).rejects.toThrow(ConflictException);
      expect(repo.darDeBajaSiEstaLibre).not.toHaveBeenCalled();
    });

    it('si recibió un viaje durante la baja, responde 409 y no cierra sus sesiones', async () => {
      repo.buscarPorId.mockResolvedValue(repartidorEjemplo);
      repo.tieneViajeActivo.mockResolvedValue(false);
      repo.tieneOfertaPendiente.mockResolvedValue(false);
      repo.darDeBajaSiEstaLibre.mockResolvedValue(false);

      await expect(servicio.darDeBaja(1)).rejects.toThrow(ConflictException);
      expect(authService.cerrarSesiones).not.toHaveBeenCalled();
    });

    it('desactiva al repartidor y revoca sus sesiones si no tiene viajes ni ofertas', async () => {
      repo.buscarPorId.mockResolvedValue(repartidorEjemplo);
      repo.tieneViajeActivo.mockResolvedValue(false);
      repo.tieneOfertaPendiente.mockResolvedValue(false);
      repo.darDeBajaSiEstaLibre.mockResolvedValue(true);

      await servicio.darDeBaja(1);

      expect(repo.darDeBajaSiEstaLibre).toHaveBeenCalledWith(1);
      expect(authService.cerrarSesiones).toHaveBeenCalledWith(
        RolUsuario.REPARTIDOR,
        1,
      );
    });
  });

  describe('resetearPin', () => {
    it('lanza NotFoundException si el repartidor no existe', async () => {
      repo.buscarPorId.mockResolvedValue(null);

      await expect(servicio.resetearPin(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza ConflictException si el repartidor está inactivo', async () => {
      repo.buscarPorId.mockResolvedValue({
        ...repartidorEjemplo,
        activo: false,
      });

      await expect(servicio.resetearPin(1)).rejects.toThrow(ConflictException);
      expect(authService.asignarNuevoPin).not.toHaveBeenCalled();
    });

    it('genera un nuevo PIN y lo retorna cuando el repartidor está activo', async () => {
      repo.buscarPorId.mockResolvedValue(repartidorEjemplo);
      authService.asignarNuevoPin.mockResolvedValue('9876');

      const resultado = await servicio.resetearPin(1);

      expect(resultado).toEqual({ pin: '9876' });
      expect(authService.asignarNuevoPin).toHaveBeenCalledWith(1);
    });
  });

  describe('reactivar', () => {
    const dadoDeBaja = { ...repartidorEjemplo, activo: false };

    it('lanza NotFoundException si el repartidor no existe', async () => {
      repo.buscarPorId.mockResolvedValue(null);

      await expect(servicio.reactivar(999)).rejects.toThrow(NotFoundException);
    });

    it('rechaza (409) reactivar a un repartidor que ya está activo y no le cambia el PIN', async () => {
      repo.buscarPorId.mockResolvedValue(repartidorEjemplo);

      await expect(servicio.reactivar(1)).rejects.toThrow(
        new ConflictException('El repartidor ya está activo'),
      );
      expect(repo.reactivarSiEstaInactivo).not.toHaveBeenCalled();
      expect(authService.asignarNuevoPin).not.toHaveBeenCalled();
    });

    it('si otro operario lo reactivó mientras tanto, responde 409 y no genera otro PIN', async () => {
      repo.buscarPorId.mockResolvedValue(dadoDeBaja);
      repo.reactivarSiEstaInactivo.mockResolvedValue(false);

      await expect(servicio.reactivar(1)).rejects.toThrow(ConflictException);
      expect(authService.asignarNuevoPin).not.toHaveBeenCalled();
    });

    it('lo vuelve a activar y le genera un PIN nuevo que devuelve una sola vez', async () => {
      repo.buscarPorId.mockResolvedValue(dadoDeBaja);
      repo.reactivarSiEstaInactivo.mockResolvedValue(true);
      authService.asignarNuevoPin.mockResolvedValue('5555');

      const resultado = await servicio.reactivar(1);

      expect(repo.reactivarSiEstaInactivo).toHaveBeenCalledWith(1);
      expect(authService.asignarNuevoPin).toHaveBeenCalledWith(1);
      expect(resultado).toMatchObject({ id: 1, activo: true, pin: '5555' });
      expect(resultado.dni).toBe('•••••456');
    });
  });
});
