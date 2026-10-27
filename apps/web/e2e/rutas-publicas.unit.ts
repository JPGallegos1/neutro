import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { routeFromDistHtml } from "../src/contract/dist.ts";
import { leerRutasPublicas } from "./rutas-publicas.ts";

function escribir(dir: string, relativo: string): void {
  const path = join(dir, relativo);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, "<html></html>");
}

describe("leerRutasPublicas", () => {
  it("arma rutas sin barra final y deja afuera 404 y lo que no es HTML", () => {
    const dir = mkdtempSync(join(tmpdir(), "neutro-rutas-"));
    const html = [
      "index.html",
      "404.html",
      "Mi-Pagina.V2.html",
      "nosotros/index.html",
    ];
    try {
      for (const relativo of html) escribir(dir, relativo);
      escribir(dir, "notas.txt");
      escribir(dir, "assets/pixel.png");
      const rutas = leerRutasPublicas(dir);
      assert.ok(rutas.length > 0);
      assert.deepEqual(rutas, ["/", "/Mi-Pagina.V2", "/nosotros"]);
      assert.equal(rutas.includes("/404"), false);
      assert.equal(rutas.includes("/nosotros/"), false);
      assert.equal(
        rutas.some((ruta) => ruta.length > 1 && ruta.endsWith("/")),
        false,
      );
      assert.equal(routeFromDistHtml("nosotros/index.html"), "/nosotros");
      assert.equal(routeFromDistHtml("Mi-Pagina.V2.html"), "/Mi-Pagina.V2");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
