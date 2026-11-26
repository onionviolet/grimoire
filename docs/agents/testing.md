<!-- Source for Codex. Claude Code loads the twin .claude/rules/testing.md by paths: frontmatter. Keep the text below identical in both files. -->
# Tests

- **Tests run on Node 24 in CI** with no DOM. Node provides a global `navigator`, but `window` and `document` are still unavailable. Renderer modules that access DOM APIs at import time can fail every test that transitively imports them. Watch the test count, not just pass/fail.
