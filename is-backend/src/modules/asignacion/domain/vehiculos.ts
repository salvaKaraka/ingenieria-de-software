import type { TipoVehiculo } from '../../../generated/prisma/client';

// Vehículos de menor a mayor capacidad.
export const VEHICULOS_DE_MENOR_A_MAYOR: TipoVehiculo[] = [
  'MOTO',
  'AUTO',
  'CAMION',
];

// El tamaño del paquete fija el vehículo MÍNIMO: un paquete chico lo puede llevar una moto,
// un auto o un camión. Devuelve los vehículos que sirven, en orden de preferencia
// (el más chico primero, para no ocupar un camión mientras haya una moto libre).
export function vehiculosQuePuedenLlevar(minimo: TipoVehiculo): TipoVehiculo[] {
  return VEHICULOS_DE_MENOR_A_MAYOR.slice(
    VEHICULOS_DE_MENOR_A_MAYOR.indexOf(minimo),
  );
}
