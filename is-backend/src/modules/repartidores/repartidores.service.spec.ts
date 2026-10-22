import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  EstadoRepartidor,
  Prisma,
  RolUsuario,
  TipoVehiculo,
} from '../../generated/prisma/client';
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

  const repartidorEjemplo: RepartidorPublico = {
    id: 1,
    nombre: 'Carlos',
    apellido: 'Gómez',
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

  beforeEach(() => {
    repo = {
      listar: jest.fn(),
      buscarPorId: jest.fn(),
      crear: jest.fn(),
      actualizar: jest.fn(),
      tieneViajeActivo: jest.fn(),
      tieneOfertaPendiente: jest.fn(),
      darDeBajaSiEstaLibre: jest.fn(),
    } as unknown as jest.Mocked<RepartidoresRepository>;

    authService = {
      asignarNuevoPin: jest.fn(),
      cerrarSesiones: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    servicio = new RepartidoresService(repo, authService);
  });

  describe('listar', () => {
    it('debe devolver la lista de repartidores retornada por el repositorio', async () => {
      repo.listar.mockResolvedValue([repartidorEjemplo]);

      const resultado = await servicio.listar();

      expect(resultado).toEqual([repartidorEjemplo]);
      expect(repo.listar).toHaveBeenCalledTimes(1);
    });
  });

  describe('buscarPorId', () => {
    it('debe devolver el repartidor cuando existe', async () => {
      repo.buscarPorId.mockResolvedValue(repartidorEjemplo);

      const resultado = await servicio.buscarPorId(1);

      expect(resultado).toEqual(repartidorEjemplo);
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
        telefono: ' 1122334455 ',
        email: ' Carlos@Repartos.COM ',
        direccion: '  Av. Siempre Viva 123  ',
        vehiculo: TipoVehiculo.MOTO,
      };

      const resultado = await servicio.crear(dto);

      expect(repo.crear).toHaveBeenCalledWith({
        nombre: 'Carlos',
        apellido: 'Gómez',
        telefono: '1122334455',
        email: 'carlos@repartos.com',
        direccion: 'Av. Siempre Viva 123',
        vehiculo: TipoVehiculo.MOTO,
      });
      expect(authService.asignarNuevoPin).toHaveBeenCalledWith(1);
      expect(resultado).toEqual({
        ...repartidorEjemplo,
        pin: '4321',
      });
    });
  });

  describe('email único', () => {
    const emailRepetido = () =>
      new Prisma.PrismaClientKnownRequestError('duplicado', {
        code: 'P2002',
        clientVersion: 'test',
      });

    it('al crear con un email que ya existe responde 409 y no genera PIN', async () => {
      repo.crear.mockRejectedValue(emailRepetido());

      await expect(
        servicio.crear({
          nombre: 'Ana',
          apellido: 'Paz',
          telefono: '221 555-0000',
          email: 'ana@repartos.com',
          direccion: 'Calle 7 1234',
          vehiculo: TipoVehiculo.MOTO,
        }),
      ).rejects.toThrow(ConflictException);
      expect(authService.asignarNuevoPin).not.toHaveBeenCalled();
    });

    it('al editar con un email de otro repartidor responde 409', async () => {
      repo.buscarPorId.mockResolvedValue(repartidorEjemplo);
      repo.actualizar.mockRejectedValue(emailRepetido());

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

  describe('darDeBaja', () => {
    it('lanza NotFoundException si el repartidor no existe', async () => {
      repo.buscarPorId.mockResolvedValue(null);

      await expect(servicio.darDeBaja(999)).rejects.toThrow(NotFoundException);
    });

    it('lanza ConflictException (409) si el repartidor tiene un viaje activo y no lo modifica', async () => {
      repo.buscarPorId.mockResolvedValue(repartidorEjemplo);
      repo.tieneViajeActivo.mockResolvedValue(true);

      await expect(servicio.darDeBaja(1)).rejects.toThrow(ConflictException);
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
});
