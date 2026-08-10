---
id: SEED-001
status: dormant
planted: 2026-08-10
planted_during: v1.26.20 milestone (verifying)
trigger_when: when planning the next milestone (v1.28) or any new-milestone scan
scope: large
---

# SEED-001: Generic local-install protocol for browser-built VPKs

## Why This Matters

A grimoire:// local-install protocol lets any tool — a web sketch tool, a CLI, the Foundry itself, or a future grimoire-social handoff — deliver a VPK to Grimoire instead of the system Downloads folder. It is the "and more" version of upstream's DeadlockForge bridge and the thing upstream cannot easily build, because they do not have the Foundry that already forges VPKs in-app. It also closes Phase 6's genuinely unsolved question: a community tool (e.g. Pimp My Hideout) builds its VPK client-side, so there is no URL to hand off and the bytes exist only inside an unprivileged guest.

## When to Surface

**Trigger:** when planning the next milestone (v1.28) or any new-milestone scan. It should also surface whenever a new browser-catalog tool that builds VPKs client-side is added.

This seed will surface during `$gsd-new-milestone` when the milestone scope matches.

## Scope Estimate

**Large** — a phase-sized job, not a tweak. An open listener dissolves the single-origin trust anchor that makes upstream's version defensible, so this needs its own threat model (origin policy, payload caps, one-install-at-a-time semantics, refusal paths) and its own security review.

## Breadcrumbs

- Upstream v1.27.0 bridge (commit 1ff6590, absorbed per the merge todo): GET /forge/v1/ping for detection, POST /forge/v1/install for the VPK, Origin allowlist, `application/octet-stream` + `X-Forge-Protocol` (forces CORS preflight), 512 MB body cap, VPK magic verified before install, one confirmation at a time, armed-delay confirm button.
- `src/lib/browserCatalog.ts:38` — Deadlock Forge already listed as a `reference` kind destination.
- `docs/browser-destinations.md:24` — probe recorded as keep.
- `.planning/REQUIREMENTS.md` — REQ-browser-produced-file-handoff (Phase 6): the unsolved sentence "the bytes exist only inside an unprivileged guest" is exactly what a loopback listener answers.
- `electron/main/index.ts:93` — existing loopback-binding precedent (`remote-allow-origins`).
- `electron/main/services/foundryForge.ts` — the Foundry forges VPKs in-app today; a generic protocol would serve it too.
- `.planning/todos/pending/2026-08-10-absorb-upstream-v1-27-verbatim.md` — the verbatim absorb this seed builds on.

## Notes

The split is deliberate: absorb upstream's DeadlockForge-specific bridge byte-identical first (single origin, reviewed, cheap next absorb), and treat the generic protocol as a separate product decision with its own phase, because an allowlist that accepts more than one name stops being a meaningful boundary.
