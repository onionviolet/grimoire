# Phase 9: The Base Command Catalogue - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Capture the base-game voice command catalogue as typed, owned, versioned data,
and give both override maps (`override_bindable`, `override_ping_wheel_bindable`)
a searchable, editable form surface that preserves unknown YAML entries
byte-for-byte. Close the audit-flagged `chat-wheel:read`/`chat-wheel:starter`
main-process test gap beside the existing round-trip test. The catalogue is
versioned data pinned to the ChatLane source used to build the bundled CLI,
never a scrape of game files and never a remote fetch. The game remains where
users assign enabled commands to wheel slots; this phase only edits which
commands are enabled.

</domain>

<decisions>
## Implementation Decisions

The four gray areas were delegated to the builder by the user with the mandate
"pick the considerations that are most useful/comprehensive; if conflicting,
implement all of them and let the user choose in the future". Decisions below
are therefore the comprehensive option, and each is reversible.

### Catalogue identity and labels
- **D-01:** The catalogue keys on the command's **display string** (the `id`
  field in ChatLane's `voice_commands_db.gd`), because that string IS the YAML
  key in the real wire format (`example.yml`: `Good Game (Post Game) - All
  Chat: true`). There is no separate command ID in the format, so the
  option-catalog plan's "do not use the command text as the ID" assumption is
  corrected: inventing a separate ID would break byte-for-byte round-trip.
  Each catalogue entry carries `id` (YAML key), `label` (ChatLane's `vc-item-*`
  i18n key, kept for provenance only), `category` (`default`/`hidden`/`broken`),
  `isMenu`, `bindable` (default Chat Wheel/bind availability), and
  `pingWheelBindable` (default ping-wheel availability).
- **D-02:** The UI shows the raw English display strings exactly as the game
  shows them (honest WYSIWYG). ChatLane's `vc-item-*` label keys are only used
  for ChatLane's own GUI localization and are never shown by the game, so the
  catalogue rows are not i18n-translated; the surrounding UI copy is (all
  visible strings must be `chatWheel.*` i18n keys). An unknown-id entry found
  in YAML but absent from the catalogue still renders as its raw string.

### Category surface
- **D-03:** All three ChatLane categories are surfaced: `default` (normally
  bindable), `hidden` (game-available but not bindable by default; these are
  the commands ChatLane exists to unlock), and `broken` (post-game all-chat
  commands plus `Missing`/pinged-* that are not bindable by default and carry
  game-state caveats). The `broken` category is shown with honest copy that
  availability is a game/ChatLane capability, not a guaranteed in-match
  outcome, and that these commands only matter in the states where the game
  would use them. Category filter chips reflect these three groups plus an
  "all" view.

### Toggle semantics
- **D-04:** Three-state override controls: **inherit** (no YAML entry; the
  catalogue default governs), **force on** (YAML `true`), **force off** (YAML
  `false`). The YAML format accepts booleans and ChatLane's loader
  (`config.gd`) validates bool values, so explicit `false` is legal and must be
  representable. The control state is derived from the YAML override map when
  present, otherwise it displays the catalogue default. Two controls per row:
  "Chat Wheel / bind" (writes `override_bindable`) and "Ping wheel" (writes
  `override_ping_wheel_bindable`).
- **D-05:** Absence is distinct from an empty map, and both are distinct from
  explicit entries. `updateChatWheelYaml` replaces only the owned mapping
  blocks; unknown root options, comments, unknown map entries, and ordering are
  retained. An unknown ID present in YAML but absent from the catalogue stays
  in YAML and is editable in an "Other commands in this file" group.

### UI shape
- **D-06:** The catalogue is a separate collapsible section beneath "Menus and
  commands" on the Chat Wheel page (`src/pages/ChatWheel.tsx`), initially open
  for new drafts and retaining the user's open state during one edit session.
  It has text search, category filters, a compact count, and rows showing the
  command name plus its game-default status. Unknown YAML overrides appear in a
  visible "Other commands in this file" group with their raw IDs and editable
  booleans. The form is keyboard-accessible: semantic controls, accessible
  labels, filter focus management, no drag-only interaction. Advanced YAML
  stays the escape hatch, and manual YAML edits flow back into the controls
  through the existing `parseChatWheelYaml` path.
- **D-07:** The starter template is not bloated with no-op entries: the two
  override maps stay `{}` and the UI shows inherited defaults. The catalogue is
  versioned data with a provenance comment naming the pinned ChatLane
  release/commit and a short update procedure.

