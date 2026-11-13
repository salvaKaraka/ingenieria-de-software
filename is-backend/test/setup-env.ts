import { urlBaseDeTest } from './base-de-test';

// Corre en cada archivo de test e2e antes de cargar la app: la apunta a la base de test.
process.env.DATABASE_URL = urlBaseDeTest();

// Los jobs periódicos se apagan: los tests los ejecutan a mano para controlar cuándo corren.
process.env.DESACTIVAR_JOBS = 'true';

// Sin key de mapas: los tests no salen a internet y la franja (HU 70) usa el plan B.
// El que quiera probar el mapa lo simula con jest.spyOn sobre MapasService.
process.env.ORS_API_KEY = '';
