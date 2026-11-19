import type { AsignacionRepository } from './asignacion.repository';
import { AsignacionService } from './asignacion.service';

describe('AsignacionService', () => {
  const tx = {};
  const repo = {
    transaccion: jest.fn(),
    bloquearEnvio: jest.fn(),
    tieneOfertaVigente: jest.fn(),
    tieneIncidente: jest.fn(),
    tomarCandidato: jest.fn(),
    hayOtroCandidatoDisponible: jest.fn(),
    mandarADescansar: jest.fn(),
    marcarInterrumpidoComoPendiente: jest.fn(),
    marcarParado: jest.fn(),
    ofrecer: jest.fn(),
    registrarAvisoExcepcion: jest.fn(),
    enviosPendientesSinOferta: jest.fn(),
  };
  let service: AsignacionService;

  beforeEach(() => {
    jest.resetAllMocks();
    repo.transaccion.mockImplementation(
      (trabajo: (txActual: object) => Promise<unknown>) => trabajo(tx),
    );
    repo.bloquearEnvio.mockResolvedValue({
      id: 5,
      estado: 'INTERRUMPIDO',
      vehiculoRequerido: 'MOTO',
    });
    repo.tieneOfertaVigente.mockResolvedValue(false);
    repo.tieneIncidente.mockResolvedValue(true);
    repo.marcarInterrumpidoComoPendiente.mockResolvedValue(true);
    repo.tomarCandidato.mockResolvedValue({
      id: 9,
      viajesConsecutivos: 0,
      vehiculo: 'MOTO',
    });
    repo.ofrecer.mockResolvedValue({ id: 50 });
    service = new AsignacionService(repo as unknown as AsignacionRepository);
  });

  it('ofrece el envío interrumpido y lo devuelve al estado pendiente', async () => {
    await expect(service.asignar(5)).resolves.toEqual({ id: 50 });

    expect(repo.marcarInterrumpidoComoPendiente).toHaveBeenCalledWith(tx, 5);
    expect(repo.ofrecer).toHaveBeenCalledWith(tx, 5, 9, expect.any(Date));
    expect(repo.marcarParado).not.toHaveBeenCalled();
  });

  it('pasa a parado el envío interrumpido si no hay candidatos', async () => {
    repo.tomarCandidato.mockResolvedValue(null);

    await expect(service.asignar(5)).resolves.toBeNull();
    expect(repo.marcarParado).toHaveBeenCalledWith(tx, 5, 'INTERRUMPIDO');
  });

  it('pasa a parado el envío después del rechazo si no queda otro candidato', async () => {
    repo.bloquearEnvio.mockResolvedValue({
      id: 5,
      estado: 'PENDIENTE',
      vehiculoRequerido: 'MOTO',
    });
    repo.tomarCandidato.mockResolvedValue(null);

    await expect(service.asignar(5)).resolves.toBeNull();
    expect(repo.marcarParado).toHaveBeenCalledWith(tx, 5, 'PENDIENTE');
  });
});
