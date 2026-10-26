import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  isAllowedCommentValue,
  needsSpaceBetweenNeighbors,
  removalTextForComment,
} from "./no-comments.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const oxlintBin = join(repoRoot, "node_modules/.bin/oxlint");
const oxlintConfig = join(repoRoot, ".oxlintrc.json");

function oxlintStatus(source) {
  const dir = mkdtempSync(join(tmpdir(), "neutro-no-comments-"));
  const file = join(dir, "sample.js");
  writeFileSync(file, source);
  const result = spawnSync(
    oxlintBin,
    ["-A", "all", "-D", "neutro/no-comments", "-c", oxlintConfig, file],
    { cwd: repoRoot, encoding: "utf8" },
  );
  rmSync(dir, { recursive: true, force: true });
  return result.status;
}

describe("isAllowedCommentValue — triple-slash directives", () => {
  it("allows real TypeScript triple-slash directives on a line comment", () => {
    assert.equal(
      isAllowedCommentValue('/ <reference types="astro/client" />', "Line"),
      true,
    );
    assert.equal(
      isAllowedCommentValue('/ <reference path="./types.d.ts" />', "Line"),
      true,
    );
    assert.equal(
      isAllowedCommentValue('/ <reference lib="esnext" />', "Line"),
      true,
    );
    assert.equal(
      isAllowedCommentValue('/ <amd-module name="app" />', "Line"),
      true,
    );
    assert.equal(
      isAllowedCommentValue('/ <amd-dependency path="lib" />', "Line"),
      true,
    );
  });

  it("rejects prose that only looks like a triple-slash comment", () => {
    assert.equal(
      isAllowedCommentValue("/ Explain this mapping", "Line"),
      false,
    );
    assert.equal(
      isAllowedCommentValue("/ temporary workaround", "Line"),
      false,
    );
    assert.equal(isAllowedCommentValue("// not a directive", "Line"), false);
    assert.equal(isAllowedCommentValue("/ <not-a-directive />", "Line"), false);
  });

  it("rejects a block comment even when the body looks like a triple-slash directive", () => {
    assert.equal(
      isAllowedCommentValue('/ <reference types="astro/client" />', "Block"),
      false,
      "triple-slash is a line directive",
    );
    assert.equal(
      isAllowedCommentValue("/ <reference prosa", "Block"),
      false,
      "a block / <reference prosa is not a line directive",
    );
  });
});

describe("isAllowedCommentValue — other tool directives", () => {
  it("allows @ts- and oxlint suppressions", () => {
    assert.equal(isAllowedCommentValue("@ts-expect-error intentional"), true);
    assert.equal(isAllowedCommentValue("oxlint-disable-next-line foo"), true);
  });

  it("rejects ordinary prose and JSDoc bodies", () => {
    assert.equal(isAllowedCommentValue("Explain this mapping"), false);
    assert.equal(isAllowedCommentValue("* QR redirect mapping"), false);
  });
});

describe("isAllowedCommentValue — lint suppressions", () => {
  it("allows disable and enable when the keyword is complete", () => {
    assert.equal(isAllowedCommentValue("eslint-disable"), true);
    assert.equal(isAllowedCommentValue("eslint-disable no-console"), true);
    assert.equal(isAllowedCommentValue("eslint-disable-line no-console"), true);
    assert.equal(
      isAllowedCommentValue("eslint-disable-next-line no-console"),
      true,
    );
    assert.equal(isAllowedCommentValue("eslint-enable no-console"), true);
    assert.equal(isAllowedCommentValue("oxlint-disable"), true);
    assert.equal(isAllowedCommentValue("oxlint-disable-line foo"), true);
    assert.equal(isAllowedCommentValue("oxlint-disable-next-line foo"), true);
    assert.equal(
      isAllowedCommentValue("oxlint-disable-next-line no-console -- motivo"),
      true,
    );
    assert.equal(isAllowedCommentValue("oxlint-disable\n  no-console"), true);
    assert.equal(isAllowedCommentValue("oxlint-enable"), true);
    assert.equal(isAllowedCommentValue(" eslint-disable no-console "), true);
  });

  it("rejects prefixes and typos that are not a suppression keyword", () => {
    assert.equal(
      isAllowedCommentValue("eslint-plugin-react"),
      false,
      "eslint-plugin is not a suppression",
    );
    assert.equal(
      isAllowedCommentValue(" eslint-env node"),
      false,
      "eslint-env is not disable or enable",
    );
    assert.equal(
      isAllowedCommentValue("eslint-disablefoo"),
      false,
      "keyword must end or be followed by whitespace",
    );
    assert.equal(isAllowedCommentValue("eslint-disable-next"), false);
    assert.equal(isAllowedCommentValue("oxlint-is great"), false);
    assert.equal(isAllowedCommentValue("oxlint-disable-everything"), false);
    assert.equal(isAllowedCommentValue("oxlint-enable-next-line foo"), false);
    assert.equal(
      isAllowedCommentValue("eslint-ignore"),
      false,
      "eslint-ignore is not a suppression",
    );
    assert.equal(
      isAllowedCommentValue("oxlint-ignore"),
      false,
      "oxlint-ignore is not a suppression",
    );
    assert.equal(
      isAllowedCommentValue("  oxlint-ignore something"),
      false,
      "oxlint-ignore is not a suppression",
    );
    assert.equal(
      isAllowedCommentValue("oxlint-ignore-this-prose"),
      false,
      "oxlint-ignore is not a suppression",
    );
    assert.equal(isAllowedCommentValue("oxlint-ignore-next-line foo"), false);
  });
});

