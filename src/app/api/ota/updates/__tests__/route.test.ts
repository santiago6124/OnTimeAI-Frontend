import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/ota/updates/route";

const MANIFEST = {
  schema: 1,
  app_id: "com.ontimeai.app",
  channels: { production: "1.0.2", staging: "1.0.6", vacio: null, roto: "9.9.9" },
  bundles: {
    "1.0.1": { url: "https://cdn/ios/1.0.1.zip", checksum: "aaa" },
    "1.0.2": { url: "https://cdn/ios/1.0.2.zip", checksum: "bbb" },
    // Usa un plugin que recién trae el binario 1.0.5.
    "1.0.6": { url: "https://cdn/ios/1.0.6.zip", checksum: "ccc", min_native: "1.0.5" },
  },
};

/** Lo que manda el plugin nativo en cada chequeo, con valores típicos. */
function device(overrides: Record<string, unknown> = {}) {
  return {
    app_id: "com.ontimeai.app",
    platform: "ios",
    device_id: "e1850c65-0cc6-4628-9e58-5c111c1dc8db",
    version_build: "1.0.0",
    version_name: "1.0.0",
    plugin_version: "7.51.15",
    ...overrides,
  };
}

function request(body: unknown) {
  return new Request("http://localhost:3000/api/ota/updates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function stubManifest(manifest: unknown = MANIFEST, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(typeof manifest === "string" ? manifest : JSON.stringify(manifest), { status }),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/ota/updates", () => {
  it("ofrece el bundle del canal production con su url y checksum", async () => {
    stubManifest();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await POST(request(device()));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      version: "1.0.2",
      url: "https://cdn/ios/1.0.2.zip",
      checksum: "bbb",
    });
  });

  it("responde up_to_date cuando el dispositivo ya corre la versión del canal", async () => {
    stubManifest();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await POST(request(device({ version_name: "1.0.2" })));
    await expect(res.json()).resolves.toMatchObject({ kind: "up_to_date" });
  });

  it("vuelve a una versión anterior si el canal la apunta (rollback)", async () => {
    stubManifest({ ...MANIFEST, channels: { ...MANIFEST.channels, production: "1.0.1" } });
    vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await POST(request(device({ version_name: "1.0.2" })));
    await expect(res.json()).resolves.toMatchObject({ version: "1.0.1", checksum: "aaa" });
  });

  it("no baja por debajo de la versión nativa instalada", async () => {
    stubManifest();
    vi.spyOn(console, "log").mockImplementation(() => {});
    // Release nativa 1.1.0 recién instalada; el canal todavía dice 1.0.2.
    const res = await POST(request(device({ version_build: "1.1.0", version_name: "1.1.0" })));
    await expect(res.json()).resolves.toMatchObject({ kind: "up_to_date" });
  });

  it("respeta min_native: un binario viejo no recibe un bundle que necesita nativo nuevo", async () => {
    stubManifest();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const viejo = await POST(request(device({ defaultChannel: "staging" })));
    await expect(viejo.json()).resolves.toMatchObject({ kind: "up_to_date" });

    const nuevo = await POST(
      request(device({ defaultChannel: "staging", version_build: "1.0.5", version_name: "1.0.5" })),
    );
    await expect(nuevo.json()).resolves.toMatchObject({ version: "1.0.6" });
  });

  it("rutea por defaultChannel cuando el binario lo fija", async () => {
    stubManifest({
      ...MANIFEST,
      bundles: { ...MANIFEST.bundles, "1.0.6": { url: "https://cdn/ios/1.0.6.zip" } },
    });
    vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await POST(request(device({ defaultChannel: "staging" })));
    // Sin checksum en el manifest se manda vacío: el plugin lo trata como "no verificar".
    await expect(res.json()).resolves.toEqual({
      version: "1.0.6",
      url: "https://cdn/ios/1.0.6.zip",
      checksum: "",
    });
  });

  it("un canal sin bundle es up_to_date, no un error", async () => {
    stubManifest();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await POST(request(device({ defaultChannel: "vacio" })));
    await expect(res.json()).resolves.toMatchObject({ kind: "up_to_date" });
  });

  it("un canal que no existe bloquea en vez de caer a production", async () => {
    stubManifest();
    const res = await POST(request(device({ defaultChannel: "no-existe" })));
    await expect(res.json()).resolves.toMatchObject({ kind: "blocked", error: "unknown_channel" });
  });

  it("un canal que apunta a una versión sin bundle es una falla del manifest", async () => {
    stubManifest();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await POST(request(device({ defaultChannel: "roto" })));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ kind: "failed", error: "manifest_inconsistent" });
  });

  it("rechaza otra app y otra plataforma sin tocar el manifest", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const otraApp = await POST(request(device({ app_id: "com.otra.app" })));
    await expect(otraApp.json()).resolves.toMatchObject({ kind: "blocked", error: "app_mismatch" });
    const android = await POST(request(device({ platform: "android" })));
    await expect(android.json()).resolves.toMatchObject({ kind: "blocked", error: "platform_unsupported" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bloquea un binario cuya versión nativa no es semver", async () => {
    stubManifest();
    const res = await POST(request(device({ version_build: "1.0" })));
    await expect(res.json()).resolves.toMatchObject({ kind: "blocked", error: "native_version_invalid" });
  });

  it("responde failed con 503 si el manifest no se puede leer o no es válido", async () => {
    stubManifest("", 404);
    const caido = await POST(request(device()));
    expect(caido.status).toBe(503);
    await expect(caido.json()).resolves.toMatchObject({ kind: "failed", error: "manifest_unavailable" });

    stubManifest({ hola: "mundo" });
    const invalido = await POST(request(device()));
    expect(invalido.status).toBe(503);
  });

  it("rechaza un cuerpo que no es JSON", async () => {
    const res = await POST(request("no-json"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ kind: "blocked" });
  });
});
