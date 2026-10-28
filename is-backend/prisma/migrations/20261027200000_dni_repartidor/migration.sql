-- AlterTable
ALTER TABLE "repartidores" ADD COLUMN "dni" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "repartidores_dni_key" ON "repartidores"("dni");
