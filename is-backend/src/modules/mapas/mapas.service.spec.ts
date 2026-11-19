import type { ConfigService } from '@nestjs/config';
import { MapasService } from './mapas.service';

// Respuestas falsas de Nominatim y ORS: los tests no salen a internet.
const lugar = (lat: number, lon: number, conAltura = true) => [
  {
    lat: String(lat),
    lon: String(lon),
    address: conAltura ? { house_number: '123' } : {},
  },
];
const ruta = (segundos: number) => ({
  routes: [{ summary: { duration: segundos } }],
});
const respuesta = (cuerpo: unknown, ok = true) =>
  Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(cuerpo),
  });

describe('MapasService', () => {
  let fetchFalso: jest.Mock;
  const fetchOriginal = global.fetch;

  const crearServicio = (apiKey?: string) => {
    const servicio = new MapasService({
      get: () => apiKey,
    } as unknown as ConfigService);
    // Sin la espera de 1 segundo entre consultas a Nominatim: el test no sale a internet.
    Object.assign(servicio, { intervaloNominatimMs: 0 });
    return servicio;
  };
  // Una punta del viaje sin punto marcado: hay que buscar la dirección.
  const sinPunto = (direccion: string) => ({ direccion, coordenadas: null });

  beforeEach(() => {
    fetchFalso = jest.fn((url: URL | string) =>
      String(url).includes('nominatim')
        ? respuesta(lugar(-34.91, -57.95))
        : respuesta(ruta(1500)),
    );
    global.fetch = fetchFalso as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = fetchOriginal;
  });

  it('devuelve los minutos de la ruta entre las dos direcciones', async () => {
    const minutos = await crearServicio('key').duracionDelViajeMin(
      sinPunto('Calle 50 567'),
      sinPunto('Avenida 7 1234'),
      'MOTO',
    );

    // 1500 segundos = 25 minutos
    expect(minutos).toBe(25);
    expect(fetchFalso).toHaveBeenCalledTimes(3);
  });

  it('usa el perfil de camión y manda las coordenadas como [lon, lat]', async () => {
    await crearServicio('key').duracionDelViajeMin(
      sinPunto('A 1'),
      sinPunto('B 2'),
      'CAMION',
    );

    const [url, opciones] = fetchFalso.mock.calls[2] as [string, RequestInit];
    expect(url).toMatch(/driving-hgv$/);
    expect(JSON.parse(opciones.body as string).coordinates[0]).toEqual([
      -57.95, -34.91,
    ]);
  });

  it('redondea para arriba los minutos', async () => {
    fetchFalso.mockImplementation((url: URL | string) =>
      String(url).includes('nominatim')
        ? respuesta(lugar(-34.91, -57.95))
        : respuesta(ruta(61)),
    );

    expect(
      await crearServicio('key').duracionDelViajeMin(
        sinPunto('A 1'),
        sinPunto('B 2'),
        'AUTO',
      ),
    ).toBe(2);
  });

  it('sin API key no consulta nada y devuelve null', async () => {
    const minutos = await crearServicio(undefined).duracionDelViajeMin(
      sinPunto('A 1'),
      sinPunto('B 2'),
      'MOTO',
    );

    expect(minutos).toBeNull();
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('devuelve null si la API falla o no responde a tiempo', async () => {
    fetchFalso.mockImplementation(() =>
      Promise.reject(new Error('The operation was aborted due to timeout')),
    );

    expect(
      await crearServicio('key').duracionDelViajeMin(
        sinPunto('A 1'),
        sinPunto('B 2'),
        'MOTO',
      ),
    ).toBeNull();
  });

  it('devuelve null si ORS responde con error', async () => {
    fetchFalso.mockImplementation((url: URL | string) =>
      String(url).includes('nominatim')
        ? respuesta(lugar(-34.91, -57.95))
        : respuesta({}, false),
    );

    expect(
      await crearServicio('key').duracionDelViajeMin(
        sinPunto('A 1'),
        sinPunto('B 2'),
        'MOTO',
      ),
    ).toBeNull();
  });

  it('no vuelve a buscar una dirección que ya ubicó', async () => {
    const servicio = crearServicio('key');
    await servicio.duracionDelViajeMin(
      sinPunto('Comercio 100'),
      sinPunto('Cliente 1'),
      'MOTO',
    );
    await servicio.duracionDelViajeMin(
      sinPunto('Comercio 100'),
      sinPunto('Cliente 2'),
      'MOTO',
    );

    const busquedas = fetchFalso.mock.calls.filter(([url]) =>
      String(url).includes('nominatim'),
    );
    // Comercio 100 una sola vez + los dos clientes
    expect(busquedas).toHaveLength(3);
  });

  it('usa el punto marcado por el operario sin buscar la dirección', async () => {
    const minutos = await crearServicio('key').duracionDelViajeMin(
      { direccion: 'A 1', coordenadas: { lat: -34.9, lon: -57.9 } },
      { direccion: 'B 2', coordenadas: { lat: -34.92, lon: -57.95 } },
      'MOTO',
    );

    expect(minutos).toBe(25);
    // Solo la consulta de la ruta.
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('no estima con un punto aproximado (sin altura)', async () => {
    fetchFalso.mockImplementation(() =>
      respuesta(lugar(-34.91, -57.95, false)),
    );

    const servicio = crearServicio('key');
    expect(
      await servicio.duracionDelViajeMin(
        sinPunto('Calle 7'),
        sinPunto('B 2'),
        'MOTO',
      ),
    ).toBeNull();
    // Pero el selector del operario sí lo muestra, avisando que es aproximado.
    expect(await servicio.buscar('Calle 7')).toEqual({
      lat: -34.91,
      lon: -57.95,
      exacta: false,
    });
  });

  it('buscar devuelve null si la dirección no está en la zona de reparto', async () => {
    fetchFalso.mockImplementation(() => respuesta([]));

    expect(await crearServicio().buscar('Calle Inventada 99')).toBeNull();
  });
});
