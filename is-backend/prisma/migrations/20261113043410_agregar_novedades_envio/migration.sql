-- AlterEnum
ALTER TYPE "EstadoEnvio" ADD VALUE 'CON_NOVEDAD';

-- CreateTable
CREATE TABLE "Novedad" (
    "id" SERIAL NOT NULL,
    "envio_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "comentario" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Novedad_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Novedad" ADD CONSTRAINT "Novedad_envio_id_fkey" FOREIGN KEY ("envio_id") REFERENCES "envios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