describe("isAllowedCommentValue — global and exported", () => {
  it("rejects legacy global, globals, and exported comments", () => {
    assert.equal(
      isAllowedCommentValue(" global state de la sesión"),
      false,
      "prose that starts with global is not a directive",
    );
    assert.equal(isAllowedCommentValue(" global foo "), false);
    assert.equal(isAllowedCommentValue(" globals foo:true "), false);
    assert.equal(isAllowedCommentValue("globals for the file"), false);
    assert.equal(isAllowedCommentValue(" exported helpers "), false);
    assert.equal(isAllowedCommentValue("exported Foo"), false);
  });
});

describe("isAllowedCommentValue — license banners", () => {
  it("allows @license, @preserve, and a /*! block whose first word is the marker", () => {
    assert.equal(isAllowedCommentValue(" @license MIT "), true);
    assert.equal(isAllowedCommentValue("@license"), true);
    assert.equal(isAllowedCommentValue(" @preserve "), true);
    assert.equal(isAllowedCommentValue("@preserve"), true);
    assert.equal(
      isAllowedCommentValue("! @license MIT ", "Block"),
      true,
      "/*! @license */ is the preserve banner",
    );
    assert.equal(isAllowedCommentValue("!@preserve", "Block"), true);
    assert.equal(
      isAllowedCommentValue("!\n * @license MIT\n ", "Block"),
      true,
      "multiline /*! banner whose first word is @license",
    );
    assert.equal(isAllowedCommentValue("!\n *@preserve\n", "Block"), true);
  });

  it("rejects bang prose, line bangs, and markers that are not at the start", () => {
    assert.equal(
      isAllowedCommentValue(" !importante", "Line"),
      false,
      "// !importante is prose",
    );
    assert.equal(
      isAllowedCommentValue("!importante", "Line"),
      false,
      "//!importante is prose",
    );
    assert.equal(isAllowedCommentValue(" ! importante", "Line"), false);
    assert.equal(
      isAllowedCommentValue("! nota ", "Block"),
      false,
      "/*! nota */ has no @license or @preserve",
    );
    assert.equal(
      isAllowedCommentValue("!\n * Copyright (c) 2026\n ", "Block"),
      false,
      "copyright-only /*! header is not @license or @preserve",
    );
    assert.equal(
      isAllowedCommentValue("! @license MIT", "Line"),
      false,
      "//! @license is not a /*! banner",
    );
    assert.equal(
      isAllowedCommentValue(" ! @license MIT ", "Block"),
      false,
      "/* ! @license */ does not start the raw body with !",
    );
    assert.equal(
      isAllowedCommentValue("* @license MIT ", "Block"),
      false,
      "/** @license */ still starts with a star",
    );
    assert.equal(isAllowedCommentValue("@licenseFoo"), false);
    assert.equal(isAllowedCommentValue("@preserveFoo"), false);
    assert.equal(isAllowedCommentValue("!@licenseFoo", "Block"), false);
    assert.equal(
      isAllowedCommentValue("! nota sobre @license ", "Block"),
      false,
      "prose before @license is not a banner",
    );
    assert.equal(
      isAllowedCommentValue("! texto\n * @license ", "Block"),
      false,
      "multiline prose before @license is not a banner",
    );
    assert.equal(
      isAllowedCommentValue("! @licensefoo ", "Block"),
      false,
      "@licensefoo is not the marker",
    );
    assert.equal(
      isAllowedCommentValue("!(@license MIT)", "Block"),
      false,
      "a parenthesis is not formatting space or an asterisk",
    );
  });
});

