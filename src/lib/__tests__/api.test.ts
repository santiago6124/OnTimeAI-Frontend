/**
 * CP-COB-FE-01 — Cliente HTTP `src/lib/api.ts` en la web (sin bundle nativo).
 *
 * Cubre lo que el cliente promete y no se ve leyendo las llamadas:
 *
 *  - `get()`: contra qué base pega en el servidor y en el navegador, el
 *    `Authorization` que arma desde la cookie HttpOnly, la fusión de cabeceras
 *    y `signal` propios, el 401 (en el navegador manda a /login; en el
 *    servidor sólo lanza), los errores con `detail`, con `error` y sin JSON,
 *    y el 204 sin cuerpo.
 *  - El objeto `api`: cada método arma la ruta, la query y el cuerpo que el
 *    backend espera, con los ids escapados.
 *  - `flightHistory` normaliza puntos viejos del backend que no traen todos
 *    los campos.
 *  - `apiMe`, `apiLogin`, `apiLoginFirebase`,
 *    `apiSetUserType`, `apiDeleteAccount` y `apiLogout` contra el BFF.
 *  - Los helpers puros `riskLabel`, `fmtProba` y `toUTCDate`.
 *
 * El backend es un `fetch` falso (`vi.stubGlobal`) que registra a dónde y con
 * qué `init` se llamó; `next/headers` se simula para controlar la cookie.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const BACKEND = "https://backend.test";
vi.stubEnv("BACKEND_API_URL", BACKEND);

const cookie: { token: string | null } = { token: null };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nombre: string) =>
      nombre === "auth-token" && cookie.token ? { value: cookie.token } : undefined,
  }),
}));

type Llamada = { url: string; init: RequestInit };
type Respuesta = { status: number; body?: unknown; texto?: string };

const llamadas: Llamada[] = [];

function responder({ status, body, texto }: Respuesta): Response {
  if (texto !== undefined) return new Response(texto, { status });
  if (body === undefined) return new Response(null, { status });
  return new Response(JSON.stringify(body), { status });
}

/** Un backend falso: la primera ruta cuyo texto aparezca en la URL responde. */
function backend(rutas: Record<string, Respuesta>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init: RequestInit = {}) => {
      const href = String(url);
      llamadas.push({ url: href, init });
      const ruta = Object.keys(rutas).find((r) => href.includes(r));
      return ruta ? responder(rutas[ruta]) : new Response("{}", { status: 404 });
    }),
  );
}

function header(llamada: Llamada, nombre: string) {
  return (llamada.init.headers as Record<string, string> | undefined)?.[nombre];
}

function cuerpo(llamada: Llamada) {
  return JSON.parse(String(llamada.init.body));
}

/** Simula el navegador: `get()` distingue cliente de servidor por `window`. */
function navegador(pathname = "/") {
  const replace = vi.fn();
  vi.stubGlobal("window", { location: { pathname, replace } });
  return { replace };
}

