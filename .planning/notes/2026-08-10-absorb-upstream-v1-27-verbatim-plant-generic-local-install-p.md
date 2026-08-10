---
date: "2026-08-10 13:40"
promoted: false
---

Decision: absorb all ten upstream v1.27.0 commits verbatim into the fork now, and plant the generic grimoire:// local-install protocol as a v1.28 seed.

Upstream's DeadlockForge bridge is a single-origin trust anchor: the security review that makes it defensible was done against a one-site allowlist, and keeping it byte-identical keeps the next upstream absorb cheap for a fork 481 commits ahead. The generic protocol is the better long-term product (our Foundry already forges VPKs in-app, and Phase 6's unsolved handoff — bytes that exist only inside an unprivileged guest — is exactly what a loopback listener answers), but an allowlist stops being a meaningful boundary the moment it accepts more than one name, so it wants its own threat model and its own phase.

Correction from the exploration: Phases 3–5 are not open; the ROADMAP checkboxes and status rows are stale. All 6 phases executed (32/32 plans), milestone is in verification with real-game checks deferred, and Phase 6's open question is directly answered by the upstream bridge this todo absorbs.

Artifacts: merge todo (absorb upstream v1.27 verbatim) and SEED-001 (generic local-install protocol for v1.28).
