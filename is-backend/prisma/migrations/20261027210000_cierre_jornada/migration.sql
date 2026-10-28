-- AlterEnum
ALTER TYPE "EstadoRepartidor" ADD VALUE 'ESPERANDO_VALIDACION_CIERRE';

-- AlterTable
ALTER TABLE "repartidores" ADD COLUMN "cierre_solicitado" BOOLEAN NOT NULL DEFAULT false;
