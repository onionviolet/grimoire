# Agent UI Lab plan

## Purpose

Build an opt-in **Agent UI Lab** inside the real Electron application so a local
AI agent can inspect and operate Grimoire's actual rendered UI. This is for UI
quality assurance: responsive layouts, keyboard focus, empty/loading states, and
normal app-owned workflows.

It is not a way to expose the Electron preload API to a browser, and it must not
provide arbitrary code execution, direct IPC access, filesystem access, or
unattended destructive operations.

### Why this exists when `scripts/dev-driver.mjs` already exists

The repo can already drive a running dev build: `dev-driver.mjs` attaches over
the Chrome DevTools Protocol and evaluates arbitrary JavaScript in the renderer
(`GRIMOIRE_DEV_CDP_PORT`, see `electron/main/index.ts`). So "an agent can see the
UI" is already solved in development, and the Agent UI Lab is **not** additive
capability. It is a strictly narrower replacement with a different threat model:

| | dev-driver (CDP) | Agent UI Lab |
| --- | --- | --- |
| Capability | arbitrary renderer eval | allow-listed structured commands |
| Gate | env var at launch | user toggle at runtime, revocable |
| Audience | the developer's own machine | any local agent the user connects |
| Shippable | never | possibly, behind a fork/build flag |

The value proposition is therefore: *an agent surface safe enough to hand to a
process you do not fully trust, and potentially safe enough to ship*. If the only
consumer is ever a developer running the repo locally, dev-driver is cheaper and
this plan is not worth building. Confirm that framing before starting.

Decide explicitly (see Open questions): does dev-driver survive alongside the
Lab, or does the Lab replace it?

## Product decision

Do not solve this with a portable build or a browser-only mock of the app.

- A portable Electron build is still a native window that ordinary browser
  automation cannot control.
- A renderer mock is useful for fixtures, but cannot verify the real Electron UI
  or its app lifecycle.
- The preferred solution is a real-app, loopback-only control plane with an
  explicit local user opt-in.

## Non-goals

- A general-purpose browser-automation framework. If a check needs arbitrary
  selectors or eval, it belongs in dev-driver or a unit test, not here.
- Testing main-process behavior (installs, extraction, VPK work). The Lab drives
  UI only.
- Cross-machine or remote control of any kind.
- Replacing Vitest. The Lab covers what a jsdom test cannot: real layout, real
  focus order, real Chromium input.

## Phase 0: derisking spike (do this first)

Three assumptions carry most of the technical risk and are cheap to test in a
throwaway branch before committing to the full design. Timebox to a day.

1. **Input synthesis without CDP.** Confirm `webContents.sendInputEvent` can
   deliver a real click and a real keystroke to the renderer, at viewport
   coordinates, with the window unfocused and possibly occluded. Confirm the
   resulting DOM events are trusted enough for React handlers and for native
   focus movement (`Tab` order, `:focus-visible`).
2. **Narrow viewport.** Confirm the window can actually reach the target widths.
   The app sets a `minWidth`; device emulation is a CDP feature and is out of
   scope, so narrow widths mean genuinely resizing the `BrowserWindow` with the
   minimum temporarily relaxed for the session. Verify CSS media queries fire.
3. **Accessible-name extraction.** Confirm a usable name can be derived for
   Grimoire's real controls (many are icon-only) without pulling in a heavy a11y
   library.

If (1) or (2) fails, the plan's core promise (real keyboard focus and real
responsive checks) does not hold and the design needs to change before phase 1.

## User-facing toggle

Add **Allow local agent UI inspection** under Developer Mode / Experimental
Features in Settings (`src/pages/Settings.tsx`).

Requirements:

- Require Developer Mode to be enabled.
- Explain that a local agent can inspect and operate the app UI, but does not
  receive the normal Electron API.
- Show active/inactive state, an expiry/inactivity countdown, and a
  **Disconnect agent** control.
- Provide a copyable local connection command only while active.
- Keep transient port/token/session details in memory; never persist them in app
  settings.
- Automatically disconnect on toggle-off, app quit, token expiry, or inactivity.
- Enable in development builds first. Packaged fork builds may support it only
  behind an explicit build flag. Stock production releases should compile it out
  or keep it unavailable.
- All new strings go in `src/locales/en/translation.json` with real keys, per the
  i18n rules in `CLAUDE.md`. `pnpm i18n:check` and `pnpm i18n:manifest` are gates.

Persistent setting, alongside the existing `experimental*` flags in
`src/types/mod.ts`:

