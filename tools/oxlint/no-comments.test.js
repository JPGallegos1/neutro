import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isAllowedCommentValue,
  needsSpaceBetweenNeighbors,
  removalTextForComment,
} from "./no-comments.js";

describe("isAllowedCommentValue — triple-slash directives", () => {
  it("allows real TypeScript triple-slash directives", () => {
    assert.equal(
      isAllowedCommentValue('/ <reference types="astro/client" />'),
      true,
    );
    assert.equal(
      isAllowedCommentValue('/ <reference path="./types.d.ts" />'),
      true,
    );
    assert.equal(isAllowedCommentValue('/ <reference lib="esnext" />'), true);
    assert.equal(isAllowedCommentValue('/ <amd-module name="app" />'), true);
    assert.equal(
      isAllowedCommentValue('/ <amd-dependency path="lib" />'),
      true,
    );
  });

  it("rejects prose that only looks like a triple-slash comment", () => {
    assert.equal(isAllowedCommentValue("/ Explain this mapping"), false);
    assert.equal(isAllowedCommentValue("/ temporary workaround"), false);
    assert.equal(isAllowedCommentValue("// not a directive"), false);
    assert.equal(isAllowedCommentValue("/ <not-a-directive />"), false);
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
  it("allows @license, @preserve, and a /*! block that contains them", () => {
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
      "multiline /*! banner that contains @license",
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

describe("needsSpaceBetweenNeighbors", () => {
  it("is true only for glueable token characters", () => {
    assert.equal(needsSpaceBetweenNeighbors("f", "v"), true);
    assert.equal(needsSpaceBetweenNeighbors("$", "_"), true);
    assert.equal(needsSpaceBetweenNeighbors("+", "b"), false);
    assert.equal(needsSpaceBetweenNeighbors("a", " "), false);
    assert.equal(needsSpaceBetweenNeighbors("", "a"), false);
  });
});
