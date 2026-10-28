import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ComerciosRepository } from './comercios.repository';
import { ComerciosService } from './comercios.service';
import { ActualizarComercioDto } from './dto/actualizar-comercio.dto';

describe('ComerciosService', () => {
  let service: ComerciosService;
  const repository = {
    buscarTodos: jest.fn(),
    buscarPorId: jest.fn(),
    buscarPorNombre: jest.fn(),
    crear: jest.fn(),
    actualizar: jest.fn(),
    eliminarLogico: jest.fn(),
    contarEnviosEnCurso: jest.fn(),
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

  const nuevo = {
    nombre: 'Panadería Sol',
    telefono: '221 555-0000',
    email: 'sol@mail.com',
    direccion: 'Calle 7 123',
    requiereFoto: true,
    requiereDni: true,
  };

  it('registra un comercio con un nombre que no existe', async () => {
    repository.buscarPorNombre.mockResolvedValue(null);
    repository.crear.mockResolvedValue({ id: 1, ...nuevo });
    await expect(service.crear(nuevo)).resolves.toMatchObject({
      requiereFoto: true,
      requiereDni: true,
    });
    expect(repository.buscarPorNombre).toHaveBeenCalledWith('Panadería Sol');
  });

  it('rechaza el alta de un comercio con un nombre ya registrado', async () => {
    repository.buscarPorNombre.mockResolvedValue({ id: 5, activo: false });
    await expect(service.crear(nuevo)).rejects.toThrow(
      new ConflictException('El comercio ya se encuentra registrado'),
    );
    expect(repository.crear).not.toHaveBeenCalled();
  });

  it('rechaza renombrar un comercio con el nombre de otro', async () => {
    repository.buscarPorId.mockResolvedValue({ id: 1, activo: true });
    repository.buscarPorNombre.mockResolvedValue({ id: 2, activo: true });
    await expect(
      service.actualizar(1, { nombre: 'Panadería Sol' }),
    ).rejects.toThrow(ConflictException);
    expect(repository.actualizar).not.toHaveBeenCalled();
  });

  it('permite editar un comercio sin cambiarle el nombre', async () => {
    repository.buscarPorId.mockResolvedValue({ id: 1, activo: true });
    repository.buscarPorNombre.mockResolvedValue({ id: 1, activo: true });
    await service.actualizar(1, { nombre: 'Panadería Sol', telefono: '221' });
    expect(repository.actualizar).toHaveBeenCalled();
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
    repository.contarEnviosEnCurso.mockResolvedValue(0);
    await service.eliminarLogico(1);
    expect(repository.eliminarLogico).toHaveBeenCalledWith(1);
  });

  it('no da de baja un comercio con envíos en curso', async () => {
    repository.buscarPorId.mockResolvedValue({ id: 1, activo: true });
    repository.contarEnviosEnCurso.mockResolvedValue(2);
    await expect(service.eliminarLogico(1)).rejects.toThrow(
      new ConflictException('El comercio tiene envíos en curso'),
    );
    expect(repository.eliminarLogico).not.toHaveBeenCalled();
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

  it('recorta los espacios del nombre y rechaza uno en blanco', async () => {
    const dto = plainToInstance(ActualizarComercioDto, { nombre: '  Sol  ' });
    expect(dto.nombre).toBe('Sol');
    expect(await errores({ nombre: '   ' })).toEqual(['nombre']);
  });
});
