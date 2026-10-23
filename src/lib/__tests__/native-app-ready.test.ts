/**
 * CP-COB-FE-18 — `src/lib/native/app-ready.ts`: las dos señales del arranque
 * nativo. Cada una corre una sola vez por arranque, es no-op fuera del
 * nativo, y una falla del plugin no puede impedir que la app arranque.
 *
 * Capacitor, el plugin de OTA y el splash se simulan; el módulo guarda estado,
 * así que cada caso lo importa fresco.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const nativo = vi.hoisted(() => ({
  esNativo: false,
  notifyAppReady: vi.fn(async () => undefined),
  hide: vi.fn(async () => undefined),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => nativo.esNativo },
}));
vi.mock("@capgo/capacitor-updater", () => ({
  CapacitorUpdater: { notifyAppReady: () => nativo.notifyAppReady() },
}));
vi.mock("@capacitor/splash-screen", () => ({
  SplashScreen: { hide: () => nativo.hide() },
}));

async function appReady() {
  vi.resetModules();
  return import("@/lib/native/app-ready");
}

beforeEach(() => {
  nativo.esNativo = false;
  nativo.notifyAppReady.mockReset().mockResolvedValue(undefined);
  nativo.hide.mockReset().mockResolvedValue(undefined);
});

describe("notifyAppReady", () => {
  it("fuera del nativo no toca el plugin de OTA", async () => {
    const { notifyAppReady } = await appReady();

    await notifyAppReady();

    expect(nativo.notifyAppReady).not.toHaveBeenCalled();
  });

  it("en el nativo avisa una sola vez aunque se llame dos veces", async () => {
    // Arrange
    nativo.esNativo = true;
    const { notifyAppReady } = await appReady();

    // Act
    await notifyAppReady();
    await notifyAppReady();

    // Assert
    expect(nativo.notifyAppReady).toHaveBeenCalledTimes(1);
  });

  it("si el plugin falla, la app arranca igual", async () => {
    nativo.esNativo = true;
    nativo.notifyAppReady.mockRejectedValue(new Error("sin OTA configurado"));
    const { notifyAppReady } = await appReady();

    await expect(notifyAppReady()).resolves.toBeUndefined();
  });
});

describe("hideSplash", () => {
  it("fuera del nativo no hay splash que bajar", async () => {
    const { hideSplash } = await appReady();

    await hideSplash();

    expect(nativo.hide).not.toHaveBeenCalled();
  });

  it("en el nativo baja el splash una sola vez", async () => {
    nativo.esNativo = true;
    const { hideSplash } = await appReady();

    await hideSplash();
    await hideSplash();

    expect(nativo.hide).toHaveBeenCalledTimes(1);
  });

  it("si el plugin falla, no propaga: launchAutoHide lo baja igual", async () => {
    nativo.esNativo = true;
    nativo.hide.mockRejectedValue(new Error("boom"));
    const { hideSplash } = await appReady();

    await expect(hideSplash()).resolves.toBeUndefined();
  });
});