```ts
/** Agent UI Lab: opt-in loopback service that lets a local agent inspect and
 *  operate the app UI. Requires Developer Mode. Never exposes the preload API.
 *  The setting only permits a session; the session itself is never persisted. */
experimentalAgentUiLab?: boolean;
```

The flag is *permission to start a session*, not session state. A fresh launch
with the flag on must still start disconnected, with no port and no token, until
the user explicitly starts a session.

## Security model

The Agent UI Lab must be a separate, narrow loopback service owned by the main
process. It is never a browser-facing clone of `window.electronAPI`.

### Threat model

Assume the connecting agent is **semi-trusted**: it is local and user-invoked,
but it may act on instructions from content it read (a mod description, a web
page, a file). The design must therefore hold up when the agent is actively
adversarial for a bounded window, not merely careless. Concretely, an agent that
does the worst thing the API permits must not be able to exfiltrate user data,
mutate game files without a human click, or persist access past the session.

Out of scope: an attacker with local code execution as the user (they already
have everything), and a malicious build of Grimoire itself.

### Transport

- HTTP/1.1 over `127.0.0.1` only, JSON request and response bodies. No WebSocket
  in phases 1 to 3: every command is request/response, and nothing needs server
  push. Revisit only if a streaming console feed becomes necessary.
- Bind explicitly to `127.0.0.1` (not `0.0.0.0`, not `::`) on an ephemeral random
  port.
- Require a fresh, cryptographically random 256-bit bearer token, compared with a
  constant-time comparison. Regenerate per session; never reuse.
- **Reject any request carrying an `Origin` header.** A CLI does not send one; a
  browser page always does. This is the primary defense against a malicious web
  page in the user's browser probing loopback ports.
- **Validate the `Host` header** matches `127.0.0.1:<port>`. This blocks DNS
  rebinding, where a hostile domain resolves to 127.0.0.1 and the `Origin` check
  alone would not save a preflight-free request.
- Reject non-loopback peer addresses at the socket level as defense in depth.
- Enforce one connected client. A second authenticated client is refused, not
  queued.
- Explicit absolute expiry and inactivity timeout (initial recommendation: 15
  minutes each, both enforced).
- Serialize commands: one in flight at a time, with a bounded queue and a
  per-command timeout. This keeps snapshot generations coherent.
- Rate limit commands (a simple token bucket) so a runaway agent cannot wedge the
  UI thread.
- Record a concise local audit log of agent actions while a session is active.

### Protocol shape

A single command endpoint keeps the surface auditable:

```
POST /v1/command
Authorization: Bearer <token>
Content-Type: application/json

{ "id": "c-17", "type": "click", "generation": 42, "nodeId": "aui-42" }
```

```json
{ "id": "c-17", "ok": true, "generation": 43, "result": {} }
```

Errors are typed, never free-form strings, so a client can branch on them:
`UNAUTHORIZED`, `SESSION_EXPIRED`, `BUSY`, `UNKNOWN_COMMAND`, `STALE_GENERATION`,
`NODE_NOT_FOUND`, `NODE_NOT_ACTIONABLE`, `ROUTE_NOT_ALLOWED`, `TIMEOUT`,
`RATE_LIMITED`.

`GET /v1/status` is the one unauthenticated route, and it returns only
`{ "service": "grimoire-agent-ui-lab", "sessionActive": true|false }`. Nothing
identifying, so that a port scan learns nothing useful.

### Allowed capabilities

- inspect current route, title, viewport, and a sanitized semantic UI tree;
- capture a screenshot;
- set a testing viewport size;
- focus, click, type, press keys, and scroll through declared UI nodes;
- navigate only to in-app Grimoire routes (allow-listed against the router's
  known route table, hash routes only, no external URLs, no query smuggling);
- wait for an app-owned UI state, from an allow-listed predicate set;
- read a limited, non-sensitive renderer console error feed.

### Explicitly disallowed capabilities

- exposing `window.electronAPI`;
- arbitrary renderer JavaScript execution;
- Chrome DevTools Protocol access;
- direct IPC invocation;
- filesystem paths, environment variables, cookies, clipboard, saved tokens, or
  raw persisted settings;
- silent install, export, delete, or game-mutating shortcuts;
- continuing access once the user disables the lab.

Normal app buttons may perform their normal work after an agent clicks them, but
destructive workflows must keep their existing user-facing confirmation steps.

### The confirmation gap