beforeEach(() => {
  cookie.token = null;
  llamadas.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("get(): base y cabeceras", () => {
  it("en el servidor pega contra BACKEND_API_URL con el Bearer de la cookie", async () => {
    // Arrange: hay cookie de sesión y no hay `window`.
    cookie.token = "jwt-servidor";
    backend({ "/metrics/summary": { status: 200, body: { total: 1 } } });
    const { api } = await import("@/lib/api");

    // Act
    const resumen = await api.summary();

    // Assert: URL absoluta, token traducido a header, sin caché.
    expect(resumen).toEqual({ total: 1 });
    expect(llamadas[0].url).toBe(`${BACKEND}/metrics/summary`);
    expect(header(llamadas[0], "Authorization")).toBe("Bearer jwt-servidor");
    expect(llamadas[0].init.cache).toBe("no-store");
    expect(llamadas[0].init.signal).toBeInstanceOf(AbortSignal);
  });

  it("sin cookie no manda Authorization", async () => {
    backend({ "/metrics/summary": { status: 200, body: {} } });
    const { api } = await import("@/lib/api");

    await api.summary();

    expect(header(llamadas[0], "Authorization")).toBeUndefined();
  });

  it("en el navegador pasa por el BFF same-origin y deja que la cookie viaje sola", async () => {
    navegador();
    backend({ "/metrics/summary": { status: 200, body: {} } });
    const { api, BASE_URL } = await import("@/lib/api");

    await api.summary();

    expect(BASE_URL).toBe("/api/backend");
    expect(llamadas[0].url).toBe("/api/backend/metrics/summary");
    expect(header(llamadas[0], "Authorization")).toBeUndefined();
  });

  it("respeta las cabeceras y el signal que le pasan", async () => {
    cookie.token = "jwt";
    backend({ "/x": { status: 200, body: {} } });
    const { api } = await import("@/lib/api");
    const control = new AbortController();

    await api.request("/x", { headers: { "X-Prueba": "1" }, signal: control.signal });

    expect(header(llamadas[0], "X-Prueba")).toBe("1");
    expect(header(llamadas[0], "Authorization")).toBe("Bearer jwt");
    expect(llamadas[0].init.signal).toBe(control.signal);
  });
});

describe("get(): errores", () => {
  it("un 401 en el servidor lanza ApiError sin intentar redirigir", async () => {
    backend({ "/metrics/summary": { status: 401, body: { detail: "expired" } } });
    const { api, ApiError } = await import("@/lib/api");

    const promesa = api.summary();

    await expect(promesa).rejects.toBeInstanceOf(ApiError);
    await expect(api.summary()).rejects.toMatchObject({
      status: 401,
      message: "La sesión venció. Volvé a ingresar.",
    });
  });

  it("un 401 en el navegador manda a /login y lanza", async () => {
    const { replace } = navegador("/flights/abc");
    backend({ "/flights": { status: 401, body: {} } });
    const { api } = await import("@/lib/api");

    await expect(api.flights()).rejects.toMatchObject({ status: 401 });

    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("un 401 estando ya en /login no vuelve a redirigir", async () => {
    const { replace } = navegador("/login");
    backend({ "/auth/me": { status: 401, body: {} } });
    const { apiMe } = await import("@/lib/api");

    await expect(apiMe()).rejects.toMatchObject({ status: 401 });

    expect(replace).not.toHaveBeenCalled();
  });

  it("propaga el detail del backend con su código", async () => {
    backend({ "/metrics/summary": { status: 500, body: { detail: "Base caída" } } });
    const { api } = await import("@/lib/api");

    await expect(api.summary()).rejects.toMatchObject({ status: 500, message: "Base caída" });
  });

  it("usa `error` cuando el backend no manda `detail`", async () => {
    backend({ "/metrics/summary": { status: 503, body: { error: "Upstream" } } });
    const { api } = await import("@/lib/api");

    await expect(api.summary()).rejects.toMatchObject({ status: 503, message: "Upstream" });
  });

  it("sin JSON arma un mensaje con la ruta y el código", async () => {
    backend({ "/metrics/summary": { status: 502, texto: "<html>Bad Gateway</html>" } });
    const { api } = await import("@/lib/api");

    await expect(api.summary()).rejects.toMatchObject({
      status: 502,
      message: "API /metrics/summary → 502",
    });
  });

  it("un 204 resuelve undefined sin intentar leer el cuerpo", async () => {
    backend({ "/admin/users/": { status: 204 } });
    const { api } = await import("@/lib/api");

    await expect(api.deleteUser("ana lópez")).resolves.toBeUndefined();

    expect(llamadas[0].url).toBe(`${BACKEND}/admin/users/ana%20l%C3%B3pez`);
    expect(llamadas[0].init.method).toBe("DELETE");
  });
});

describe("api: rutas y query strings", () => {
  it.each([
    ["flights sin filtros", (a: Api) => a.flights(), "/flights"],
    ["flights por estado", (a: Api) => a.flights("active"), "/flights?status=active"],
    ["flights por ventana", (a: Api) => a.flights(undefined, 90), "/flights?departures_within_min=90"],
    ["flights con ambos (0 cuenta)", (a: Api) => a.flights("active", 0), "/flights?status=active&departures_within_min=0"],
    ["flight escapa el id", (a: Api) => a.flight("SYN-DL100/ATL"), "/flights/SYN-DL100%2FATL"],
    ["weather", (a: Api) => a.weather("ATL"), "/weather/ATL"],
    ["routes", (a: Api) => a.routes(), "/metrics/routes"],
    ["routeHistory", (a: Api) => a.routeHistory("ATL", "MIA"), "/metrics/routes/ATL/MIA/history"],
    ["hourly", (a: Api) => a.hourly(), "/metrics/hourly"],
    ["model", (a: Api) => a.model(), "/metrics/model"],
    ["modelHistory por defecto", (a: Api) => a.modelHistory(), "/metrics/history?days=56&segment=all"],
    ["modelHistory escapa el segmento", (a: Api) => a.modelHistory(7, "DL/ATL"), "/metrics/history?days=7&segment=DL%2FATL"],
    ["modelBreakdown por defecto", (a: Api) => a.modelBreakdown("carrier"), "/metrics/breakdown?by=carrier&days=28"],
    ["modelBreakdown con días", (a: Api) => a.modelBreakdown("hour", 7), "/metrics/breakdown?by=hour&days=7"],
    ["testCases", (a: Api) => a.testCases(), "/test-cases"],
    ["listUsers", (a: Api) => a.listUsers(), "/admin/users"],
    ["dbStats", (a: Api) => a.dbStats(), "/admin/db-stats"],
    ["getPreferences", (a: Api) => a.getPreferences(), "/users/me/preferences"],
    ["savedFlights", (a: Api) => a.savedFlights(), "/users/me/flights"],
    ["weatherAlerts por defecto", (a: Api) => a.weatherAlerts(), "/weather/alerts?severity=high"],
    ["weatherAlerts todas", (a: Api) => a.weatherAlerts("all"), "/weather/alerts?severity=all"],
    ["leadTime por defecto", (a: Api) => a.leadTime(), "/metrics/lead-time?dias=30"],
    ["leadTime con días", (a: Api) => a.leadTime(7), "/metrics/lead-time?dias=7"],
    ["cascada sin escenario", (a: Api) => a.cascada("ab/c"), "/cascade/ab%2Fc"],
    ["cascada con demora (0 cuenta)", (a: Api) => a.cascada("abc", 0), "/cascade/abc?demora_min=0"],
    ["cascada con demora", (a: Api) => a.cascada("abc", 45), "/cascade/abc?demora_min=45"],
  ])("%s", async (_nombre, llamar, ruta) => {
    backend({ "/": { status: 200, body: [] } });
    const { api } = await import("@/lib/api");

    await llamar(api);

    expect(llamadas[0].url).toBe(`${BACKEND}${ruta}`);
    expect(llamadas[0].init.method).toBeUndefined();
  });

  it("createUser hace POST con las credenciales y el rol en JSON", async () => {
    backend({ "/admin/users": { status: 200, body: { ok: true } } });
    const { api } = await import("@/lib/api");

    await api.createUser("ana", "secreta", "admin");

    expect(llamadas[0].url).toBe(`${BACKEND}/admin/users`);
    expect(llamadas[0].init.method).toBe("POST");
    expect(header(llamadas[0], "Content-Type")).toBe("application/json");
    expect(cuerpo(llamadas[0])).toEqual({ username: "ana", password: "secreta", role: "admin" });
  });

  it("updateUser hace PATCH sobre el usuario escapado con el parche tal cual", async () => {
    backend({ "/admin/users/": { status: 200, body: { ok: true } } });
    const { api } = await import("@/lib/api");

    await api.updateUser("a@b.com", { active: false, role: "user" });

    expect(llamadas[0].url).toBe(`${BACKEND}/admin/users/a%40b.com`);
    expect(llamadas[0].init.method).toBe("PATCH");
    expect(cuerpo(llamadas[0])).toEqual({ active: false, role: "user" });
  });

  it("updatePreferences hace PUT con las preferencias parciales", async () => {
    backend({ "/users/me/preferences": { status: 200, body: { ok: true } } });
    const { api } = await import("@/lib/api");

    await api.updatePreferences({ theme: "dark" });

    expect(llamadas[0].init.method).toBe("PUT");
    expect(cuerpo(llamadas[0])).toEqual({ theme: "dark" });
  });

  it("saveFlight y unsaveFlight usan POST con cuerpo y DELETE con el id escapado", async () => {
    backend({ "/users/me/flights": { status: 200, body: { ok: true } } });
    const { api } = await import("@/lib/api");

    await api.saveFlight("SYN-DL100/ATL");
    await api.unsaveFlight("SYN-DL100/ATL");

    expect(llamadas[0].url).toBe(`${BACKEND}/users/me/flights`);
    expect(llamadas[0].init.method).toBe("POST");
    expect(cuerpo(llamadas[0])).toEqual({ fa_flight_id: "SYN-DL100/ATL" });
    expect(llamadas[1].url).toBe(`${BACKEND}/users/me/flights/SYN-DL100%2FATL`);
    expect(llamadas[1].init.method).toBe("DELETE");
  });
});

type Api = Awaited<typeof import("@/lib/api")>["api"];

describe("api.flightHistory normaliza los puntos", () => {
  const minimo = { predicted_at_utc: "2026-10-01T10:00:00Z", delay_probability: 0.4, predicted_delay: 12 };

  it("completa los campos que un backend viejo no manda", async () => {
    backend({ "/flight-history/": { status: 200, body: [minimo] } });
    const { api } = await import("@/lib/api");

    const [punto] = await api.flightHistory("abc");

    expect(punto).toEqual({
      ...minimo,
      base_probability: 0.4,
      operational_adjustment: 0,
      threshold_used: null,
      threshold_strategy: null,
      prediction_phase: "PRE_DEPARTURE",
      operational_context: {
        gdp_origin_delay_min: null,
        gdp_destination_delay_min: null,
        intermediate_departure_delay_min: null,
        adsb_eta_delay_min: null,
        adsb_holding_min: null,
      },
      shap: [],
    });
  });

  it("deriva el ajuste operativo cuando viene la base pero no el ajuste", async () => {
    backend({ "/flight-history/": { status: 200, body: [{ ...minimo, base_probability: 0.3 }] } });
    const { api } = await import("@/lib/api");

    const [punto] = await api.flightHistory("abc");

    expect(punto.operational_adjustment).toBeCloseTo(0.1);
  });

  it.each([
    ["EN_ROUTE", "EN_ROUTE"],
    ["POST_LANDING", "POST_LANDING"],
    ["PRE_DEPARTURE", "PRE_DEPARTURE"],
    ["cualquier otra cosa", "PRE_DEPARTURE"],
  ])("la fase %s se lee como %s", async (fase, esperada) => {
    backend({ "/flight-history/": { status: 200, body: [{ ...minimo, prediction_phase: fase }] } });
    const { api } = await import("@/lib/api");

    const [punto] = await api.flightHistory("abc");

    expect(punto.prediction_phase).toBe(esperada);
  });

  it("respeta un punto completo tal cual viene", async () => {
    const completo = {
      ...minimo,
      base_probability: 0.35,
      operational_adjustment: 0.05,
      threshold_used: 0.22,
      threshold_strategy: "quantile@0.22",
      prediction_phase: "EN_ROUTE",
      operational_context: {
        gdp_origin_delay_min: 10,
        gdp_destination_delay_min: null,
        intermediate_departure_delay_min: 5,
        adsb_eta_delay_min: null,
        adsb_holding_min: 0,
      },
      shap: [{ feature: "f", label: "F", contribution: 0.1, direction: "positive" }],
    };
    backend({ "/flight-history/": { status: 200, body: [completo] } });
    const { api } = await import("@/lib/api");

    const [punto] = await api.flightHistory("abc");

    expect(punto).toEqual(completo);
  });
});

describe("apiMe", () => {
  it("devuelve la sesión y descarta un user_type desconocido", async () => {
    backend({ "/auth/me": { status: 200, body: { username: "ana", role: "user", user_type: "b2x" } } });
    const { apiMe } = await import("@/lib/api");

    await expect(apiMe()).resolves.toEqual({ username: "ana", role: "user", userType: null });
  });

  it.each([
    ["rol desconocido", { username: "ana", role: "mago" }],
    ["sin username", { role: "user" }],
  ])("rechaza con 502 una respuesta con %s", async (_caso, body) => {
    backend({ "/auth/me": { status: 200, body } });
    const { apiMe } = await import("@/lib/api");

    await expect(apiMe()).rejects.toMatchObject({ status: 502, message: "No se pudo validar la sesión" });
  });
});

describe("apiLogin en la web", () => {
  it("pega al BFF con las credenciales y devuelve la sesión que arma el servidor", async () => {
    backend({ "/api/auth/login": { status: 200, body: { username: "ana", role: "admin" } } });
    const { apiLogin } = await import("@/lib/api");

    const sesion = await apiLogin("ana", "secreta");

    expect(sesion).toEqual({ username: "ana", role: "admin" });
    expect(llamadas[0].url).toBe("/api/auth/login");
    expect(llamadas[0].init.method).toBe("POST");
    expect(cuerpo(llamadas[0])).toEqual({ username: "ana", password: "secreta" });
  });

  it("propaga el detail del BFF", async () => {
    backend({ "/api/auth/login": { status: 401, body: { detail: "Credenciales incorrectas" } } });
    const { apiLogin } = await import("@/lib/api");

    await expect(apiLogin("ana", "x")).rejects.toMatchObject({ status: 401, message: "Credenciales incorrectas" });
  });

  it("sin JSON cae en el mensaje genérico", async () => {
    backend({ "/api/auth/login": { status: 500, texto: "boom" } });
    const { apiLogin } = await import("@/lib/api");

    await expect(apiLogin("ana", "x")).rejects.toMatchObject({ status: 500, message: "No se pudo iniciar sesión." });
  });
});

describe("apiLoginFirebase en la web", () => {
  it("Firebase: manda el id_token al BFF y devuelve la sesión", async () => {
    backend({ "/api/auth/firebase": { status: 200, body: { username: "f", role: "user", userType: "b2b", isNewUser: false } } });
    const { apiLoginFirebase } = await import("@/lib/api");

    const sesion = await apiLoginFirebase("id-firebase");

    expect(sesion).toMatchObject({ username: "f", userType: "b2b" });
    expect(llamadas[0].url).toBe("/api/auth/firebase");
    expect(cuerpo(llamadas[0])).toEqual({ id_token: "id-firebase" });
  });

  it("Firebase: deja pasar el 403 de correo sin verificar, y sin cuerpo usa el mensaje propio", async () => {
    backend({ "/api/auth/firebase": { status: 403, body: { detail: "Falta verificar el correo" } } });
    const { apiLoginFirebase } = await import("@/lib/api");
    await expect(apiLoginFirebase("t")).rejects.toMatchObject({ status: 403, message: "Falta verificar el correo" });

    backend({ "/api/auth/firebase": { status: 200, texto: "null" } });
    await expect(apiLoginFirebase("t")).rejects.toMatchObject({ message: "No se pudo iniciar sesión." });
  });
});

describe("apiSetUserType en la web", () => {
  it("hace PATCH al BFF sin Authorization: la cookie viaja sola", async () => {
    navegador();
    backend({ "/users/me": { status: 200, body: { ok: true } } });
    const { apiSetUserType } = await import("@/lib/api");

    await apiSetUserType("b2b");

    expect(llamadas[0].url).toBe("/api/backend/users/me");
    expect(llamadas[0].init.method).toBe("PATCH");
    expect(header(llamadas[0], "Content-Type")).toBe("application/json");
    expect(header(llamadas[0], "Authorization")).toBeUndefined();
    expect(cuerpo(llamadas[0])).toEqual({ user_type: "b2b" });
  });

  it("propaga el detail, y sin JSON usa el mensaje propio", async () => {
    navegador();
    backend({ "/users/me": { status: 403, body: { detail: "Sin permiso" } } });
    const { apiSetUserType } = await import("@/lib/api");
    await expect(apiSetUserType("b2c")).rejects.toMatchObject({ status: 403, message: "Sin permiso" });

    backend({ "/users/me": { status: 500, texto: "boom" } });
    await expect(apiSetUserType("b2c")).rejects.toMatchObject({ message: "No se pudo guardar el perfil." });
  });
});

describe("apiDeleteAccount y apiLogout en la web", () => {
  it("borra la cuenta y después cierra la sesión", async () => {
    navegador();
    backend({ "/users/me": { status: 200, body: { ok: true } }, "/api/auth/logout": { status: 200, body: { ok: true } } });
    const { apiDeleteAccount } = await import("@/lib/api");

    await apiDeleteAccount();

    expect(llamadas.map((l) => `${l.init.method} ${l.url}`)).toEqual([
      "DELETE /api/backend/users/me",
      "POST /api/auth/logout",
    ]);
  });

  it("un 404 cuenta como éxito: la cuenta ya no está, y se cierra la sesión igual", async () => {
    navegador();
    backend({ "/users/me": { status: 404, body: { detail: "no existe" } }, "/api/auth/logout": { status: 200, body: {} } });
    const { apiDeleteAccount } = await import("@/lib/api");

    await expect(apiDeleteAccount()).resolves.toBeUndefined();

    expect(llamadas).toHaveLength(2);
  });

  it("si el backend rechaza la baja, lanza con su detail y no toca la sesión", async () => {
    navegador();
    backend({ "/users/me": { status: 500, body: { detail: "No se pudo borrar en Firebase" } } });
    const { apiDeleteAccount } = await import("@/lib/api");

    await expect(apiDeleteAccount()).rejects.toMatchObject({ status: 500, message: "No se pudo borrar en Firebase" });

    expect(llamadas).toHaveLength(1);
  });

  it("si la baja salió bien pero el logout falla, no lo convierte en error", async () => {
    navegador();
    backend({ "/users/me": { status: 200, body: {} }, "/api/auth/logout": { status: 500, texto: "boom" } });
    const { apiDeleteAccount } = await import("@/lib/api");

    await expect(apiDeleteAccount()).resolves.toBeUndefined();
  });

  it("apiLogout hace POST al BFF y lanza si no responde ok", async () => {
    backend({ "/api/auth/logout": { status: 200, body: { ok: true } } });
    const { apiLogout } = await import("@/lib/api");
    await expect(apiLogout()).resolves.toBeUndefined();
    expect(llamadas[0].init.method).toBe("POST");

    backend({ "/api/auth/logout": { status: 500, texto: "boom" } });
    await expect(apiLogout()).rejects.toMatchObject({ status: 500, message: "No se pudo cerrar la sesión" });
  });
});

describe("helpers puros", () => {
  it("riskLabel traduce los tres niveles", async () => {
    const { riskLabel } = await import("@/lib/api");
    expect([riskLabel("low"), riskLabel("medium"), riskLabel("high")]).toEqual(["Bajo", "Medio", "Alto"]);
  });

  it("fmtProba redondea a entero con el signo de porcentaje", async () => {
    const { fmtProba } = await import("@/lib/api");
    expect(fmtProba(0.226)).toBe("23%");
    expect(fmtProba(0.225)).toBe("23%");
    expect(fmtProba(0)).toBe("0%");
    expect(fmtProba(1)).toBe("100%");
  });

  it("toUTCDate no agrega Z cuando ya hay sufijo Z u offset positivo", async () => {
    // El backend serializa siempre con "+00:00" o "Z". Un offset negativo
    // ("-03:00") no está contemplado por el regex y daría Invalid Date; no
    // se fija acá porque es un defecto latente, no un comportamiento a
    // proteger.
    const { toUTCDate } = await import("@/lib/api");
    expect(toUTCDate("2026-10-02T12:00:00Z").toISOString()).toBe("2026-10-02T12:00:00.000Z");
    expect(toUTCDate("2026-10-02T12:00:00+00:00").toISOString()).toBe("2026-10-02T12:00:00.000Z");
  });

  it("fmtTime devuelve el guion para una marca que no es fecha", async () => {
    const { fmtTime } = await import("@/lib/api");
    expect(fmtTime("ayer")).toBe("--");
  });
});
