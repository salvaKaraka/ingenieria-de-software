import { vehiculosQuePuedenLlevar } from './vehiculos';

describe('vehiculosQuePuedenLlevar', () => {
  it('un paquete chico lo lleva cualquier vehículo, la moto primero', () => {
    expect(vehiculosQuePuedenLlevar('MOTO')).toEqual([
      'MOTO',
      'AUTO',
      'CAMION',
    ]);
  });

  it('un paquete mediano no entra en una moto', () => {
    expect(vehiculosQuePuedenLlevar('AUTO')).toEqual(['AUTO', 'CAMION']);
  });

  it('un paquete grande solo va en camión', () => {
    expect(vehiculosQuePuedenLlevar('CAMION')).toEqual(['CAMION']);
  });
});