"Destructive confirmations remain intact" is necessary but not sufficient: an
agent that can click can also click *Confirm*. The existing dialogs stop
accidents, not a determined agent.

Pick one, and state it here rather than leaving it implicit:

- **(a) Accept it.** The session is short, user-initiated, audited, and revocable;
  the blast radius is the same as handing someone your mouse for 15 minutes.
  Cheapest, and probably right for a dev tool.
- **(b) Two-tier consent.** Nodes inside a confirmation surface are marked
  `destructive` in the snapshot, and clicking one requires the session to have
  been started in an explicit "allow destructive" mode. Default off.
- **(c) Human-in-the-loop.** Clicking a `destructive` node raises an in-app
  prompt the human must accept. Safest, and makes unattended runs impossible,
  which defeats much of the point.

Recommendation: **(b)**. It costs one session flag and one snapshot field, keeps
unattended runs viable for the common case, and makes "the agent deleted my mods"
require a deliberate user choice.

## Architecture

### Main-process broker

Create:

- `electron/main/services/agentUiLab.ts` (session lifecycle, HTTP server, auth,
  audit log, input synthesis, window sizing, screenshots)
- `electron/main/ipc/agentUiLab.ts` (renderer-facing status/start/stop for the
  Settings UI, plus the internal channel to the renderer adapter)

The service owns lifecycle, loopback transport, authentication, session state,
and interaction with the real app window. The renderer never owns the token, and
the Settings page never sees it (it receives a pre-formatted connection command
string from main).

Keep the module import-clean: when the build flag is off, the service must be
tree-shakeable or stubbed so stock releases carry no listener code.

### Input synthesis: real Chromium events, not DOM dispatch

Interaction happens in the **main process** via `webContents.sendInputEvent`,
using coordinates the renderer adapter reports for the target node. It does not
happen by calling `element.click()` in the renderer.

This matters because the whole point is testing real focus and keyboard behavior.
Synthetic DOM dispatch produces untrusted events, sidesteps native focus
movement, needs value-setter hacks for React controlled inputs, and would happily
"click" a node covered by an overlay. Real input events go through Chromium's own
hit testing, so an obscured control legitimately fails.

Consequences to design for:

- The adapter must return **hit-testable** bounds and refuse nodes that are
  offscreen, zero-size, `visibility: hidden`, or covered at their center point.
- Coordinates are viewport CSS pixels; the service must account for zoom factor
  and any window chrome offset when translating.
- Typing is a sequence of `keyDown`/`char`/`keyUp` events, which is slow for long
  strings. Provide `fill` (focus the node, select-all, then type) and accept the
  cost; do not add a set-value shortcut that bypasses input events.
- `focus` is the one exception: it may be delegated to the adapter calling
  `.focus()`, since there is no coordinate-based equivalent.

### Renderer adapter

Create:

- `src/agent-ui-lab/rendererAdapter.ts`

Enable the adapter only while an Agent UI Lab session is active (dynamically
imported on session start, so nothing ships in the normal render path). It
assigns temporary IDs to visible interactive controls and supplies a sanitized
accessibility-like snapshot:

```ts
type AgentNode = {
  id: string;                 // 'aui-42', valid only within `generation`
  role: string;               // allow-listed roles only
  name: string;               // accessible name, sanitized and truncated
  value?: string;             // omitted for password/secret-ish inputs
  disabled?: boolean;
  focused?: boolean;
  destructive?: boolean;      // inside a confirmation surface (see consent tier)
  bounds: { x: number; y: number; width: number; height: number };
};

type AgentSnapshot = {
  generation: number;         // increments on every DOM-settling command
  route: string;
  title: string;
  viewport: { width: number; height: number };
  nodes: AgentNode[];         // capped; truncation is reported, never silent
  truncated?: { omitted: number };
};
```

**ID staleness.** IDs are scoped to a generation. Commands carry the generation
they were planned against; a mismatch returns `STALE_GENERATION` instead of
acting on a moved element. Before acting, the adapter re-verifies that the node
still matches the role and name it advertised, and returns `NODE_NOT_FOUND` if
not. Silently clicking whatever is now at those coordinates is the failure mode
this prevents.

**Settling.** After each action the adapter waits for a bounded settle window
(microtask flush, then two animation frames, then a short idle) before the
service responds with a fresh generation. Cap it and report a `TIMEOUT` rather
than waiting indefinitely on an animation.

The adapter accepts only structured commands:

```ts
{ type: 'snapshot' }
{ type: 'click', nodeId: 'aui-42', generation: 42 }
{ type: 'fill', nodeId: 'aui-43', generation: 42, text: 'query' }
{ type: 'press', key: 'Tab', modifiers?: ['Shift'] }
{ type: 'scroll', nodeId: 'aui-44', generation: 42, dy: 400 }
{ type: 'setViewport', width: 390, height: 844 }
{ type: 'navigate', route: '/locker' }
{ type: 'waitFor', predicate: { kind: 'nodeNamed', name: 'Apply' }, timeoutMs: 5000 }
{ type: 'scenario', page: 'locker', mode: 'empty' }
```

`press` accepts an allow-listed key set (navigation, editing, and printable
characters). `waitFor` accepts only `nodeNamed`, `nodeGone`, `routeIs`, and
`textPresent`, each with a capped timeout.

Do not accept arbitrary CSS selectors, JavaScript source, or generic IPC method
names.

### Snapshot sanitization

The snapshot is the main exfiltration channel, so it is an allow-list, not a
denylist. Rules:

- Include only allow-listed roles (button, link, textbox, checkbox, radio,
  combobox, tab, menuitem, heading, dialog, and a small set more). Everything
  else is skipped, and its children are still walked.
- `name` comes from the accessible name (`aria-label`, associated `<label>`,
  `title`, then trimmed text content), collapsed to one line and truncated
  (recommendation: 120 chars).
- Redact before emitting: absolute filesystem paths, drive letters, UNC paths,
  URLs, Steam IDs, anything 16+ chars of hex or base64. Replace with `[redacted]`
  rather than dropping the node, so structure stays intelligible.
- Never emit `value` for `type="password"`, nodes marked `data-agent-lab="deny"`,
  or any node inside a deny-marked subtree. Provide that attribute as the escape
  hatch for surfaces that show user data (Stats identity, Settings paths, share
  codes).
- Never emit `src`, `href`, `id`, `class`, `data-*`, or any DOM-native attribute.
- Cap total nodes (recommendation: 500) and report the omitted count.

The sanitizer is a pure function over a plain node description. Keep it that way:
it is the single most testable and most security-relevant piece of the feature.

### Viewport control

There is no device emulation without CDP. `setViewport` resizes the real
`BrowserWindow`:

- Record the pre-session bounds and `minWidth`/`minHeight`, relax the minimums for
  the session, and restore both on disconnect (including on crash-path cleanup).
- Convert requested content size to window size (`setContentSize`), so the
  numbers mean what the CSS means.
- Clamp to what the display allows, and return the size actually achieved rather
  than the size requested. An agent that asked for 390 and silently got 800 will
  report a passing responsive check that is a lie.
- DPI scaling is not emulated. Note it as a known gap.

### Console feed

Subscribe to `webContents` `console-message` while a session is active. Keep a
bounded ring buffer (recommendation: 100) of `warn` and `error` only, run each
message through the same redaction as snapshot names, and strip stack frames to
`file:line` basenames. No `log`/`info`, since those are where apps print state
dumps.

### Agent client

Deliver a thin local CLI first, then a Codex MCP/plugin wrapper.

Suggested CLI surface:

```powershell
pnpm agent-ui-lab status
pnpm agent-ui-lab snapshot
pnpm agent-ui-lab screenshot --out ui.png
pnpm agent-ui-lab click aui-42
pnpm agent-ui-lab fill aui-43 "query"
pnpm agent-ui-lab keypress Tab
pnpm agent-ui-lab viewport 390 844
pnpm agent-ui-lab scenario locker empty
pnpm agent-ui-lab disconnect
```

Screenshots return base64 PNG in the response and the **client** writes the file.
The service never writes to a client-supplied path: that would be a filesystem
write primitive, which the security model forbids.

The CLI reads port and token from an env var or a `--connect` argument produced by
the Settings page copy button. It must not read them from a file on disk, since a
file is a persistence and leakage vector.

Suggested MCP tool surface:

- `agent_ui_status`
- `agent_ui_snapshot`
- `agent_ui_screenshot`
- `agent_ui_click`
- `agent_ui_fill`
- `agent_ui_keypress`
- `agent_ui_viewport`
- `agent_ui_scenario`
- `agent_ui_disconnect`

Build the MCP wrapper as a local Codex plugin after the app service and CLI are
stable.

## Fixture and scenario system

Real application data validates real workflows. Fixtures are still required to
reproduce rare visual states safely and repeatedly.

Add an Agent UI Lab-only scenario selector and a narrowly scoped test-data
provider. Do not replace the entire Electron API.

