# Phase 06 API Coverage Declaration

**Decided:** 2026-08-07 (plan-phase, `workflow.api_coverage_gate`)

No external API integration: this phase intercepts Electron's own in-process `will-download` session event and renders a hardcoded list of third-party website URLs inside a sandboxed `<webview>`. There is no SDK, REST client, GraphQL schema, or wire protocol being wrapped, so there is no capability surface to enumerate.

## Why the trigger did not fire

| Candidate | Verdict |
|-----------|---------|
| The destination catalog (`https://gamebanana.com/...`, `https://xkitkatcat.github.io/pimpmyhideout/`, wikis, feeds) | Not an API integration. These are addresses handed to a browser guest for a human to look at. Grimoire parses none of their responses and calls none of their endpoints. |
| `session.on('will-download')` / `DownloadItem.setSavePath()` | Electron runtime API, already an installed dependency (`electron` 35.7.5), not an external service. Covered by RESEARCH.md's Standard Stack table rather than a coverage matrix. |
| `import-custom-mods` IPC contract | Internal main/renderer channel, reused verbatim per D-01. Not external. |
| GameBanana's real API (`electron/main/services/gamebanana.ts`) | Already integrated in earlier work and untouched by this phase. The browser page never calls it. |

## Consequence

No `## Capability Coverage Matrix` is produced for Phase 06, and no INTEGRATE / OPT-OUT rows exist to review. If a later phase adds a real client for any catalog destination (for example, querying Pimp My Hideout for a build manifest rather than embedding its page), that phase re-runs this checkpoint and produces a full matrix.
