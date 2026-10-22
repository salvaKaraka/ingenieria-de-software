import {
  esTransicionValida,
  siguienteEstado,
  EstadoEnvio,
  TipoActor,
} from './estado-envio';

describe('Máquina de estados del envío', () => {
  it('el repartidor puede avanzar secuencialmente el viaje', () => {
    expect(
      esTransicionValida(
        EstadoEnvio.PENDIENTE,
        EstadoEnvio.ASIGNADO,
        TipoActor.REPARTIDOR,
      ),
    ).toBe(true);
    expect(
      esTransicionValida(
        EstadoEnvio.ASIGNADO,
        EstadoEnvio.EN_CAMINO_A_RETIRAR,
        TipoActor.REPARTIDOR,
      ),
    ).toBe(true);
    expect(
      esTransicionValida(
        EstadoEnvio.EN_DOMICILIO,
        EstadoEnvio.ENTREGADO,
        TipoActor.REPARTIDOR,
      ),
    ).toBe(true);
  });

  it('el repartidor no puede saltar estados', () => {
    expect(
      esTransicionValida(
        EstadoEnvio.PENDIENTE,
        EstadoEnvio.RETIRADO,
        TipoActor.REPARTIDOR,
      ),
    ).toBe(false);
  });

  it('el operario puede cancelar un envío que no esté entregado ni cancelado', () => {
    expect(
      esTransicionValida(
        EstadoEnvio.PENDIENTE,
        EstadoEnvio.CANCELADO,
        TipoActor.OPERARIO,
      ),
    ).toBe(true);
    expect(
      esTransicionValida(
        EstadoEnvio.EN_CAMINO_A_RETIRAR,
        EstadoEnvio.CANCELADO,
        TipoActor.OPERARIO,
      ),
    ).toBe(true);
  });

  it('el operario no puede cancelar un envío entregado', () => {
    expect(
      esTransicionValida(
        EstadoEnvio.ENTREGADO,
        EstadoEnvio.CANCELADO,
        TipoActor.OPERARIO,
      ),
    ).toBe(false);
  });

  it('siguienteEstado devuelve el paso correcto', () => {
    expect(siguienteEstado(EstadoEnvio.RETIRADO)).toBe(
      EstadoEnvio.EN_DOMICILIO,
    );
    expect(siguienteEstado(EstadoEnvio.ENTREGADO)).toBeNull();
  });
});
