import type { PrismaService } from '../src/database/prisma.service';

// Deja la base de test vacía. Solo funciona contra una base *_test, para no borrar datos reales por error.
export async function vaciarBase(prisma: PrismaService) {
  const [{ base }] = await prisma.$queryRaw<
    { base: string }[]
  >`SELECT current_database() AS base`;
  if (!base.endsWith('_test'))
    throw new Error(
      `vaciarBase se negó a vaciar "${base}": no es una base de test`,
    );

  await prisma.$executeRaw`TRUNCATE ofertas, eventos_envio, envios, repartidores, comercios, refresh_tokens, operarios RESTART IDENTITY CASCADE`;
}
