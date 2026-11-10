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

function expectProblems(raw, paths, problems, label) {
  assert.deepEqual(
    checkChangeEvidence(raw, paths).problems,
    problems,
    label ?? JSON.stringify(paths),
  );
}

describe("checkChangeEvidence", () => {
  it("el #122 pide video; una imagen no alcanza; un video sí", () => {
    assert.equal(checkPrBody(pr122Body).ok, true);
    expectProblems(pr122Body, PR_122_PATHS, [flowSection(FORM)]);
    expectProblems(
      withCapturas(pr122Body, "![envío](https://example.com/a.png)"),
      PR_122_PATHS,
      [flowMedia(FORM)],
    );
    assert.deepEqual(
      checkChangeEvidence(
        withCapturas(pr122Body, "[flujo](https://example.com/contacto.webm)"),
        PR_122_PATHS,
      ),
      { ok: true, problems: [] },
    );
  });

  it("un adjunto suelto o en link es video; adentro de imagen no", () => {
    assert.deepEqual(
      checkChangeEvidence(withCapturas(pr122Body, ATTACHMENT), PR_122_PATHS),
      { ok: true, problems: [] },
    );
    assert.deepEqual(
      checkChangeEvidence(
        withCapturas(pr122Body, `[flujo](${ATTACHMENT})`),
        PR_122_PATHS,
      ),
      { ok: true, problems: [] },
    );
    expectProblems(
      withCapturas(pr122Body, `![envío](${ATTACHMENT})`),
      PR_122_PATHS,
      [flowMedia(FORM)],
    );
  });

  it("Header exige imagen real en ## Capturas", () => {
    expectProblems(pr122Body, [HEADER], [uiSection(HEADER)]);
    assert.deepEqual(
      checkChangeEvidence(
        withCapturas(
          "## Problema\n\nTexto.",
          "![x](https://example.com/a.png)",
        ),
        [HEADER],
      ),
      { ok: true, problems: [] },
    );
    assert.deepEqual(
      checkChangeEvidence(
        withCapturas("solo", '<img alt="x" src="https://example.com/a.png">'),
        [HEADER],
      ),
      { ok: true, problems: [] },
    );
    expectProblems(
      withCapturas(
        "cuerpo",
        "[foto](https://example.com/a.png)\nhttps://example.com/b.png",
      ),
      [HEADER],
      [uiMedia(HEADER)],
    );
    expectProblems(
      "## Verificación\n\n### Screenshots\n\n![x](https://example.com/a.png)\n",
      [HEADER],
      [uiSection(HEADER)],
    );
  });

  it("código, comentario HTML y pie de Cursor no cuentan", () => {
    const fence = "`".repeat(3);
    for (const block of [
      [`${fence}`, "![x](https://example.com/a.png)", fence].join("\n"),
      ["~~~", "![x](https://example.com/a.png)", "~~~"].join("\n"),
      "`![x](https://example.com/a.png)`",
      "<!-- ![x](https://example.com/a.png) -->",
      '<img alt="Open in Web" src="https://cursor.com/assets/images/open-in-web-dark.png">',
    ]) {
      expectProblems(
        withCapturas("cuerpo", block),
        [HEADER],
        [uiMedia(HEADER)],
      );
    }
  });

  it("extensión de video, query string y sintaxis varias", () => {
    assert.deepEqual(
      checkChangeEvidence(
        withCapturas("cuerpo", "[clip](https://example.com/a.mp4?raw=1)"),
        [FORM],
      ),
      { ok: true, problems: [] },
    );
    expectProblems(
      withCapturas("cuerpo", "![x](https://example.com/a.png?x=.mp4)"),
      [FORM],
      [flowMedia(FORM)],
    );
    expectProblems(
      withCapturas("cuerpo", "https://example.com/`secreto`.mp4"),
      [FORM],
      [flowMedia(FORM)],
    );
    assert.deepEqual(
      checkChangeEvidence(
        withCapturas("cuerpo", "![clip](https://example.com/clip.mp4)"),
        [FORM],
      ),
      { ok: true, problems: [] },
    );
    expectProblems(
      withCapturas("cuerpo", "![clip](https://example.com/clip.mp4)"),
      [HEADER],
      [uiMedia(HEADER)],
    );
    for (const block of [
      "[flujo](./capturas/nav.webm)",
      "<https://github.com/user-attachments/files/1234>",
      '<video src="./envio.mov"></video>',
      '<source src="https://example.com/a.webm">',
      "https://example.com/CLIP.MOV",
    ]) {
      assert.deepEqual(
        checkChangeEvidence(withCapturas("cuerpo", block), [WORKER]),
        { ok: true, problems: [] },
        block,
      );
    }
    for (const url of [
      "http://github.com/user-attachments/assets/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "https://www.github.com/user-attachments/assets/aaaaaaaa",
      "https://user-images.githubusercontent.com/1/aaaaaaaa",
      "https://github.com/user-attachments/other/aaaaaaaa",
    ]) {
      expectProblems(
        withCapturas("cuerpo", url),
        [WORKER],
        [flowMedia(WORKER)],
        url,
      );
    }
  });

  it("solo ## Capturas; vacío; repetidas; flujo le gana a la foto", () => {
    expectProblems(
      "## Capturas de pantalla\n\n![x](https://example.com/a.png)\n",
      [HEADER],
      [uiSection(HEADER)],
    );
    expectProblems("## Capturas\n\n", [HEADER], [uiMedia(HEADER)]);
    assert.deepEqual(
      checkChangeEvidence(
        "## Capturas\n\na\n\n## Capturas\n\n![x](https://example.com/a.png)",
        [HEADER],
      ),
      { ok: true, problems: [] },
    );
    assert.deepEqual(
      checkChangeEvidence(pr122Body, [
        "docs/adr/0007-reglas-automaticas-y-verification-skill.md",
        "apps/web/e2e/contacto.spec.ts",
      ]),
      { ok: true, problems: [] },
    );
    expectProblems("sin", [HEADER], [uiSection(HEADER)]);
    expectProblems("sin", [WORKER], [flowSection(WORKER)]);
    expectProblems("sin", [FORM, HEADER], [flowSection(FORM)]);
  });

  it("normaliza paths, lista hasta cinco y clasifica UI vs flujo", () => {
    const paths = [1, 2, 3, 4, 5, 6].map(
      (n) => `apps/web/src/components/Parte${n}.astro`,
    );
    expectProblems(
      "sin",
      [
        paths[0],
        paths[0],
        ...paths.slice(1),
        null,
        "/etc/passwd",
        `./${paths[2]}`,
      ],
      [uiSection(`${paths.slice(0, 5).join(", ")} y 1 más`)],
    );
    expectProblems(
      "sin",
      [".\\apps\\web\\src\\components\\sections\\Header.astro"],
      [uiSection(HEADER)],
    );
    const classified = {
      "apps/web/src/pages/contacto.astro": flowSection,
      "apps/web/src/layouts/Base.astro": uiSection,
      "apps/web/src/pages/index.astro": uiSection,
      "apps/web/src/styles/site.css": uiSection,
      "packages/ui/src/components/button.tsx": uiSection,
      "packages/ui/src/styles/globals.css": uiSection,
      "apps/web/public/brand/logo.png": uiSection,
      "apps/web/worker/contacto/nested/send.ts": flowSection,
      "apps/web/worker/contacto/send.spec.ts": flowSection,
    };
    for (const [path, msg] of Object.entries(classified)) {
      expectProblems("sin", [path], [msg(path)], path);
    }
    for (const path of [
      "apps/web/worker/contacto/handler.test.ts",
      "apps/web/src/lib/util.ts",
      "packages/ui/src/lib/utils.ts",
      "apps/web/public/clip.mp4",
      "README.md",
    ]) {
      assert.deepEqual(
        checkChangeEvidence("sin", [path]),
        { ok: true, problems: [] },
        path,
      );
    }
  });
});
