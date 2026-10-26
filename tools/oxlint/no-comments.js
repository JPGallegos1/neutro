import { definePlugin, defineRule } from "@oxlint/plugins";

const LINT_SUPPRESSION_RE =
  /^(?:eslint|oxlint)-(?:disable-next-line|disable-line|disable|enable)(?=$|\s)/;

const LICENSE_BANG_RE =
  /^!(?:[ \t]*@(?:license|preserve)\b|[\s\S]*[\s*]@(?:license|preserve)\b)/;

const DIRECTIVE_BODY_RE =
  /^(?:@ts-|@__PURE__|#__PURE__|@__NO_SIDE_EFFECTS__|#__NO_SIDE_EFFECTS__|prettier-ignore|oxfmt-ignore|@vite-ignore|webpack[A-Z]|v8 ignore|c8 ignore|istanbul ignore|@license\b|@preserve\b|sourceMappingURL|#\s*sourceMappingURL)/;

const TRIPLE_SLASH_DIRECTIVE_RE =
  /^\/\s*<(?:reference|amd-module|amd-dependency)\b/;

const TOKEN_CHAR_RE = /[\w$]/;

export function isAllowedCommentValue(rawValue, commentType) {
  if (
    (commentType === "Block" || commentType == null) &&
    LICENSE_BANG_RE.test(rawValue)
  ) {
    return true;
  }
  const value = rawValue.trim();
  if (TRIPLE_SLASH_DIRECTIVE_RE.test(value)) {
    return true;
  }
  if (LINT_SUPPRESSION_RE.test(value)) {
    return true;
  }
  return DIRECTIVE_BODY_RE.test(value);
}

export function commentRange(comment) {
  if (Array.isArray(comment.range) && comment.range.length === 2) {
    return comment.range;
  }
  return [comment.start, comment.end];
}

export function needsSpaceBetweenNeighbors(before, after) {
  if (!before || !after) {
    return false;
  }
  if (/\s/.test(before) || /\s/.test(after)) {
    return false;
  }
  return TOKEN_CHAR_RE.test(before) && TOKEN_CHAR_RE.test(after);
}

export function removalTextForComment(sourceText, comment) {
  const [start, end] = commentRange(comment);
  const before = start > 0 ? sourceText[start - 1] : "";
  const after = end < sourceText.length ? sourceText[end] : "";
  return needsSpaceBetweenNeighbors(before, after) ? " " : "";
}

const noComments = defineRule({
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: {
      description:
        "Forbid prose, JSDoc, and commented-out code. Keep only tool directives.",
    },
    messages: {
      noComment:
        "Comments are not allowed. Prefer names, types, or tests; delete the comment.",
    },
    schema: [],
  },
  createOnce(context) {
    return {
      Program() {
        const { sourceCode } = context;
        for (const comment of sourceCode.getAllComments()) {
          if (isAllowedCommentValue(comment.value, comment.type)) {
            continue;
          }
          context.report({
            node: comment,
            messageId: "noComment",
            fix(fixer) {
              const [start, end] = commentRange(comment);
              const replacement = removalTextForComment(
                sourceCode.text,
                comment,
              );
              if (replacement === "") {
                return fixer.remove(comment);
              }
              return fixer.replaceTextRange([start, end], replacement);
            },
          });
        }
      },
    };
  },
});

export default definePlugin({
  meta: { name: "neutro" },
  rules: { "no-comments": noComments },
});
