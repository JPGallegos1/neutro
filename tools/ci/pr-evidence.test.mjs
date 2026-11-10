import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { checkPrBody } from "./check-pr-body.mjs";
import { checkChangeEvidence } from "./pr-evidence.mjs";

const pr122Body = readFileSync(
  fileURLToPath(new URL("./fixtures/pr-122-body.md", import.meta.url)),
  "utf8",
);

const PR_122_PATHS = [
  "apps/web/e2e/contacto.spec.ts",
  "apps/web/src/components/sections/ContactoForm.astro",
  "apps/web/src/components/sections/Header.astro",
  "apps/web/src/components/sections/contacto-page.test.ts",
  "apps/web/src/components/sections/header-theme.test.ts",
];

const HEADER = "apps/web/src/components/sections/Header.astro";
const FORM = "apps/web/src/components/sections/ContactoForm.astro";
const WORKER = "apps/web/worker/contacto/handler.ts";
const ATTACHMENT =
  "https://github.com/user-attachments/assets/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function flowSection(paths) {
  return `El diff cambia un flujo (${paths}) y falta la sección «Capturas» con un video (.mp4, .webm, .mov o un adjunto de GitHub).`;
}

function flowMedia(paths) {
  return `La sección «Capturas» tiene que incluir un video (.mp4, .webm, .mov o un adjunto de GitHub). Una imagen sola no alcanza. El diff cambia un flujo (${paths}).`;
}

function uiSection(paths) {
  return `El diff cambia UI (${paths}) y falta la sección «Capturas» con una imagen.`;
}

function uiMedia(paths) {
  return `La sección «Capturas» tiene que incluir una imagen real (markdown o <img>). El diff cambia UI (${paths}).`;
}

function withCapturas(body, block) {
  const section = `\n\n## Capturas\n\n${block}\n`;
  const end = "<!-- CURSOR_AGENT_PR_BODY_END -->";
  if (body.includes(end)) {
    return body.replace(end, `${section}${end}`);
  }
  return `${body}${section}`;
}

