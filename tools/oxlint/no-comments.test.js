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
