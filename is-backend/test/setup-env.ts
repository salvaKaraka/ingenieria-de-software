import { urlBaseDeTest } from './base-de-test';

// Corre en cada archivo de test e2e antes de cargar la app: la apunta a la base de test.
process.env.DATABASE_URL = urlBaseDeTest();

// Los jobs periódicos se apagan: los tests los ejecutan a mano para controlar cuándo corren.
process.env.DESACTIVAR_JOBS = 'true';
