import { IS_BUNDLED } from "@/lib/mobile-env";

/**
 * Enlace al detalle de un vuelo.
 *
 * En la web es `/flights/<id>`, el mismo string que estaba escrito a mano en
 * los cuatro lugares que enlazan al detalle.
 *
 * En el bundle nativo no puede serlo: `output: 'export'` exige que todo
 * segmento `[id]` esté resuelto en build time con `generateStaticParams`, y los
 * `fa_flight_id` son datos vivos que no existen cuando compilamos. La ruta se
 * mueve a una fija y el id viaja como query param — `scripts/build-mobile.mjs`
 * renombra el directorio y esta función emite el enlace que le corresponde.
 *
 * Que las dos formas salgan de acá es lo que evita el defecto clásico de esta
 * migración: un enlace que quedó con la forma vieja y en el teléfono lleva a
 * una ruta que no existe en el bundle.
 */
export function flightDetailHref(faFlightId: string): string {
  const id = encodeURIComponent(faFlightId);
  return IS_BUNDLED ? `/flights/detail/?id=${id}` : `/flights/${id}`;
}
