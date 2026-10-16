import { urlBaseDeTest } from './base-de-test';

// Corre en cada archivo de test e2e antes de cargar la app: la apunta a la base de test.
process.env.DATABASE_URL = urlBaseDeTest();
