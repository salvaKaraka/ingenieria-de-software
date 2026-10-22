// Parámetros del motor de asignación. Son reglas de negocio sujetas a cambio (riesgo 1 del PGP):
// si el cliente decide otros valores, se cambian acá.

// Tiempo que tiene el repartidor para aceptar o rechazar una oferta (épica 3.3).
export const OFERTA_SEGUNDOS = 5 * 60;

// Con esta cantidad de entregas seguidas, el repartidor descansa un turno (épica 3.2, supuesto 5).
export const MAX_VIAJES_CONSECUTIVOS = 2;
