---
phase: 02
slug: a-supported-fork-release
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-07
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| app UI to external web | Every support/attribution anchor opens an external URL in the user's browser | URL only |
| repository to translator platform | `src/locales/en/translation.json` is published to Weblate | Catalog strings |
| CI runner to third-party repository | `.github/workflows/release.yml` checks out `onionviolet/vpkmerge` and builds it with the runner's privileges | Source code, build output |
| dev machine to GitHub release assets | `scripts/fetch-vpkmerge.mjs` downloads a binary over https into `resources/vpkmerge/` | Binary artifact |
| packaged binary to capability attestation | `foundryTextureReplace.ts` trusts a marker file, not binary inspection, to decide texture-replace safety | Marker file presence |
| URL or deep link to page render | A route can be reached by hash, bookmark, or protocol handoff before settings load | Navigation intent |
| renderer store to page state | `settings` arrives asynchronously from the main process; the page renders before it exists | App settings |
| repository docs to user expectation | Shipped documents make claims users rely on | Documentation text |
| unmerged branch to main | External branch commits enter the shipped tree via merge | Source code |
| concurrent worktree agent to repository state | Another agent may be mid-work in a worktree holding the branch being merged | Working-tree state |
| commit message to upstream repository | A bare issue number or upstream link in a commit message posts a permanent backlink in a repo this fork doesn't own | Commit metadata |
| local repository to origin | `git push origin --delete` removes a ref the local repo cannot restore | Git refs |
| reflog retention window | A deleted local branch is recoverable only until the reflog expires | Git history |
| worktree to branch deletion | A dirty worktree holds uncommitted work a forced removal would destroy | Working-tree files |
| packaged client to third-party Worker | Every shipped build sends publish/browse/like traffic to a service this fork does not operate | User-generated content, session data |
| main process to renderer | The social session token lives behind `safeStorage` in the main process | Auth token |
| CI runner to sibling repository | `ci.yml` checks out `Slush97/grimoire-social` at a moving branch ref every run | Source code |
| local disk to consent record | Terms acceptance lives in `localStorage`, per-machine and user-clearable | Consent flag |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01-A | Spoofing | `UpdateModal.tsx` support anchor | medium | mitigate | Hardcoded literal `FORK_ISSUES`, never interpolated; `supportDestinations.test.ts` asserts it | closed |
| T-02-01-B | Tampering | external anchors | low | mitigate | `rel="noreferrer noopener"` + `target="_blank"` on every anchor | closed |
| T-02-01-C | Repudiation | attribution surfaces | high | mitigate | Guard test asserts `discordRpc.ts`/`README.md` still carry upstream links; `fork-maintenance.md` names all four exclusions | closed |
| T-02-01-D | Information disclosure | diagnostic bug report copy | medium | accept | Report sanitizer unchanged; only the named venue changes | closed |
| T-02-SC (01) | Tampering | npm/pip/cargo installs | high | accept | No package-manager install task in this plan | closed |
| T-02-02-A | Tampering | `release.yml` engine checkout | high | mitigate | `check-release-engine-pin.mjs` fails the push unless the ref is a 40-char commit SHA | closed |
| T-02-02-B | Tampering | downloaded stock engine binary | high | mitigate | sha256-verify-then-refuse path in `fetch-vpkmerge.mjs` left byte-identical | closed |
| T-02-02-C | Elevation of privilege | `.ycocg-icon-safe` capability marker | medium | mitigate | Guard asserts both markers written by `use-local-vpkmerge.mjs`; marker deleted on stock install | closed |
| T-02-02-D | Repudiation | `docs/ingame-verification-record.md` | high | mitigate | `check-verification-record.mjs --strict` refuses a pass verdict without a stated reason from the fixed vocabulary | closed |
| T-02-02-E | Tampering | `ci.yml` sibling checkout at `ref: main` | medium | accept | Pre-existing, out of scope, recorded in ADR-018 | closed |
| T-02-SC (02) | Tampering | npm/pip/cargo installs | high | accept | Only a `package.json` script entry added, no dependency | closed |
| T-02-03-A | Elevation of privilege | `ChatWheel.tsx` route reachability | medium | mitigate | Guard lives in the page component, covers every navigation path | closed |
| T-02-03-B | Information disclosure | pre-settings render | low | mitigate | Optional chaining (`settings?.experimentalChatWheel`) falls to disabled state | closed |
| T-02-03-C | Tampering | user's installed chat wheel | medium | mitigate | Render early-return below every hook/handler; save path unreachable when disabled | closed |
| T-02-03-D | Repudiation | `docs/profile-spec.md` | medium | mitigate | Cross-tool compatibility claims removed | closed |
| T-02-SC (03) | Tampering | npm/pip/cargo installs | high | accept | No dependency change | closed |
| T-02-04-A | Denial of service (of work) | worktree `agent-a4ad3a26969f16ebb` | high | mitigate | Blocking checkpoint required explicit "inactive" confirmation before any merge command ran | closed |
| T-02-04-B | Tampering | resolved conflict files | high | mitigate | No conflict markers survive; merge commit `c0571a2` is a real two-parent commit; full gate ran | closed |
| T-02-04-C | Repudiation | merge commit message | medium | mitigate | `pnpm refs:check` gate; no bare issue reference or upstream link | closed |
| T-02-04-D | Denial of service (of work) | uncommitted working-tree changes | medium | mitigate | All 7 dirty paths enumerated live, committed individually per the user's explicit disposition, nothing discarded | closed |
| T-02-SC (04) | Tampering | npm/pip/cargo installs | high | accept | `pnpm-lock.yaml` not touched by the merge | closed |
| T-02-05-A | Denial of service (of work) | local branch deletion | high | mitigate | Every deletion used `git branch -d`, never `-D` | closed |
| T-02-05-B | Denial of service (of work) | remote branch deletion with main unpushed | high | mitigate | User explicitly told main was unpushed; chose push-then-delete | closed |
| T-02-05-C | Denial of service (of work) | dirty worktree removal | medium | mitigate | No forced removal; refusals surfaced and resolved by verification, not force | closed |
| T-02-05-D | Repudiation | deletion commit message | low | mitigate | Commit names what was consolidated; `pnpm refs:check` passed | closed |
| T-02-SC (05) | Tampering | npm/pip/cargo installs | high | accept | Only file touched is a deletion (`docs/merge-plan-upstream-2026-08.md`) | closed |
| T-02-06-A | Repudiation | shipped installer's baked service URL | high | mitigate | ADR-018 names the Worker URL and states this fork does not operate it | closed |
| T-02-06-B | Tampering | `ci.yml` sibling checkout at `ref: main` | high | accept | Pre-existing, deliberately unchanged by D-01, named as a consequence in ADR-018 | closed |
| T-02-06-C | Information disclosure | social session token | medium | accept | Untouched; stays behind `safeStorage` per ADR-011 | closed |
| T-02-06-D | Repudiation | terms acceptance in `localStorage` | medium | mitigate | Placement is a recorded decision (doc-follows-code); text states non-durable, per-machine storage | closed |
| T-02-06-E | Spoofing | availability and view-count rendering | low | mitigate | Absent-vs-null split renders nothing for a dormant service; `dormantService.test.ts` guards both gates | closed |
| T-02-SC (06) | Tampering | npm/pip/cargo installs | high | accept | Only a new test file and two docs changed; sibling repo restored to `main` | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (high) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|--------------|------|
| AR-02-01 | T-02-01-D | Diagnostic report sanitizer unchanged by this plan; only the support venue named in the copy changed | Plan 02-01 (planning-time) | 2026-08-06 |
| AR-02-02a | T-02-02-E | `ci.yml`'s sibling checkout at a moving `ref: main` is pre-existing and out of this phase's scope; carried into ADR-018 | Plan 02-02 (planning-time) | 2026-08-06 |
| AR-02-06a | T-02-06-B | Same `ci.yml` moving-ref soft spot, deliberately left unchanged by D-01; recorded as a named consequence in ADR-018 | Plan 02-06 / ADR-018 | 2026-08-07 |
| AR-02-06b | T-02-06-C | Social session token handling untouched by this phase; remains behind `safeStorage` per ADR-011 | Plan 02-06 (planning-time) | 2026-08-07 |
| AR-SC-01..06 | T-02-SC (each plan) | No package-manager install task or dependency change in any of the six plans; the package-legitimacy gate does not apply | All six plans (planning-time) | 2026-08-06/07 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-07 | 32 | 32 | 0 | gsd-security-auditor (ASVS L1, register authored at plan time across all 6 plans) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-07
