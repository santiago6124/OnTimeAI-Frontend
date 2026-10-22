import { api, type Flight } from "@/lib/api";
import { HomeViajeroView } from "@/components/viajero/home-viajero-view";
import { proximasSalidas } from "@/components/viajero/proximos-vuelos";

/**
 * Trae los vuelos y resuelve cuáles son los próximos.
 *
 * El reloj se lee acá y no en el componente: `Date.now()` dentro del render
 * hace que el mismo árbol devuelva cosas distintas sin que cambien sus props,
 * y React lo rechaza con razón. Esta función no es un componente.
 */
async function cargar(): Promise<{ vuelos: Flight[]; proximos: Flight[] }> {
  let vuelos: Flight[] = [];
  try {
    vuelos = await api.flights();
  } catch {
    vuelos = [];
  }
  return { vuelos, proximos: proximasSalidas(vuelos, Date.now()) };
}

/**
 * La home del perfil viajero en la web: trae los vuelos en el servidor durante
 * el render y delega el dibujo en `HomeViajeroView`.
 *
 * El bundle de iOS reemplaza este archivo por
 * `mobile/components/home-viajero.tsx`, que pide lo mismo al montar: en un
 * export estático este render corre una sola vez, en build time, y congelaría
 * la lista de vuelos de ese momento.
 */
export async function HomeViajero() {
  const { vuelos, proximos } = await cargar();
  return <HomeViajeroView vuelos={vuelos} proximos={proximos} />;
}
