import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { checkPrBody } from "./check-pr-body.mjs";

const script = fileURLToPath(new URL("./check-pr-body.mjs", import.meta.url));
const workflowPath = fileURLToPath(
  new URL("../../.github/workflows/pr-body.yml", import.meta.url),
);
const templatePath = fileURLToPath(
  new URL("../../.github/pull_request_template.md", import.meta.url),
);
const skillPath = fileURLToPath(
  new URL("../../.cursor/skills/verify-web/SKILL.md", import.meta.url),
);

const HEADINGS = [
  "Problema",
  "Restricciones y verdades",
  "Razonamiento",
  "Solución",
  "Trade-offs",
  "Verificación",
];

const CURSOR_FOOTER = [
  '<div><a href="https://cursor.com/agents/bc-47cf50c8-f0ec-5bbc-9dab-c82b37b73914?cursor_ref=pr_footer&cursor_cta=open_in_web"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cursor.com/assets/images/open-in-web-dark.png"><source media="(prefers-color-scheme: light)" srcset="https://cursor.com/assets/images/open-in-web-light.png"><img alt="Open in Web" width="114" height="28" src="https://cursor.com/assets/images/open-in-web-dark.png"></picture></a>&nbsp;<a href="https://cursor.com/background-agent?bcId=bc-47cf50c8-f0ec-5bbc-9dab-c82b37b73914&cursor_ref=pr_footer&cursor_cta=open_in_cursor"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cursor.com/assets/images/open-in-cursor-dark.png"><source media="(prefers-color-scheme: light)" srcset="https://cursor.com/assets/images/open-in-cursor-light.png"><img alt="Open in Cursor" width="131" height="28" src="https://cursor.com/assets/images/open-in-cursor-dark.png"></picture></a>&nbsp;</div>',
].join("\n");

function section(title, content) {
  return `## ${title}\n\n${content}`;
}

function validBody(contents = HEADINGS.map((title) => `Texto de ${title}.`)) {
  return HEADINGS.map((title, index) => section(title, contents[index])).join(
    "\n\n",
  );
}

function missing(title) {
  return `Falta la sección «${title}».`;
}

function runScript(env, args = []) {
  const cleaned = { ...process.env };
  delete cleaned.PR_BODY;
  delete cleaned.GITHUB_EVENT_PATH;
  return spawnSync(process.execPath, [script, ...args], {
    env: { ...cleaned, ...env },
    encoding: "utf8",
  });
}

