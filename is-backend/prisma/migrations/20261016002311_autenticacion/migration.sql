-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('OPERARIO', 'REPARTIDOR');

-- AlterTable
ALTER TABLE "repartidores" ADD COLUMN     "pin_hmac" TEXT;

-- CreateTable
CREATE TABLE "operarios" (
    "id" SERIAL NOT NULL,
    "usuario" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" SERIAL NOT NULL,
    "token_hash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revocado_en" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operarios_usuario_key" ON "operarios"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_rol_usuario_id_idx" ON "refresh_tokens"("rol", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "repartidores_pin_hmac_key" ON "repartidores"("pin_hmac");