**Mechanism.** Fixtures inject at the **data-hook layer inside the renderer**, not
at the IPC boundary and not by swapping `window.electronAPI`. A small
`scenarioStore` (Zustand, consistent with the rest of `src/stores/`) holds
`{ page, mode }` and is empty unless a session is active. Page-level data hooks
consult it and return fixture data instead of live data when a mode is set.

The tradeoff is explicit: every page needs per-page opt-in wiring, which is why
phases 3 and 4 are scoped by area rather than done all at once. The benefit is
that the fake never exists in a normal build and can never reach real mod or game
files. A build-time guard should fail the build if fixture modules are reachable
from the normal entry graph.

Every supported page should be selectable in these modes:

- normal;
- empty;
- loading;
- error;
- disabled;
- preview;
- destructive-confirmation.

Initial scenario matrix:

| Area | Required coverage |
| --- | --- |
| Locker | Looks, Sounds, hero detail, Global Sounds; empty, disabled, loading, active selection |
| Foundry | Catalog and hero workshop; catalog failure, inspection loading, empty search, build tray |
| Installed | Empty, filtered zero-state, bulk/destructive confirmation |
| Browse | Loading, local/remote zero-state, filters, download progress/error |
| Profiles | Empty, loading, apply/update/delete confirmation |
| Stats | No player, loading, API error, populated |

Scenario modes are also the safe way to exercise destructive UI: a
`destructive-confirmation` fixture puts the dialog on screen with fixture data
behind it, so an agent can verify the dialog without a real deletion being
possible at all.

## Verification strategy

Layer the tests by what they can actually catch.

**Pure unit tests (Vitest, no Electron).** These carry most of the security
weight and must be thorough:

- snapshot sanitization: role allow-list, redaction patterns, deny-subtree,
  password values, node cap and truncation reporting;
- token comparison, `Origin` rejection, `Host` validation, non-loopback peer
  rejection;
- session state machine: expiry, inactivity, toggle-off, second-client refusal,
  teardown idempotence;
- command validation: unknown types, bad generations, non-allow-listed routes and
  keys, out-of-range viewports.

**Renderer tests (jsdom).** Node collection, ID generation and staleness
detection, actionability checks, scenario store behavior.

**Integration (real Electron).** Bootstrapping problem worth naming: an
end-to-end test of the Lab needs something to drive the app, and the Lab is that
something. Resolve it by allowing a fixed token and fixed port from env in test
builds only (`GRIMOIRE_AGENT_UI_LAB_TEST_TOKEN`), gated the same way
`GRIMOIRE_DEV_CDP_PORT` is, so the harness can connect deterministically. Smoke
test: launch in test mode, enable the session, snapshot, resize to a narrow
viewport, tab through controls and assert focus order, open a
destructive-confirmation scenario and assert the flow stops at the dialog, then
disconnect and assert the port is closed and window bounds restored.

**Manual security review.** Before merge, verify by hand that a page in a normal
browser at `http://127.0.0.1:<port>` cannot do anything, with and without a
correct token in a fetch call.

Run `pnpm lint`, the TypeScript build, `pnpm i18n:check`, `pnpm i18n:manifest`,
and `pnpm exec vitest run`.

The Agent UI Lab is then used to complete responsive and keyboard-focus checks
against the actual Electron app.

## Phased implementation

0. Derisking spike: input synthesis, real narrow viewport, accessible names.
1. Settings toggle and session lifecycle, loopback service with auth and
   teardown, read-only snapshot and screenshot.
2. Structured click/focus/type/keypress/scroll commands, viewport overrides,
   allow-listed navigation and `waitFor`.
3. Locker and Foundry fixtures, then complete their state audit.
4. Installed, Browse, Profiles, and Stats fixtures.
5. Local CLI, documentation, and the Codex MCP/plugin wrapper.
6. Decide whether explicit fork/package builds may enable it; keep stock releases
   unavailable.

Each phase should be independently mergeable. Phase 1 alone (inspect and
screenshot, no interaction) is already useful and is the natural place to stop if
the spike shows interaction is harder than expected.

## Acceptance criteria

- No browser page ever receives the normal Electron preload API, and a page
  loaded in a real browser cannot execute any command against the service
  (tested, not asserted).
- The service binds only to `127.0.0.1`, rejects requests with an `Origin` header
  or a non-loopback `Host`, requires a per-session 256-bit token, expires on both
  absolute and inactivity timers, and closes its listener within one event loop
  turn of disable, quit, or expiry.
