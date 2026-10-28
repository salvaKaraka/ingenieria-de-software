-- AlterEnum
ALTER TYPE "EstadoRepartidor" ADD VALUE 'ESPERANDO_VALIDACION_CIERRE';

-- AlterEnum
ALTER TYPE "TipoEvento" ADD VALUE 'DEVOLUCION';

-- AlterTable
ALTER TABLE "repartidores" ADD COLUMN "cierre_solicitado" BOOLEAN NOT NULL DEFAULT false;
