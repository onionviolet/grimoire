---
paths:
  - "scripts/check-encoding.mjs"
  - "scripts/check-encoding.test.ts"
---
<!-- Twin of docs/agents/encoding.md (read by Codex). Keep the text below identical in both files. -->
# Source encoding gate

`pnpm encoding:check` (CI `ci.yml` + husky `pre-push`) fails on cp1252-round-tripped text. v1.26.1 shipped 77 such sequences: UTF-8 bytes were decoded as Windows-1252 and re-encoded, so a middle dot rendered as two characters and an ellipsis as three, over 1500 times in the Foundry sound catalog alone. It is invisible in diff review, and it had already recurred once by hand before the gate existed.

- The detector must stay **cp1252**-aware, not Latin-1-aware. Bytes 0x80-0x9F map through the cp1252 table, so a Latin-1-only check would catch only the U+00C2 family (3 of the 77).
- `scripts/check-encoding.mjs` is **pure ASCII on purpose** and a test enforces it. Every character it hunts for is written as a numeric escape, otherwise the checker trips its own check and becomes a carrier for the corruption.
- If it fires, restore the intended character rather than deleting it, then find the editor or tool that wrote the file, because it will keep doing this.