- No snapshot, console line, or error message emitted by the service contains a
  filesystem path, Steam ID, token, or share code, under the sanitizer's test
  corpus.
- Agents can inspect the actual Electron UI at desktop and narrow widths, with
  `setViewport` returning the size actually achieved, and can exercise keyboard
  focus with real Chromium input events.
- Every Lane 1 state is reproducible via scenario fixtures without touching the
  user's real mods or game files, and fixture modules are unreachable from the
  normal entry graph.
- Existing destructive confirmations remain intact, and clicking a node marked
  `destructive` requires a session started in the explicit destructive-allowed
  mode.
- Window bounds and size minimums are restored after every session, including
  after an abnormal teardown.
- With the flag off, no listener is created, no adapter is loaded, and the render
  path is unchanged from today.

## Open questions

1. **Does dev-driver stay?** Keeping both means two agent surfaces to maintain and
   reason about. Retiring dev-driver means every existing CDP-based check has to
   be rewritten against a narrower API, some of which may not be expressible.
   Recommendation: keep dev-driver for developer use, and treat the Lab as the
   surface for anything less trusted, but say so in `CLAUDE.md` so the choice is
   not re-litigated per task.
2. **Consent tier for destructive nodes.** Confirm (b) above, or pick another.
3. **Is shipping this real?** If stock releases will never enable it, the build
   flag work and much of the hardening is speculative. That is defensible for the
   security posture alone, but it should be a decision, not a default.
4. **Accessible-name strategy** for Grimoire's many icon-only controls. This may
   require adding `aria-label` across the app, which is real work with real value,
   but it is not free and is not currently in the phase list.
5. **Screenshot redaction.** Snapshots are sanitized; screenshots are not, and a
   screenshot of the Settings page shows real game paths. Either accept it
   (consistent with (a)-style trust) or blur deny-marked regions before encoding.

## Risks

- **Scope.** This is a service, a protocol, a renderer adapter, a fixture system
  across six pages, a CLI, and an MCP plugin, in service of UI QA. Phase 1 plus
  the Locker fixtures may capture most of the value; the rest should have to
  justify itself.
- **Fixture drift.** Fixtures that are not exercised by CI rot, and a rotted
  fixture is worse than none because it reports green against a UI shape that no
  longer exists. Wire at least a smoke assertion per scenario into the test suite.
- **A false sense of coverage.** An agent tabbing through controls proves focus
  moves, not that the order is sensible. The Lab produces evidence for a human or
  a model to judge; it does not itself judge.

## Handoff prompt

```text
Implement the Agent UI Lab described in docs/agent-ui-lab-plan.md.

Start with the phase 0 spike and report the results before writing production
code: confirm webContents.sendInputEvent delivers real clicks and keystrokes to
the renderer with correct focus behavior, confirm the BrowserWindow can be
resized to narrow widths with media queries firing, and confirm accessible names
can be derived for Grimoire's icon-only controls. If any of the three fails, stop
and report rather than working around it.

Then work phases 1 to 3 only unless the architecture requires a small supporting
change.

Build an opt-in Developer Mode setting (experimentalAgentUiLab) that starts a
loopback-only, token-authenticated main-process HTTP service for controlled UI
inspection of the real Electron window. Reject requests carrying an Origin header
or a non-loopback Host. Do not expose window.electronAPI, direct IPC, arbitrary
JavaScript, DevTools Protocol, filesystem data, settings contents, or any
destructive shortcut. Use a structured, allow-listed renderer adapter with
generation-scoped node IDs for snapshot/click/fill/keypress/scroll/viewport
interactions, and synthesize input as real Chromium events rather than DOM
dispatch. Treat the snapshot sanitizer as a pure, heavily tested module.

Implement the Settings status/disconnect UX, the service lifecycle, read-only
snapshot and screenshot actions first, then structured UI actions and narrow
viewport support with restore-on-teardown. Add Locker and Foundry scenario
fixtures at the data-hook layer (not by replacing the Electron API) for normal,
empty, loading, error, disabled, preview, and destructive-confirmation states.
Keep all normal destructive confirmation flows intact and mark destructive nodes
in the snapshot.

New user-facing strings need real keys in src/locales/en/translation.json.
Preserve unrelated working-tree changes. Add focused unit and integration tests,
run typecheck, pnpm i18n:check, pnpm i18n:manifest, lint, and the complete test
suite. Report the exact security boundaries, files changed, verification results,
and any follow-up work needed for the CLI/MCP wrapper.
```
