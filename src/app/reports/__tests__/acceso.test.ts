/**
 * Quién puede ver la evolución del modelo.
 *
 * El criterio del issue es el ROL: admin y superadmin la ven, el resto no. La
 * primera versión gateó por PERFIL —operaciones contra viajero—, que es otra
 * cosa y fallaba en las dos direcciones: escondía la página de un administrador
 * con perfil de viajero, y se la mostraba a un usuario común que eligiera
 * operaciones.
 *
 * Se verifica sobre la fuente porque el defecto es estructural: una página que
 * confía solo en el menú no protege nada, y no hay render que lo exponga.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGINA = readFileSync(
  join(process.cwd(), "src", "app", "reports", "page.tsx"),
  "utf8",
);
const NAVBAR = readFileSync(
  join(process.cwd(), "src", "components", "app-nav.tsx"),
  "utf8",
);

describe("la página se protege sola", () => {
  it("consulta el rol del servidor, no el del cliente", () => {
    // El rol del cliente vive en el navegador; para decidir acceso tiene que
    // resolverse en el servidor.
    expect(PAGINA).toContain("getServerRole");
  });

  it("redirige a quien no es admin ni superadmin", () => {
    expect(PAGINA).toMatch(
      /role !== "admin" && role !== "superadmin"\) redirect\("\/"\)/,
    );
  });

  it("decide el acceso antes de pedir los datos", () => {
    // Si consultara primero, un usuario sin permiso igual dispararía cinco
    // consultas contra el backend antes de que lo echen.
    const iRol = PAGINA.indexOf("getServerRole");
    const iDatos = PAGINA.indexOf("api.modelHistory");
    expect(iRol).toBeGreaterThan(-1);
    expect(iDatos).toBeGreaterThan(iRol);
  });
});

describe("el menú no la muestra a quien no puede entrar", () => {
  it("la entrada depende del rol y no del perfil", () => {
    expect(NAVBAR).toContain("NAV_ADMIN");
    expect(NAVBAR).toMatch(/rol === "admin" \|\| rol === "superadmin"/);
  });

  it("no quedó colgada de las listas por perfil", () => {
    // Que siga en la lista de operaciones la escondería de un admin con perfil
    // de viajero, que es exactamente el bug que esto arregla. Y que esté en la
    // de viajero se la mostraría a cualquiera.
    const operaciones = NAVBAR.slice(
      NAVBAR.indexOf("const NAV_OPERACIONES"),
      NAVBAR.indexOf("const NAV_VIAJERO"),
    );
    const viajero = NAVBAR.slice(
      NAVBAR.indexOf("const NAV_VIAJERO"),
      NAVBAR.indexOf("const NAV_ADMIN"),
    );
    expect(operaciones).not.toContain("/reports");
    expect(viajero).not.toContain("/reports");
  });
});
