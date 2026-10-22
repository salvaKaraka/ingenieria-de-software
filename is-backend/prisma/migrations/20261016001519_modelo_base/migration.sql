-- CreateEnum
CREATE TYPE "TamanioPaquete" AS ENUM ('CHICO', 'MEDIANO', 'GRANDE');

-- CreateEnum
CREATE TYPE "TipoVehiculo" AS ENUM ('MOTO', 'AUTO', 'CAMION');

-- CreateEnum
CREATE TYPE "EstadoEnvio" AS ENUM ('PENDIENTE', 'ASIGNADO', 'EN_CAMINO_A_RETIRAR', 'RETIRADO', 'EN_DOMICILIO', 'ENTREGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoRepartidor" AS ENUM ('FUERA_DE_JORNADA', 'DISPONIBLE', 'OCUPADO', 'EN_PAUSA', 'EMERGENCIA');

-- CreateEnum
CREATE TYPE "EstadoOferta" AS ENUM ('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'VENCIDA');

-- CreateEnum
CREATE TYPE "TipoActor" AS ENUM ('OPERARIO', 'REPARTIDOR', 'SISTEMA');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('CREADO', 'CAMBIO_ESTADO', 'REASIGNACION', 'NOVEDAD', 'INCIDENTE', 'NOTA');

-- CreateTable
CREATE TABLE "comercios" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "requiere_foto" BOOLEAN NOT NULL DEFAULT false,
    "requiere_dni" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comercios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repartidores" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "vehiculo" "TipoVehiculo" NOT NULL,
    "estado" "EstadoRepartidor" NOT NULL DEFAULT 'FUERA_DE_JORNADA',
    "en_cola_desde" TIMESTAMP(3),
    "viajes_consecutivos" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repartidores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envios" (
    "id" SERIAL NOT NULL,
    "codigo_seguimiento" TEXT NOT NULL,
    "comercio_id" INTEGER NOT NULL,
    "origen_direccion" TEXT NOT NULL,
    "destino_direccion" TEXT NOT NULL,
    "destinatario_nombre" TEXT,
    "destinatario_apellido" TEXT,
    "destinatario_dni" TEXT,
    "destinatario_telefono" TEXT,
    "tamanio" "TamanioPaquete" NOT NULL,
    "vehiculo_requerido" "TipoVehiculo" NOT NULL,
    "observaciones" TEXT,
    "requiere_foto" BOOLEAN NOT NULL,
    "requiere_dni" BOOLEAN NOT NULL,
    "estado" "EstadoEnvio" NOT NULL DEFAULT 'PENDIENTE',
    "repartidor_id" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "envios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_envio" (
    "id" SERIAL NOT NULL,
    "envio_id" INTEGER NOT NULL,
    "tipo" "TipoEvento" NOT NULL,
    "estado_anterior" "EstadoEnvio",
    "estado_nuevo" "EstadoEnvio",
    "detalle" TEXT,
    "actor_tipo" "TipoActor" NOT NULL,
    "actor_id" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_envio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ofertas" (
    "id" SERIAL NOT NULL,
    "envio_id" INTEGER NOT NULL,
    "repartidor_id" INTEGER NOT NULL,
    "estado" "EstadoOferta" NOT NULL DEFAULT 'PENDIENTE',
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "respondida_en" TIMESTAMP(3),

    CONSTRAINT "ofertas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "repartidores_estado_vehiculo_en_cola_desde_idx" ON "repartidores"("estado", "vehiculo", "en_cola_desde");

-- CreateIndex
CREATE UNIQUE INDEX "envios_codigo_seguimiento_key" ON "envios"("codigo_seguimiento");

-- CreateIndex
CREATE INDEX "envios_estado_idx" ON "envios"("estado");

-- CreateIndex
CREATE INDEX "envios_comercio_id_idx" ON "envios"("comercio_id");

-- CreateIndex
CREATE INDEX "envios_repartidor_id_idx" ON "envios"("repartidor_id");

-- CreateIndex
CREATE INDEX "eventos_envio_envio_id_creado_en_idx" ON "eventos_envio"("envio_id", "creado_en");

-- CreateIndex
CREATE INDEX "ofertas_estado_expira_en_idx" ON "ofertas"("estado", "expira_en");

-- CreateIndex
CREATE INDEX "ofertas_repartidor_id_estado_idx" ON "ofertas"("repartidor_id", "estado");

-- CreateIndex
CREATE INDEX "ofertas_envio_id_idx" ON "ofertas"("envio_id");

-- AddForeignKey
ALTER TABLE "envios" ADD CONSTRAINT "envios_comercio_id_fkey" FOREIGN KEY ("comercio_id") REFERENCES "comercios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envios" ADD CONSTRAINT "envios_repartidor_id_fkey" FOREIGN KEY ("repartidor_id") REFERENCES "repartidores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_envio" ADD CONSTRAINT "eventos_envio_envio_id_fkey" FOREIGN KEY ("envio_id") REFERENCES "envios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_envio_id_fkey" FOREIGN KEY ("envio_id") REFERENCES "envios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_repartidor_id_fkey" FOREIGN KEY ("repartidor_id") REFERENCES "repartidores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