function runEvent(body, extraEnv = {}) {
  const dir = mkdtempSync(join(tmpdir(), "neutro-pr-body-"));
  const eventPath = join(dir, "event.json");
  writeFileSync(
    eventPath,
    JSON.stringify({
      action: "opened",
      pull_request: { number: 55, body },
    }),
  );
  try {
    return runScript({ GITHUB_EVENT_PATH: eventPath, ...extraEnv });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("checkPrBody", () => {
  it("acepta las seis secciones en orden, cada una con texto", () => {
    const result = checkPrBody(validBody());
    assert.equal(result.ok, true);
    assert.deepEqual(result.problems, []);
  });

  it("un cuerpo vacío nombra las seis secciones que faltan", () => {
    for (const raw of ["", "   \n\n", undefined, null]) {
      const result = checkPrBody(raw);
      assert.equal(result.ok, false);
      assert.deepEqual(
        result.problems,
        HEADINGS.map((title) => missing(title)),
      );
    }
  });

  it("un cuerpo de Dependabot o Renovate sin las seis secciones falla y dice qué falta", () => {
    const dependabot = [
      "Bumps prettier from 3.9.10 to 3.9.11.",
      "",
      "updated-dependencies:",
      "- dependency-name: prettier",
      "  dependency-type: direct:development",
    ].join("\n");
    const renovate = [
      "This PR contains the following updates:",
      "",
      "| Package | Update | Change |",
      "|---|---|---|",
      "| prettier | patch | 3.9.10 -> 3.9.11 |",
    ].join("\n");
    for (const raw of [dependabot, renovate]) {
      const result = checkPrBody(raw);
      assert.equal(result.ok, false);
      assert.deepEqual(
        result.problems,
        HEADINGS.map((title) => missing(title)),
      );
    }
  });

  it("falla si una sección está vacía y no arrastra el fallo a las demás", () => {
    const result = checkPrBody(
      validBody(["uno", "dos", "   ", "cuatro", "cinco", "seis"]),
    );
    assert.deepEqual(result.problems, [
      "La sección «Razonamiento» no tiene contenido.",
    ]);
  });

  it("una sección ausente se nombra como falta, no como desorden de las siguientes", () => {
    const raw = [
      section("Problema", "uno"),
      section("Restricciones y verdades", "dos"),
      section("Solución", "cuatro"),
      section("Trade-offs", "cinco"),
      section("Verificación", "seis"),
    ].join("\n\n");
    assert.deepEqual(checkPrBody(raw).problems, [missing("Razonamiento")]);
  });

  it("un orden distinto falla y nombra la sección que quedó fuera de lugar", () => {
    const raw = [
      section("Problema", "uno"),
      section("Solución", "dos"),
      section("Restricciones y verdades", "tres"),
      section("Razonamiento", "cuatro"),
      section("Trade-offs", "cinco"),
      section("Verificación", "seis"),
    ].join("\n\n");
    assert.deepEqual(checkPrBody(raw).problems, [
      "La sección «Solución» está fuera de orden.",
    ]);
  });

  it("ignora los marcadores del agente y el pie con links de Cursor", () => {
    const wrapped = [
      "<!-- CURSOR_AGENT_PR_BODY_BEGIN -->",
      validBody(),
      "<!-- CURSOR_AGENT_PR_BODY_END -->",
      "",
      CURSOR_FOOTER,
      "",
    ].join("\n");
    assert.equal(checkPrBody(wrapped).ok, true);
  });

  it("el pie de Cursor no cuenta como contenido de Verificación", () => {
    const raw = [
      ...HEADINGS.slice(0, 5).map((title) =>
        section(title, `Texto de ${title}.`),
      ),
      "## Verificación",
      "",
      CURSOR_FOOTER,
    ].join("\n\n");
    assert.deepEqual(checkPrBody(raw).problems, [
      "La sección «Verificación» no tiene contenido.",
    ]);
  });

  it("un ### y un bloque con ## no abren ni cierran secciones", () => {
    const fence = "`".repeat(3);
    const raw = validBody([
      "uno",
      "dos",
      "tres",
      "cuatro",
      "cinco",
      [
        "Seis.",
        "",
        "### Sigue sin medir",
        "",
        `${fence}md`,
        "## Problema",
        "ejemplo",
        fence,
      ].join("\n"),
    ]);
    assert.equal(checkPrBody(raw).ok, true);
  });

  it("acepta finales de línea CRLF", () => {
    assert.equal(checkPrBody(validBody().replaceAll("\n", "\r\n")).ok, true);
  });

  it("un comentario HTML, también multilínea, no cuenta como contenido", () => {
    const onlyComment = validBody([
      "uno",
      "dos",
      "tres",
      "cuatro",
      "cinco",
      "<!-- placeholder -->",
    ]);
    assert.deepEqual(checkPrBody(onlyComment).problems, [
      "La sección «Verificación» no tiene contenido.",
    ]);
    const multiline = validBody([
      "uno",
      "<!--\nplaceholder\n-->",
      "tres",
      "cuatro",
      "cinco",
      "seis",
    ]);
    assert.deepEqual(checkPrBody(multiline).problems, [
      "La sección «Restricciones y verdades» no tiene contenido.",
    ]);
    const withText = validBody([
      "uno <!-- nota --> sigue",
      "dos",
      "tres",
      "cuatro",
      "cinco",
      "seis",
    ]);
    assert.equal(checkPrBody(withText).ok, true);
    const hiddenHeading = [
      "<!--",
      "## Problema",
      "oculto",
      "-->",
      validBody(),
    ].join("\n");
    assert.equal(checkPrBody(hiddenHeading).ok, true);
  });

  it("un comentario sin cerrar, <!--> o <!---> no cuenta como contenido", () => {
    const vacios = [
      "<!-- sin cerrar",
      "<!-->",
      "<!--->",
      "  <!-->  ",
      "<!--->\n",
    ];
    for (const content of vacios) {
      const result = checkPrBody(
        validBody(["uno", "dos", "tres", "cuatro", "cinco", content]),
      );
      assert.deepEqual(result.problems, [
        "La sección «Verificación» no tiene contenido.",
      ]);
    }
    for (const content of ["<!-->", "<!--->"]) {
      const result = checkPrBody(
        validBody(["uno", content, "tres", "cuatro", "cinco", "seis"]),
      );
      assert.deepEqual(result.problems, [
        "La sección «Restricciones y verdades» no tiene contenido.",
      ]);
    }
    const abiertoAlMedio = [
      section("Problema", "uno"),
      section("Restricciones y verdades", "<!-- sin cerrar"),
      section("Razonamiento", "tres"),
      section("Solución", "cuatro"),
      section("Trade-offs", "cinco"),
      section("Verificación", "seis"),
    ].join("\n\n");
    assert.deepEqual(checkPrBody(abiertoAlMedio).problems, [
      "La sección «Restricciones y verdades» no tiene contenido.",
      ...HEADINGS.slice(2).map((title) => missing(title)),
    ]);
    const withText = validBody([
      "visible <!--> sigue",
      "dos <!---> también",
      "tres",
      "cuatro",
      "cinco",
      "seis",
    ]);
    assert.equal(checkPrBody(withText).ok, true);
  });

  it("ignora un BOM UTF-8 inicial antes de los encabezados", () => {
    assert.equal(checkPrBody(`\uFEFF${validBody()}`).ok, true);
    assert.equal(checkPrBody(`\uFEFF\uFEFF${validBody()}`).ok, true);
    const wrapped = [
      "\uFEFF<!-- CURSOR_AGENT_PR_BODY_BEGIN -->",
      validBody(),
      "<!-- CURSOR_AGENT_PR_BODY_END -->",
      "",
      CURSOR_FOOTER,
    ].join("\n");
    assert.equal(checkPrBody(wrapped).ok, true);
  });

  it("la plantilla trae los seis encabezados vacíos y el check la rechaza", () => {
    const template = readFileSync(templatePath, "utf8");
    for (const title of HEADINGS) {
      assert.match(template, new RegExp(`^## ${title}$`, "m"));
    }
    assert.deepEqual(
      checkPrBody(template).problems,
      HEADINGS.map((title) => `La sección «${title}» no tiene contenido.`),
    );
  });

  it("la skill dice que el check no se exime por autor ni por label", () => {
    const skill = readFileSync(skillPath, "utf8");
    assert.match(
      skill,
      /El check de CI no se exime por autor ni por label\. Si un PR de bot, como Dependabot o Renovate, no trae las seis secciones, falla y el mensaje dice qué falta\./,
    );
  });
});

describe("pr-body.yml", () => {
  it("no vuelca el cuerpo en el YAML ni lo interpola en run", () => {
    const yaml = readFileSync(workflowPath, "utf8");
    assert.match(yaml, /^permissions:\n {2}contents: read\n/m);
    assert.match(yaml, /persist-credentials: false/);
    assert.match(
      yaml,
      /actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/,
    );
    assert.match(
      yaml,
      /actions\/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020/,
    );
    assert.match(
      yaml,
      /name: Checkout sin credenciales persistidas \(actions\/checkout v4\.4\.0\)/,
    );
    assert.match(yaml, /name: Setup Node \(actions\/setup-node v4\.4\.0\)/);
    for (const type of ["opened", "edited", "synchronize", "reopened"]) {
      assert.match(yaml, new RegExp(`- ${type}`));
    }
    assert.equal(yaml.includes("github.event.pull_request.body"), false);
    assert.equal(yaml.includes("PR_BODY"), false);
    const runLines = yaml.split("\n").filter((line) => /^\s*run:/.test(line));
    assert.ok(runLines.length > 0);
    for (const line of runLines) {
      assert.equal(line.includes("github.event"), false);
      assert.equal(line.includes("PR_BODY"), false);
      assert.equal(line.includes("${{"), false);
    }
    assert.equal(
      yaml.split("\n").some((line) => /^\s*#/.test(line)),
      false,
    );
  });
});

describe("check-pr-body.mjs como proceso", () => {
  it("al importarse no corre main", () => {
    const cleaned = { ...process.env };
    delete cleaned.PR_BODY;
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `await import(${JSON.stringify(pathToFileURL(script).href)})`,
      ],
      { env: cleaned, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
  });

  it("con cuerpo válido sale 0 y no imprime el cuerpo", () => {
    const marker = "texto-visible-solo-en-el-cuerpo";
    const result = runScript({
      PR_BODY: validBody(HEADINGS.map(() => marker)),
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
  });

  it("sin PR_BODY ni archivo de evento sale 1 y nombra las seis secciones", () => {
    const marker = "no-imprimir-este-argumento";
    const result = runScript({}, [marker]);
    assert.equal(result.status, 1);
    assert.equal(
      result.stderr,
      `${HEADINGS.map((title) => missing(title)).join("\n")}\n`,
    );
    assert.equal(result.stdout, "");
    assert.equal(result.stderr.includes(marker), false);
  });

  it("lee un archivo de evento con cuerpo válido y no lo imprime", () => {
    const marker = "marca-valida-que-no-sale";
    const result = runEvent(validBody(HEADINGS.map(() => marker)));
    assert.equal(result.status, 0, result.stderr.slice(0, 200));
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
    assert.equal(`${result.stdout}${result.stderr}`.includes(marker), false);
  });

  it("lee un archivo de evento con cuerpo vacío y nombra las seis secciones", () => {
    for (const body of ["", null]) {
      const result = runEvent(body);
      assert.equal(result.status, 1);
      assert.equal(
        result.stderr,
        `${HEADINGS.map((title) => missing(title)).join("\n")}\n`,
      );
      assert.equal(result.stdout, "");
    }
  });

  it("lee un archivo de evento con cuerpo malo y dice qué falta", () => {
    const result = runEvent("Actualiza prettier de 3.9.10 a 3.9.11.");
    assert.equal(result.status, 1);
    assert.equal(
      result.stderr,
      `${HEADINGS.map((title) => missing(title)).join("\n")}\n`,
    );
    assert.equal(result.stdout, "");
    assert.equal(result.stderr.includes("prettier"), false);
  });

  it("lee un cuerpo de 1 MiB desde el archivo del evento y no lo imprime", () => {
    const marker = "marca-de-1mib-que-no-sale";
    const core = validBody(["uno", "dos", "tres", "cuatro", "cinco", marker]);
    const target = 1024 * 1024;
    const body = `${core}\n${"x".repeat(target - Buffer.byteLength(`${core}\n`, "utf8"))}`;
    assert.equal(Buffer.byteLength(body, "utf8"), target);
    const result = runEvent(body, { PR_BODY: "esto-no-debe-ganar" });
    assert.equal(result.status, 0, result.stderr.slice(0, 200));
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
    assert.equal(result.stderr.includes(marker), false);
    assert.equal(result.stdout.includes(marker), false);
  });
});
