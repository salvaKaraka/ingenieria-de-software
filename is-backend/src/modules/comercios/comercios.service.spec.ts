import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ComerciosRepository } from './comercios.repository';
import { ComerciosService } from './comercios.service';
import { ActualizarComercioDto } from './dto/actualizar-comercio.dto';

describe('ComerciosService', () => {
  let service: ComerciosService;
  const repository = {
    buscarTodos: jest.fn(),
    buscarPorId: jest.fn(),
    crear: jest.fn(),
    actualizar: jest.fn(),
    eliminarLogico: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const modulo = await Test.createTestingModule({
      providers: [
        ComerciosService,
        { provide: ComerciosRepository, useValue: repository },
      ],
    }).compile();
    service = modulo.get(ComerciosService);
  });

  it('pasa el filtro de búsqueda al repository', async () => {
    repository.buscarTodos.mockResolvedValue([]);
    await service.obtenerTodos('sol');
    expect(repository.buscarTodos).toHaveBeenCalledWith('sol');
  });

  it('lanza NotFoundException si el comercio no existe', async () => {
    repository.buscarPorId.mockResolvedValue(null);
    await expect(service.obtenerPorId(99)).rejects.toThrow(NotFoundException);
  });

  it('devuelve el comercio aunque esté dado de baja', async () => {
    repository.buscarPorId.mockResolvedValue({ id: 1, activo: false });
    await expect(service.obtenerPorId(1)).resolves.toEqual({
      id: 1,
      activo: false,
    });
  });

  it('no actualiza un comercio inexistente', async () => {
    repository.buscarPorId.mockResolvedValue(null);
    await expect(service.actualizar(99, { nombre: 'Nuevo' })).rejects.toThrow(
      NotFoundException,
    );
    expect(repository.actualizar).not.toHaveBeenCalled();
  });

  it('la baja lógica llama a eliminarLogico en vez de borrar', async () => {
    repository.buscarPorId.mockResolvedValue({ id: 1, activo: true });
    await service.eliminarLogico(1);
    expect(repository.eliminarLogico).toHaveBeenCalledWith(1);
  });

  it('no da de baja un comercio inexistente', async () => {
    repository.buscarPorId.mockResolvedValue(null);
    await expect(service.eliminarLogico(99)).rejects.toThrow(NotFoundException);
    expect(repository.eliminarLogico).not.toHaveBeenCalled();
  });
});

describe('ActualizarComercioDto', () => {
  async function errores(datos: object) {
    const errores = await validate(
      plainToInstance(ActualizarComercioDto, datos),
    );
    return errores.map((error) => error.property);
  }

  it('acepta un PATCH con un solo campo', async () => {
    expect(await errores({ telefono: '221 555-0000' })).toEqual([]);
  });

  it('rechaza null en un campo obligatorio en vez de llegar a la base', async () => {
    expect(await errores({ nombre: null, requiereFoto: null })).toEqual([
      'nombre',
      'requiereFoto',
    ]);
  });

  it('rechaza un email inválido', async () => {
    expect(await errores({ email: 'a@b' })).toEqual(['email']);
  });
});
