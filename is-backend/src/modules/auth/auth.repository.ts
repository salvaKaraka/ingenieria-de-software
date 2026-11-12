import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { Prisma, RolUsuario } from '../../generated/prisma/client';

// Acceso a datos de autenticación. Sin reglas de negocio: solo leer y escribir.
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  buscarOperarioPorUsuario(usuario: string) {
    return this.prisma.operario.findUnique({ where: { usuario } });
  }

  buscarOperarioPorId(id: number) {
    return this.prisma.operario.findUnique({ where: { id } });
  }

  crearOperario(datos: {
    usuario: string;
    passwordHash: string;
    nombre: string;
  }) {
    return this.prisma.operario.create({ data: datos });
  }

  buscarRepartidorPorPinHmac(pinHmac: string) {
    return this.prisma.repartidor.findUnique({ where: { pinHmac } });
  }

  buscarRepartidorPorId(id: number) {
    return this.prisma.repartidor.findUnique({ where: { id } });
  }

  async existePinHmac(pinHmac: string): Promise<boolean> {
    const repartidor = await this.prisma.repartidor.findUnique({
      where: { pinHmac },
      select: { id: true },
    });
    return repartidor !== null;
  }

  guardarPinHmac(repartidorId: number, pinHmac: string) {
    return this.prisma.repartidor.update({
      where: { id: repartidorId },
      data: { pinHmac },
    });
  }

  crearRefreshToken(
    datos: Prisma.RefreshTokenUncheckedCreateInput,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    return tx.refreshToken.create({ data: datos });
  }

  buscarRefreshTokenPorHash(tokenHash: string) {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  revocarRefreshToken(id: number, tx: Prisma.TransactionClient = this.prisma) {
    return tx.refreshToken.update({
      where: { id },
      data: { revocadoEn: new Date() },
    });
  }

  // Cierra todas las sesiones abiertas de un usuario (baja, fin de jornada, token robado).
  revocarTodos(rol: RolUsuario, usuarioId: number) {
    return this.prisma.refreshToken.updateMany({
      where: { rol, usuarioId, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
  }

  // Rotación atómica: o se revoca el viejo Y se crea el nuevo, o no pasa nada.
  rotarRefreshToken(
    idViejo: number,
    nuevo: Prisma.RefreshTokenUncheckedCreateInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.revocarRefreshToken(idViejo, tx);
      return this.crearRefreshToken(nuevo, tx);
    });
  }
}