describe("isAllowedCommentValue — directive word boundaries", () => {
  it("allows the four @ts directives and rejects prose with that prefix", () => {
    assert.equal(isAllowedCommentValue("@ts-expect-error reason"), true);
    assert.equal(isAllowedCommentValue("@ts-ignore reason"), true);
    assert.equal(isAllowedCommentValue("@ts-nocheck"), true);
    assert.equal(isAllowedCommentValue("@ts-check"), true);
    assert.equal(isAllowedCommentValue("@ts-esto-es-prosa"), false);
  });

  it("allows prettier-ignore and rejects prettier-ignoreAlgo", () => {
    assert.equal(isAllowedCommentValue("prettier-ignore"), true);
    assert.equal(isAllowedCommentValue("prettier-ignoreAlgo"), false);
  });

  it("allows oxfmt-ignore and rejects oxfmt-ignoreAlgo", () => {
    assert.equal(isAllowedCommentValue("oxfmt-ignore"), true);
    assert.equal(isAllowedCommentValue("oxfmt-ignoreAlgo"), false);
  });

  it("allows @vite-ignore and rejects @vite-ignoreAlgo", () => {
    assert.equal(isAllowedCommentValue("@vite-ignore"), true);
    assert.equal(isAllowedCommentValue("@vite-ignoreAlgo"), false);
  });

  it("allows v8 ignore and rejects v8 ignoreAlgo", () => {
    assert.equal(isAllowedCommentValue("v8 ignore next"), true);
    assert.equal(isAllowedCommentValue("v8 ignoreAlgo"), false);
  });

  it("allows c8 ignore and rejects c8 ignoreAlgo", () => {
    assert.equal(isAllowedCommentValue("c8 ignore next"), true);
    assert.equal(isAllowedCommentValue("c8 ignoreAlgo"), false);
  });

  it("allows istanbul ignore and rejects istanbul ignoreAlgo", () => {
    assert.equal(isAllowedCommentValue("istanbul ignore next"), true);
    assert.equal(isAllowedCommentValue("istanbul ignoreAlgo"), false);
  });

  it("allows sourceMappingURL and rejects sourceMappingURLAlgo", () => {
    assert.equal(isAllowedCommentValue("sourceMappingURL=app.js.map"), true);
    assert.equal(isAllowedCommentValue("# sourceMappingURL=app.js.map"), true);
    assert.equal(isAllowedCommentValue("sourceMappingURLAlgo"), false);
    assert.equal(isAllowedCommentValue("# sourceMappingURLAlgo"), false);
  });

  it("allows webpack magic names and rejects webpackZprosa", () => {
    assert.equal(isAllowedCommentValue("webpackChunkName: 'app'"), true);
    assert.equal(isAllowedCommentValue("webpackIgnore: true"), true);
    assert.equal(isAllowedCommentValue("webpackZprosa"), false);
  });

  it("allows purity markers and rejects a glued suffix", () => {
    assert.equal(isAllowedCommentValue("@__PURE__"), true);
    assert.equal(isAllowedCommentValue("#__PURE__"), true);
    assert.equal(isAllowedCommentValue("@__PURE__foo"), false);
    assert.equal(isAllowedCommentValue("#__PURE__foo"), false);
  });
});

describe("isAllowedCommentValue — remaining tool directives", () => {
  it("keeps formatter, bundler, coverage, purity, and source map markers", () => {
    assert.equal(isAllowedCommentValue("prettier-ignore"), true);
    assert.equal(isAllowedCommentValue("oxfmt-ignore"), true);
    assert.equal(isAllowedCommentValue("@vite-ignore"), true);
    assert.equal(isAllowedCommentValue("webpackChunkName: 'app'"), true);
    assert.equal(isAllowedCommentValue("v8 ignore next"), true);
    assert.equal(isAllowedCommentValue("c8 ignore next"), true);
    assert.equal(isAllowedCommentValue("istanbul ignore next"), true);
    assert.equal(isAllowedCommentValue("@__PURE__"), true);
    assert.equal(isAllowedCommentValue("#__PURE__"), true);
    assert.equal(isAllowedCommentValue("@__NO_SIDE_EFFECTS__"), true);
    assert.equal(isAllowedCommentValue("#__NO_SIDE_EFFECTS__"), true);
    assert.equal(isAllowedCommentValue("sourceMappingURL=app.js.map"), true);
    assert.equal(isAllowedCommentValue("# sourceMappingURL=app.js.map"), true);
  });
});

