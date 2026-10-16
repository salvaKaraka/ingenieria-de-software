import { ConfigService } from '@nestjs/config';
import { HashingService } from './hashing.service';

function crearServicio(clave = 'clave-de-prueba') {
  const configFalsa = { getOrThrow: () => clave };
  return new HashingService(configFalsa as unknown as ConfigService);
}

describe('HashingService', () => {
  const servicio = crearServicio();

  it('verifica la contraseña correcta y rechaza otra', async () => {
    const hash = await servicio.hashearPassword('secreta123');
    await expect(servicio.verificarPassword(hash, 'secreta123')).resolves.toBe(
      true,
    );
    await expect(servicio.verificarPassword(hash, 'otra')).resolves.toBe(false);
  });

  it('hashear dos veces la misma contraseña da resultados distintos (sal)', async () => {
    const hash1 = await servicio.hashearPassword('secreta123');
    const hash2 = await servicio.hashearPassword('secreta123');
    expect(hash1).not.toBe(hash2);
  });

  it('el HMAC de un PIN es siempre el mismo, y distinto para otro PIN', () => {
    expect(servicio.hmacPin('4821')).toBe(servicio.hmacPin('4821'));
    expect(servicio.hmacPin('4821')).not.toBe(servicio.hmacPin('4822'));
  });

  it('con otra clave, el mismo PIN da otro HMAC', () => {
    const otroServicio = crearServicio('otra-clave');
    expect(otroServicio.hmacPin('4821')).not.toBe(servicio.hmacPin('4821'));
  });

  it('genera PINs de 4 dígitos', () => {
    for (let i = 0; i < 50; i++) {
      expect(servicio.generarPin()).toMatch(/^\d{4}$/);
    }
  });

  it('genera tokens de 64 caracteres y distintos entre sí', () => {
    const token1 = servicio.generarTokenAleatorio();
    const token2 = servicio.generarTokenAleatorio();
    expect(token1).toHaveLength(64);
    expect(token1).not.toBe(token2);
  });

  it('el hash de un token es determinístico', () => {
    expect(servicio.hashearToken('abc')).toBe(servicio.hashearToken('abc'));
  });
});
