/**
 * Recordar qué secciones quedaron expandidas.
 *
 * Lo que importa probar no es que guarde —eso es una línea— sino que no rompa
 * la pantalla cuando el almacenamiento no está disponible. `localStorage`
 * puede faltar, lanzar, o devolver basura: en ventana privada, con las cookies
 * bloqueadas, o si alguien editó la clave a mano. Recordar la densidad de una
 * tarjeta no vale una pantalla en blanco.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  _olvidarCache,
  guardarEstado,
  leerEstado,
  suscribir,
} from "@/lib/secciones-abiertas";

function montarAlmacenamiento(impl: Partial<Storage> = {}) {
  const datos = new Map<string, string>();
  const base: Storage = {
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => void datos.set(k, v),
    removeItem: (k) => void datos.delete(k),
    clear: () => datos.clear(),
    key: () => null,
    length: 0,
  };
  // @ts-expect-error el entorno de test no trae window
  globalThis.window = { localStorage: { ...base, ...impl } };
  return datos;
}

beforeEach(() => {
  _olvidarCache();
  montarAlmacenamiento();
});

describe("leerEstado", () => {
  it("sin nada guardado devuelve vacío", () => {
    expect(leerEstado()).toEqual({});
  });

  it("devuelve lo guardado", () => {
    guardarEstado({ "efecto-cascada": true });
    _olvidarCache();
    expect(leerEstado()["efecto-cascada"]).toBe(true);
  });

  it("con JSON roto no lanza y arranca de cero", () => {
    const datos = montarAlmacenamiento();
    datos.set("ontimeai-secciones", "{esto no es json");
    _olvidarCache();
    expect(() => leerEstado()).not.toThrow();
    expect(leerEstado()).toEqual({});
  });

  it("si el almacenamiento lanza al leer, no rompe", () => {
    montarAlmacenamiento({
      getItem: () => {
        throw new Error("bloqueado");
      },
    });
    _olvidarCache();
    expect(() => leerEstado()).not.toThrow();
    expect(leerEstado()).toEqual({});
  });
});

describe("guardarEstado", () => {
  it("si el almacenamiento lanza al escribir, el estado igual vale en memoria", () => {
    montarAlmacenamiento({
      setItem: () => {
        throw new Error("cuota llena");
      },
    });
    _olvidarCache();
    expect(() => guardarEstado({ cascada: true })).not.toThrow();
    // No se persistió, pero la sesión en curso tiene que seguir recordando.
    expect(leerEstado()["cascada"]).toBe(true);
  });

  it("las claves son independientes", () => {
    guardarEstado({ a: true });
    guardarEstado({ ...leerEstado(), b: false });
    expect(leerEstado()).toEqual({ a: true, b: false });
  });

  it("avisa a quien esté suscrito", () => {
    // El hook se apoya en esto: sin la notificación, alternar una sección no
    // vuelve a dibujar las otras instancias de la pantalla.
    const espia = vi.fn();
    const desuscribir = suscribir(espia);
    guardarEstado({ x: true });
    expect(espia).toHaveBeenCalledTimes(1);
    desuscribir();
    guardarEstado({ x: false });
    expect(espia).toHaveBeenCalledTimes(1);
  });
});
