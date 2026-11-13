-- AlterTable
ALTER TABLE "envios" ADD COLUMN     "destino_lat" DOUBLE PRECISION,
ADD COLUMN     "destino_lon" DOUBLE PRECISION,
ADD COLUMN     "duracion_estimada_min" INTEGER,
ADD COLUMN     "origen_lat" DOUBLE PRECISION,
ADD COLUMN     "origen_lon" DOUBLE PRECISION;
