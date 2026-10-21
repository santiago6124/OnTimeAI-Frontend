"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Recuerda qué secciones quedaron expandidas, por dispositivo.
 *
 * Va en `localStorage` y no en las preferencias del backend a propósito. Es
 * estado de interfaz, no del usuario: se quiere la vista densa en el teléfono
 * y la expandida en la notebook, y guardarlo en el servidor forzaría la misma
 * densidad en los dos. Además evita una ida y vuelta en cada clic.
 *
 * Se lee con `useSyncExternalStore` y no con un efecto porque el servidor
 * dibuja el valor por defecto y el cliente el guardado: sin esto hay desajuste
 * de hidratación, y resolverlo con `setState` dentro de un efecto es
 * exactamente lo que el lint rechaza con `set-state-in-effect`.
 */
const CLAVE = "ontimeai-secciones";

type Estado = Record<string, boolean>;

let memoria: Estado | null = null;
const oyentes = new Set<() => void>();

export function leerEstado(): Estado {
  if (memoria) return memoria;
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    memoria = crudo ? (JSON.parse(crudo) as Estado) : {};
  } catch {
    // Ventana privada, almacenamiento bloqueado o JSON roto. Se sigue con los
    // valores por defecto: recordar la densidad no vale romper la pantalla.
    memoria = {};
  }
  return memoria;
}

export function guardarEstado(estado: Estado) {
  memoria = estado;
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(estado));
  } catch {
    // Ídem: el estado sigue vivo en memoria durante la sesión.
  }
  for (const avisar of oyentes) avisar();
}

export function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  return () => {
    oyentes.delete(avisar);
  };
}

/**
 * Estado de apertura de una sección, recordado entre visitas.
 *
 * `clave` identifica la sección y tiene que ser estable: si cambia, el usuario
 * pierde lo que había elegido.
 */
export function useSeccionAbierta(clave: string, porDefecto = false) {
  const abierto = useSyncExternalStore(
    suscribir,
    // El snapshot devuelve un booleano, que se compara por valor: no hay
    // bucle de renders como pasaría devolviendo un objeto nuevo cada vez.
    () => leerEstado()[clave] ?? porDefecto,
    // En el servidor no hay almacenamiento: se dibuja el valor por defecto y
    // React reconcilia después de hidratar.
    () => porDefecto,
  );

  const alternar = useCallback(() => {
    const estado = leerEstado();
    guardarEstado({ ...estado, [clave]: !(estado[clave] ?? porDefecto) });
  }, [clave, porDefecto]);

  return { abierto, alternar };
}


/** Vacía la memoria del módulo. Sólo para los tests: sin esto, el primer test
 *  que lee deja la caché puesta y los siguientes no ven el almacenamiento. */
export function _olvidarCache() {
  memoria = null;
}