### Claude's Discretion
The user delegated the four gray areas wholesale. Where the comprehensive
option would create conflicting UI (for example force-off vs inherit on a
default-true command), the three-state model resolves it: all three states are
always available, and the legend explains inherit/default, enabled, and
disabled. No user-visible choice is precluded.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Chat Wheel domain
- `docs/chat-wheel.md` — Current Chat Wheel page behavior, the ChatLane YAML contract, and the "never edits gameinfo.gi" rule
- `docs/chat-wheel-option-catalog-plan.md` — The authored option-catalog plan this phase implements (slices, contract, exit criteria); note its "command ID" assumption is corrected by D-01
- `docs/chat-wheel-radial-and-portraits-tab-plan.md` — Prior radial wheel lane (context; the 12-slot cap and icon picker already landed)
- `docs/chat-wheel-portraits-ui-pass-plan.md` — Prior UI pass (context; radial preview landed)

### ChatLane source (read-only reference, provenance)
- `https://github.com/RedMser/ChatLane/blob/master/GUI/autoload/voice_commands_db.gd` — The authoritative command catalogue (id, category, label, isMenu, bindable, pingWheelBindable)
- `https://github.com/RedMser/ChatLane/blob/master/CLI/example.yml` — The real YAML wire format (override maps keyed on display strings)
- `https://github.com/RedMser/ChatLane/blob/master/GUI/autoload/config.gd` — Loader validation rules (string keys, bool values, backward-compat default for ping wheel map)
- `https://github.com/RedMser/ChatLane/blob/master/CLI/Program.cs` — CLI contract (yml->vpk, vpk->yml; embeds chatlane.yml verbatim)

### Codebase
- `src/lib/chatWheelModel.ts` — The byte-preserving parse/update model this phase extends
- `src/lib/chatWheelModel.test.ts` — Existing form-model tests this phase expands
- `src/pages/ChatWheel.tsx` — The page hosting the new catalogue section
- `electron/main/services/chatWheel.ts` + `electron/main/ipc/chatWheel.ts` — The service/IPC under test (`chat-wheel:read`, `chat-wheel:starter`)
- `electron/main/services/chatWheel.roundtrip.test.ts` + `electron/main/services/chatWheel.test.ts` — Existing main-process tests the new coverage joins
- `docs/audit-2026-07-28-verdicts.md` — Records the untested `chat-wheel:read`/`chat-wheel:starter` finding this phase closes
- `src/locales/en/translation.json` — All new visible strings land here under `chatWheel.*`; `pnpm i18n:check` + `pnpm i18n:manifest` are CI/pre-push gates

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/chatWheelModel.ts` — `parseChatWheelYaml`/`updateChatWheelYaml` already preserve unknown text byte-for-byte; the override maps extend this same pattern (absent vs empty vs explicit)
- `src/lib/chatWheelIcons.ts` — Precedent for vendoring ChatLane data as typed readonly TS with provenance comments; the catalogue follows the same shape
- `src/components/chatwheel/RadialWheelPreview.tsx` — Existing chatwheel components directory; the catalogue component lands beside it
- `src/components/common/ui.tsx` / `src/components/common/forms.tsx` — Shared Button/input/checkbox primitives; the catalogue reuses them
- `src/lib/api.ts` + `electron/preload/index.ts` + `src/types/electron.ts` — The IPC seam; no new IPC should be needed for the catalogue (it is pure renderer-side data + the existing YAML save path), unless the test gap work changes something

### Established Patterns
- Typed readonly data with provenance comments (chatWheelIcons.ts)
- Byte-for-byte YAML preservation in the form model (chatWheelModel.ts)
- Every visible string is an i18n key; `pnpm i18n:check` is a gate
- Main-process services tested with focused vitest suites; converter calls are stubbed except the round-trip test

### Integration Points
- `src/pages/ChatWheel.tsx`: new collapsible catalogue section beneath "Menus and commands"; Advanced YAML textarea remains the source of truth and feeds back through `parseChatWheelYaml`
- `src/lib/chatWheelModel.ts`: `ChatWheelModel` gains optional override maps; `updateChatWheelYaml` replaces only owned blocks
- `electron/main/services/chatWheel.ts`: `readChatWheelStarter`/`readChatWheelVpk` gain test coverage

</code_context>

<specifics>
## Specific Ideas

No specific user references beyond the delegation mandate ("pick the most
useful/comprehensive considerations; if conflicting implement all and let the
user choose in the future"). The exit criteria of the authored option-catalog
plan are the acceptance anchor: a user can search every catalogued base
command, understand whether it is normally available, change either override
without touching YAML, and reopen a saved VPK with all known and unknown
overrides preserved.

</specifics>

<deferred>
## Deferred Ideas

- **Known-limitations disclosures, arrow-key ring nav, drag-and-drop** — Phase 10 of this milestone; the catalogue section is designed keyboard-accessible now so drag-and-drop can be added later without rework.
- **Unbind-before-delete warning, game-asset wheel dressing** — Phase 11 of this milestone.
- **In-game slot-order verification row** — explicitly not selected by the user for this milestone; remains a manual to-do from the radial plan.

</deferred>

---

*Phase: 9-The Base Command Catalogue*
*Context gathered: 2026-08-11*