describe("checkChangeEvidence", () => {
  it("el cuerpo del #122 es válido para las seis secciones y pide video", () => {
    assert.equal(checkPrBody(pr122Body).ok, true);
    const result = checkChangeEvidence(pr122Body, PR_122_PATHS);
    assert.equal(result.ok, false);
    assert.deepEqual(result.problems, [flowSection(FORM)]);
  });

  it("una imagen en Capturas no salva un flujo", () => {
    const result = checkChangeEvidence(
      withCapturas(pr122Body, "![envío](https://example.com/a.png)"),
      PR_122_PATHS,
    );
    assert.deepEqual(result.problems, [flowMedia(FORM)]);
  });

  it("un video en Capturas deja pasar el #122 aunque no haya imagen", () => {
    const result = checkChangeEvidence(
      withCapturas(pr122Body, "[flujo](https://example.com/contacto.webm)"),
      PR_122_PATHS,
    );
    assert.deepEqual(result, { ok: true, problems: [] });
  });

  it("un adjunto de GitHub suelto cuenta como video y el mismo adentro de una imagen no", () => {
    const bare = checkChangeEvidence(
      withCapturas(pr122Body, ATTACHMENT),
      PR_122_PATHS,
    );
    assert.deepEqual(bare, { ok: true, problems: [] });

    const linked = checkChangeEvidence(
      withCapturas(pr122Body, `[flujo](${ATTACHMENT})`),
      PR_122_PATHS,
    );
    assert.deepEqual(linked, { ok: true, problems: [] });

    const embedded = checkChangeEvidence(
      withCapturas(pr122Body, `![envío](${ATTACHMENT})`),
      PR_122_PATHS,
    );
    assert.deepEqual(embedded.problems, [flowMedia(FORM)]);
  });

  it("Header con una imagen real en Capturas pasa, y sin esa imagen no", () => {
    const missing = checkChangeEvidence(pr122Body, [HEADER]);
    assert.deepEqual(missing.problems, [uiSection(HEADER)]);

    const image = checkChangeEvidence(
      withCapturas("## Problema\n\nTexto.", "![x](https://example.com/a.png)"),
      [HEADER],
    );
    assert.deepEqual(image, { ok: true, problems: [] });

    const tag = checkChangeEvidence(
      withCapturas(
        "solo capturas",
        '<img alt="x" src="https://example.com/a.png">',
      ),
      [HEADER],
    );
    assert.deepEqual(tag, { ok: true, problems: [] });
  });

  it("un link, una referencia o un h3 Screenshots no son una imagen", () => {
    const linked = checkChangeEvidence(
      withCapturas(
        "cuerpo",
        "[foto](https://example.com/a.png)\nhttps://example.com/b.png\n![foto][id]\n\n[id]: https://example.com/c.png",
      ),
      [HEADER],
    );
    assert.deepEqual(linked.problems, [uiMedia(HEADER)]);

    const screenshots = [
      "## Verificación",
      "",
      "### Screenshots",
      "",
      "https://example.com/nav.png",
      "[header](https://example.com/header.png)",
    ].join("\n");
    const outside = checkChangeEvidence(screenshots, [HEADER]);
    assert.deepEqual(outside.problems, [uiSection(HEADER)]);
  });

  it("un ejemplo en código, un comentario o el pie de Cursor no cuentan", () => {
    const fence = "`".repeat(3);
    const coded = checkChangeEvidence(
      withCapturas(
        "cuerpo",
        [`${fence}`, "![x](https://example.com/a.png)", fence].join("\n"),
      ),
      [HEADER],
    );
    assert.deepEqual(coded.problems, [uiMedia(HEADER)]);

    const tildes = checkChangeEvidence(
      withCapturas(
        "cuerpo",
        ["~~~", "![x](https://example.com/a.png)", "~~~"].join("\n"),
      ),
      [HEADER],
    );
    assert.deepEqual(tildes.problems, [uiMedia(HEADER)]);

    const inline = checkChangeEvidence(
      withCapturas("cuerpo", "`![x](https://example.com/a.png)`"),
      [HEADER],
    );
    assert.deepEqual(inline.problems, [uiMedia(HEADER)]);

    const commented = checkChangeEvidence(
      withCapturas("cuerpo", "<!-- ![x](https://example.com/a.png) -->"),
      [HEADER],
    );
    assert.deepEqual(commented.problems, [uiMedia(HEADER)]);

    const footer = checkChangeEvidence(
      withCapturas(
        "cuerpo",
        '<img alt="Open in Web" src="https://cursor.com/assets/images/open-in-web-dark.png">',
      ),
      [HEADER],
    );
    assert.deepEqual(footer.problems, [uiMedia(HEADER)]);
  });

  it("no arma un video pegando dos mitades de una URL separadas por código", () => {
    const split = checkChangeEvidence(
      withCapturas("cuerpo", "https://example.com/`secreto`.mp4"),
      [FORM],
    );
    assert.deepEqual(split.problems, [flowMedia(FORM)]);
  });

  it("la extensión se juzga en el path, antes de ? y #", () => {
    const query = checkChangeEvidence(
      withCapturas("cuerpo", "[clip](https://example.com/a.mp4?raw=1)"),
      [FORM],
    );
    assert.deepEqual(query, { ok: true, problems: [] });

    const fake = checkChangeEvidence(
      withCapturas("cuerpo", "![x](https://example.com/a.png?x=.mp4)"),
      [FORM],
    );
    assert.deepEqual(fake.problems, [flowMedia(FORM)]);

    const upper = checkChangeEvidence(
      withCapturas("cuerpo", "https://example.com/CLIP.MOV"),
      [WORKER],
    );
    assert.deepEqual(upper, { ok: true, problems: [] });
  });

  it("un embed con extensión de video cuenta como video", () => {
    const embedded = checkChangeEvidence(
      withCapturas("cuerpo", "![clip](https://example.com/clip.mp4)"),
      [FORM],
    );
    assert.deepEqual(embedded, { ok: true, problems: [] });

    const visualOnly = checkChangeEvidence(
      withCapturas("cuerpo", "![clip](https://example.com/clip.mp4)"),
      [HEADER],
    );
    assert.deepEqual(visualOnly.problems, [uiMedia(HEADER)]);
  });

  it("acepta video relativo, autolink, tag video y adjunto en /files", () => {
    const relative = checkChangeEvidence(
      withCapturas("cuerpo", "[flujo](./capturas/nav.webm)"),
      [WORKER],
    );
    assert.deepEqual(relative, { ok: true, problems: [] });

    const auto = checkChangeEvidence(
      withCapturas(
        "cuerpo",
        "<https://github.com/user-attachments/files/1234>",
      ),
      [WORKER],
    );
    assert.deepEqual(auto, { ok: true, problems: [] });

    const tag = checkChangeEvidence(
      withCapturas("cuerpo", '<video src="./envio.mov"></video>'),
      [WORKER],
    );
    assert.deepEqual(tag, { ok: true, problems: [] });

    const source = checkChangeEvidence(
      withCapturas("cuerpo", '<source src="https://example.com/a.webm">'),
      [WORKER],
    );
    assert.deepEqual(source, { ok: true, problems: [] });
  });

  it("rechaza adjuntos que no son https://github.com/user-attachments", () => {
    for (const url of [
      "http://github.com/user-attachments/assets/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "https://www.github.com/user-attachments/assets/aaaaaaaa",
      "https://user-images.githubusercontent.com/1/aaaaaaaa",
      "https://github.com/user-attachments/other/aaaaaaaa",
    ]) {
      const result = checkChangeEvidence(withCapturas("cuerpo", url), [WORKER]);
      assert.deepEqual(result.problems, [flowMedia(WORKER)], url);
    }
  });

  it("solo lee ## Capturas, junta las repetidas y distingue sección vacía", () => {
    const wrongTitle = checkChangeEvidence(
      "## Capturas de pantalla\n\n![x](https://example.com/a.png)\n",
      [HEADER],
    );
    assert.deepEqual(wrongTitle.problems, [uiSection(HEADER)]);

    const lower = checkChangeEvidence(
      "## capturas\n\n![x](https://example.com/a.png)\n",
      [HEADER],
    );
    assert.deepEqual(lower.problems, [uiSection(HEADER)]);

    const empty = checkChangeEvidence("## Capturas\n\n", [HEADER]);
    assert.deepEqual(empty.problems, [uiMedia(HEADER)]);

    const second = [
      "## Capturas",
      "",
      "todavía no",
      "",
      "## Capturas",
      "",
      "![x](https://example.com/a.png)",
    ].join("\n");
    assert.deepEqual(checkChangeEvidence(second, [HEADER]), {
      ok: true,
      problems: [],
    });

    const inVerification = [
      "## Verificación",
      "",
      "![x](https://example.com/a.png)",
      "",
      "## Capturas",
      "",
      "sin archivo",
    ].join("\n");
    assert.deepEqual(checkChangeEvidence(inVerification, [HEADER]).problems, [
      uiMedia(HEADER),
    ]);
  });

  it("dos llamadas con los mismos argumentos devuelven lo mismo", () => {
    const first = checkChangeEvidence(pr122Body, PR_122_PATHS);
    const second = checkChangeEvidence(pr122Body, PR_122_PATHS);
    assert.deepEqual(first, second);
  });

  it("los cuatro perfiles piden cero o una evidencia, y el flujo le gana a la foto", () => {
    const none = checkChangeEvidence(pr122Body, [
      "docs/adr/0007-reglas-automaticas-y-verification-skill.md",
      "AGENTS.md",
      "apps/web/e2e/contacto.spec.ts",
      "apps/web/src/components/sections/contacto-page.test.ts",
    ]);
    assert.deepEqual(none, { ok: true, problems: [] });

    const visual = checkChangeEvidence("sin capturas", [HEADER]);
    assert.equal(visual.problems.length, 1);
    assert.equal(visual.problems[0], uiSection(HEADER));

    const flow = checkChangeEvidence("sin capturas", [WORKER]);
    assert.equal(flow.problems.length, 1);
    assert.equal(flow.problems[0], flowSection(WORKER));

    const both = checkChangeEvidence("sin capturas", [FORM, HEADER]);
    assert.deepEqual(both.problems, [flowSection(FORM)]);
  });

  it("nombra los paths que disparan la regla, en orden y hasta cinco", () => {
    const paths = [1, 2, 3, 4, 5, 6].map(
      (index) => `apps/web/src/components/Parte${index}.astro`,
    );
    const shown = paths.slice(0, 5).join(", ");
    const result = checkChangeEvidence("sin capturas", [
      paths[0],
      paths[0],
      ...paths.slice(1),
      null,
      "",
      "/etc/passwd",
      "../apps/web/src/components/Fuera.astro",
      `./${paths[2]}`,
    ]);
    assert.deepEqual(result.problems, [uiSection(`${shown} y 1 más`)]);
    assert.equal(result.problems[0].includes("Parte6.astro"), false);
    assert.equal(result.problems[0].includes("Fuera.astro"), false);
  });

  it("normaliza ./ y barras invertidas, e ignora paths que no son del repo", () => {
    const slash = checkChangeEvidence("sin capturas", [
      ".\\apps\\web\\src\\components\\sections\\Header.astro",
    ]);
    assert.deepEqual(slash.problems, [uiSection(HEADER)]);

    const ignored = checkChangeEvidence("sin capturas", [
      "https://example.com/apps/web/src/components/sections/Header.astro",
      "C:/apps/web/src/components/sections/Header.astro",
      "apps/web/src/components/sections/../Header.astro",
    ]);
    assert.deepEqual(ignored, { ok: true, problems: [] });
  });

  it("clasifica ui, páginas, estilos, assets y el worker de contacto", () => {
    const cases = [
      [
        "apps/web/src/pages/contacto.astro",
        flowSection("apps/web/src/pages/contacto.astro"),
      ],
      [
        "apps/web/src/layouts/Base.astro",
        uiSection("apps/web/src/layouts/Base.astro"),
      ],
      [
        "apps/web/src/pages/index.astro",
        uiSection("apps/web/src/pages/index.astro"),
      ],
      [
        "apps/web/src/styles/site.css",
        uiSection("apps/web/src/styles/site.css"),
      ],
      [
        "apps/web/src/components/sections/ContactoHero.astro",
        uiSection("apps/web/src/components/sections/ContactoHero.astro"),
      ],
      [
        "packages/ui/src/components/button.tsx",
        uiSection("packages/ui/src/components/button.tsx"),
      ],
      [
        "packages/ui/src/styles/globals.css",
        uiSection("packages/ui/src/styles/globals.css"),
      ],
      [
        "apps/web/public/brand/logo.png",
        uiSection("apps/web/public/brand/logo.png"),
      ],
      [
        "apps/web/public/icons/mark.svg",
        uiSection("apps/web/public/icons/mark.svg"),
      ],
      ["apps/web/public/photo.avif", uiSection("apps/web/public/photo.avif")],
      [
        "apps/docs/src/pages/index.jsx",
        uiSection("apps/docs/src/pages/index.jsx"),
      ],
      [
        "apps/web/worker/contacto/nested/send.ts",
        flowSection("apps/web/worker/contacto/nested/send.ts"),
      ],
      [
        "apps/web/worker/contacto/send.spec.ts",
        flowSection("apps/web/worker/contacto/send.spec.ts"),
      ],
    ];
    for (const [path, problem] of cases) {
      assert.deepEqual(
        checkChangeEvidence("sin capturas", [path]).problems,
        [problem],
        path,
      );
    }

    const silent = [
      "apps/web/worker/contacto/handler.test.ts",
      "apps/web/worker/contacto.ts",
      "apps/web/worker/otro/handler.ts",
      "apps/web/src/lib/util.ts",
      "apps/web/src/components/sections/header-theme.test.ts",
      "packages/ui/src/lib/utils.ts",
      "packages/ui/src/components/button.ts",
      "apps/web/public/clip.mp4",
      "apps/web/public/notas.txt",
      "README.md",
    ];
    for (const path of silent) {
      assert.deepEqual(
        checkChangeEvidence("sin capturas", [path]),
        { ok: true, problems: [] },
        path,
      );
    }
  });
});