describe("removalTextForComment — token boundaries", () => {
  it("inserts a space when neighbors would merge into one token", () => {
    const source = "typeof/* explanation */value";
    const comment = { range: [6, 23], value: " explanation " };
    assert.equal(removalTextForComment(source, comment), " ");
    assert.equal(
      source.slice(0, 6) +
        removalTextForComment(source, comment) +
        source.slice(23),
      "typeof value",
    );
  });

  it("inserts a space for return/*x*/x", () => {
    const source = "return/*x*/x";
    const comment = { range: [6, 11], value: "x" };
    assert.equal(removalTextForComment(source, comment), " ");
  });

  it("removes bare when neighbors are not both token characters", () => {
    const source = "a+/*x*/b";
    const comment = { range: [2, 7], value: "x" };
    assert.equal(removalTextForComment(source, comment), "");
    assert.equal(
      source.slice(0, 2) +
        removalTextForComment(source, comment) +
        source.slice(7),
      "a+b",
    );
  });

  it("removes bare when a neighbor is already whitespace", () => {
    const source = "foo /*x*/ bar";
    const comment = { range: [4, 9], value: "x" };
    assert.equal(removalTextForComment(source, comment), "");
  });
});

describe("oxlint binary", () => {
  const accepted = [
    "const kept = 1;",
    "/*! @license MIT */",
    "/*!",
    " * @license MIT",
    " */",
    "/*! @preserve */",
    '/// <reference types="astro/client" />',
    "// @ts-expect-error reason",
    "// @ts-ignore reason",
    "// @ts-nocheck",
    "// @ts-check",
    "// prettier-ignore",
    "// oxfmt-ignore",
    "// @vite-ignore",
    'import(/* webpackChunkName: "app" */ "./app.js");',
    "// v8 ignore next",
    "// c8 ignore next",
    "// istanbul ignore next",
    "const pure = /* @__PURE__ */ kept;",
    "/*#__PURE__*/",
    "/* @__NO_SIDE_EFFECTS__ */",
    "/*#__NO_SIDE_EFFECTS__*/",
    "//# sourceMappingURL=app.js.map",
    "// oxlint-disable-next-line no-console",
    "kept;",
  ].join("\n");

  const rejected = [
    [
      "prose before @license",
      "const value = 1;\n/*! nota sobre @license */\nvalue;\n",
    ],
    [
      "multiline prose before @license",
      "const value = 1;\n/*! texto\n * @license */\nvalue;\n",
    ],
    ["glued @licensefoo", "const value = 1;\n/*! @licensefoo */\nvalue;\n"],
    [
      "parenthesis before @license",
      "const value = 1;\n/*!(@license MIT)*/\nvalue;\n",
    ],
    ["@ts prose", "const value = 1;\n// @ts-esto-es-prosa\nvalue;\n"],
    [
      "prettier-ignoreAlgo",
      "const value = 1;\n// prettier-ignoreAlgo\nvalue;\n",
    ],
    ["oxfmt-ignoreAlgo", "const value = 1;\n// oxfmt-ignoreAlgo\nvalue;\n"],
    ["@vite-ignoreAlgo", "const value = 1;\n// @vite-ignoreAlgo\nvalue;\n"],
    ["v8 ignoreAlgo", "const value = 1;\n// v8 ignoreAlgo\nvalue;\n"],
    ["c8 ignoreAlgo", "const value = 1;\n// c8 ignoreAlgo\nvalue;\n"],
    [
      "istanbul ignoreAlgo",
      "const value = 1;\n// istanbul ignoreAlgo\nvalue;\n",
    ],
    [
      "sourceMappingURLAlgo",
      "const value = 1;\n// sourceMappingURLAlgo\nvalue;\n",
    ],
    ["webpackZprosa", "const value = 1;\n/* webpackZprosa */\nvalue;\n"],
    [
      "block triple-slash",
      "const value = 1;\n/* / <reference prosa */\nvalue;\n",
    ],
  ];

  it("exits 0 for allowed directives and non-zero for each rejected comment", () => {
    const allowedStatus = oxlintStatus(accepted);
    assert.equal(typeof allowedStatus, "number", "oxlint did not exit");
    assert.equal(allowedStatus, 0, "allowed directives stay exit 0");
    for (const [label, source] of rejected) {
      const status = oxlintStatus(source);
      assert.equal(typeof status, "number", `${label}: oxlint did not exit`);
      assert.notEqual(status, 0, label);
    }
  });
});

describe("needsSpaceBetweenNeighbors", () => {
  it("is true only for glueable token characters", () => {
    assert.equal(needsSpaceBetweenNeighbors("f", "v"), true);
    assert.equal(needsSpaceBetweenNeighbors("$", "_"), true);
    assert.equal(needsSpaceBetweenNeighbors("+", "b"), false);
    assert.equal(needsSpaceBetweenNeighbors("a", " "), false);
    assert.equal(needsSpaceBetweenNeighbors("", "a"), false);
  });
});
