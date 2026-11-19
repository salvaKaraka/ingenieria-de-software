import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TipoVehiculo } from '../../generated/prisma/client';

export interface Coordenadas {
  lat: number;
  lon: number;
}

export interface LugarEncontrado extends Coordenadas {
  // false = el mapa no encontró la altura y el punto es el de la calle (puede estar lejos).
  exacta: boolean;
}

// Una punta del viaje: la dirección escrita y, si ya se conoce, su punto en el mapa.
export interface PuntaDelViaje {
  direccion: string;
  coordenadas: Coordenadas | null;
}

// Nominatim (OpenStreetMap) convierte direcciones en coordenadas. Es gratis y sin key;
// se probó contra OpenRouteService y Georef, y es el que mejor ubica las calles de La Plata.
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
// La política de Nominatim pide identificar la aplicación en el User-Agent.
const USER_AGENT = 'is-backend (TP Ingenieria de Software)';
// Zona de reparto: La Plata, Berisso y Ensenada. Sin este límite, "Calle 50 567"
// puede caer en cualquier ciudad del país con una calle 50.
const ZONA_DE_REPARTO = '-58.25,-34.75,-57.75,-35.10'; // lon,lat de dos esquinas

// OpenRouteService calcula la ruta y cuánto se tarda. Gratis con key (ORS_API_KEY).
const ORS_URL = 'https://api.openrouteservice.org/v2/directions';
// ORS no tiene perfil de moto: la moto se calcula como auto. El camión tiene el suyo (más lento).
const PERFIL_ORS: Record<TipoVehiculo, string> = {
  MOTO: 'driving-car',
  AUTO: 'driving-car',
  CAMION: 'driving-hgv',
};

// Si un servicio externo tarda más que esto, se usa el plan B: nada puede colgarse por el mapa.
const TIMEOUT_MS = 3000;
// Tope de la caché para que no crezca sin límite si el servidor queda prendido meses.
const MAXIMO_EN_CACHE = 1000;

@Injectable()
export class MapasService {
  private readonly logger = new Logger(MapasService.name);
  // Las direcciones de los comercios se repiten mucho: se guardan para no volver a
  // preguntarle a Nominatim (su política pide cachear los resultados).
  private readonly cacheDirecciones = new Map<string, LugarEncontrado | null>();
  // Nominatim permite como máximo 1 consulta por segundo: cada consulta reserva su turno.
  // Es un atributo y no una constante para que los tests lo puedan poner en 0.
  protected intervaloNominatimMs = 1000;
  private proximoTurnoNominatim = 0;

  constructor(private readonly config: ConfigService) {}

  /**
   * Busca una dirección en el mapa (selector del operario). Devuelve null si no existe en
   * la zona de reparto; lanza error si el servicio no responde.
   */
  async buscar(direccion: string): Promise<LugarEncontrado | null> {
    const clave = direccion.trim().toLowerCase();
    const enCache = this.cacheDirecciones.get(clave);
    if (enCache !== undefined) return enCache;

    await this.esperarTurnoNominatim();
    const url = new URL(NOMINATIM_URL);
    url.search = new URLSearchParams({
      q: direccion,
      format: 'jsonv2',
      addressdetails: '1',
      countrycodes: 'ar',
      viewbox: ZONA_DE_REPARTO,
      bounded: '1',
      limit: '1',
    }).toString();
    const respuesta = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!respuesta.ok)
      throw new Error(`Nominatim respondió ${respuesta.status}`);

    const [lugar] = (await respuesta.json()) as {
      lat: string;
      lon: string;
      address?: { house_number?: string };
    }[];
    const encontrado = lugar
      ? {
          lat: Number(lugar.lat),
          lon: Number(lugar.lon),
          exacta: lugar.address?.house_number !== undefined,
        }
      : null;
    if (this.cacheDirecciones.size >= MAXIMO_EN_CACHE)
      this.cacheDirecciones.clear();
    this.cacheDirecciones.set(clave, encontrado);
    return encontrado;
  }

  /**
   * Minutos que tarda en llegar de `origen` a `destino` con ese vehículo, según el mapa.
   * Usa el punto que marcó el operario; si no hay, busca la dirección. Devuelve null si no
   * se pudo calcular (sin key, dirección no encontrada, API caída): quien llama decide el plan B.
   */
  async duracionDelViajeMin(
    origen: PuntaDelViaje,
    destino: PuntaDelViaje,
    vehiculo: TipoVehiculo,
  ): Promise<number | null> {
    const apiKey = this.config.get<string>('ORS_API_KEY');
    if (!apiKey) return null;

    try {
      const desde = await this.ubicar(origen);
      const hasta = desde && (await this.ubicar(destino));
      if (!desde || !hasta) return null;

      const segundos = await this.duracionDeRuta(
        desde,
        hasta,
        vehiculo,
        apiKey,
      );
      return segundos === null ? null : Math.ceil(segundos / 60);
    } catch (error) {
      this.logger.warn(`No se pudo calcular la ruta: ${String(error)}`);
      return null;
    }
  }

  private async ubicar(punta: PuntaDelViaje): Promise<Coordenadas | null> {
    if (punta.coordenadas) return punta.coordenadas;
    const lugar = await this.buscar(punta.direccion);
    // Sin altura, el punto es el medio de la calle, que puede estar a kilómetros: mejor no estimar.
    return lugar?.exacta ? lugar : null;
  }

  private async esperarTurnoNominatim() {
    const ahora = Date.now();
    const turno = Math.max(ahora, this.proximoTurnoNominatim);
    this.proximoTurnoNominatim = turno + this.intervaloNominatimMs;
    if (turno > ahora)
      await new Promise((resolver) => setTimeout(resolver, turno - ahora));
  }

  private async duracionDeRuta(
    desde: Coordenadas,
    hasta: Coordenadas,
    vehiculo: TipoVehiculo,
    apiKey: string,
  ): Promise<number | null> {
    const respuesta = await fetch(`${ORS_URL}/${PERFIL_ORS[vehiculo]}`, {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      // ORS pide [lon, lat], al revés de como se suele escribir.
      body: JSON.stringify({
        coordinates: [
          [desde.lon, desde.lat],
          [hasta.lon, hasta.lat],
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!respuesta.ok) throw new Error(`ORS respondió ${respuesta.status}`);

    const datos = (await respuesta.json()) as {
      routes?: { summary?: { duration?: number } }[];
    };
    return datos.routes?.[0]?.summary?.duration ?? null;
  }
}
