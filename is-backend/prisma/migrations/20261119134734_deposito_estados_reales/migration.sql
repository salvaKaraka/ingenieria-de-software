-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EstadoEnvio" ADD VALUE 'EN_CUSTODIA';
ALTER TYPE "EstadoEnvio" ADD VALUE 'EN_DEVOLUCION';
ALTER TYPE "EstadoEnvio" ADD VALUE 'DEVUELTO_AL_COMERCIO';

-- AlterTable
ALTER TABLE "envios" ADD COLUMN     "orden_devolucion_id" INTEGER;

-- CreateTable
CREATE TABLE "ordenes_devolucion" (
    "id" SERIAL NOT NULL,
    "comercio_id" INTEGER NOT NULL,
    "vehiculo_requerido" "TipoVehiculo" NOT NULL,
    "repartidor_id" INTEGER,
    "foto_constancia_url" TEXT,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmada_en" TIMESTAMP(3),

    CONSTRAINT "ordenes_devolucion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ordenes_devolucion_repartidor_id_idx" ON "ordenes_devolucion"("repartidor_id");

-- CreateIndex
CREATE INDEX "envios_orden_devolucion_id_idx" ON "envios"("orden_devolucion_id");

-- AddForeignKey
ALTER TABLE "envios" ADD CONSTRAINT "envios_orden_devolucion_id_fkey" FOREIGN KEY ("orden_devolucion_id") REFERENCES "ordenes_devolucion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_devolucion" ADD CONSTRAINT "ordenes_devolucion_comercio_id_fkey" FOREIGN KEY ("comercio_id") REFERENCES "comercios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_devolucion" ADD CONSTRAINT "ordenes_devolucion_repartidor_id_fkey" FOREIGN KEY ("repartidor_id") REFERENCES "repartidores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
