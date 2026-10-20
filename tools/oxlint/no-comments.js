import { definePlugin, defineRule } from "@oxlint/plugins";

const DIRECTIVE_RE =
  /^(?:\/|!|@ts-|@__PURE__|#__PURE__|@__NO_SIDE_EFFECTS__|#__NO_SIDE_EFFECTS__|eslint-|oxlint-|global\b|globals\b|exported\b|prettier-ignore|oxfmt-ignore|@vite-ignore|webpack[A-Z]|v8 ignore|c8 ignore|istanbul ignore|@license|@preserve|sourceMappingURL|#\s*sourceMappingURL)/;

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
        for (const comment of context.sourceCode.getAllComments()) {
          if (DIRECTIVE_RE.test(comment.value.trim())) {
            continue;
          }
          context.report({
            node: comment,
            messageId: "noComment",
            fix(fixer) {
              return fixer.remove(comment);
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
