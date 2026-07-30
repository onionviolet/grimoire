# Plan: expose the base-game Chat Wheel option catalogue

## Goal

Make the Chat Wheel editor as discoverable as ChatLane's original GUI: users
can browse the voice commands the game provides, see which ones are normally
available, and explicitly choose which commands to unlock for the stock and
ping wheels. The existing custom-menu editor stays intact.

Today Grimoire only provides a custom-menu form. The two fields that control
the base-game wheel, `override_bindable` and `override_ping_wheel_bindable`,
are present in the starter YAML but have no form surface, so users must know
their exact command keys and edit Advanced YAML by hand. ChatLane's GUI instead
shows a command list, with separate enablement choices for the stock Chat Wheel
and keyboard binding.

## Contract and decisions

- This is a **catalogue and override editor**, not a replacement for the
  game's own Chat Wheel settings. The game remains where users assign the
  enabled commands to wheel slots.
- Treat the base command list as versioned data tied to the bundled ChatLane
  release. It must not be guessed from display labels or fetched from a remote
  service at runtime.
- Retain unknown YAML keys and unknown command IDs byte-for-byte. A newer
  ChatLane build or a game update must not cause Grimoire to silently discard
  a user's existing override.
- The initial form surface covers the two known mappings only:
  `override_bindable` (standard chat-wheel/bind availability) and
  `override_ping_wheel_bindable` (ping-wheel availability). Keep any other
  YAML options in Advanced YAML until their schema is verified.
- Do not promise that every command is safe in every game state. The UI should
  say that availability is a game/ChatLane capability, not a guaranteed
  in-match outcome.

## Implementation slices

1. **Capture and own the command catalogue.**
   - Extract the exact command IDs, display labels, categories, and default
     availability from the pinned ChatLane source/release used to build the
     bundled CLI. Include a provenance comment with the release/commit and a
     short update procedure.
   - Add `src/lib/chatWheelCommands.ts` with a typed, readonly catalogue. Each
     entry needs a stable command ID, user-facing label, category, and whether
     it is stock-enabled by default. Do not use the command text as the ID.
   - Add a small fixture of representative YAML containing known and unknown
     entries, so parser compatibility does not depend on the whole catalogue.

2. **Parse and write both override maps safely.**
   - Extend `ChatWheelModel` with optional maps for the two overrides, using
     command ID -> boolean and preserving their absence as distinct from an
     empty map.
   - Replace only the owned YAML mapping blocks in `updateChatWheelYaml`; keep
     comments, unrelated root options, unknown map entries, and ordering where
     practical. An unknown ID must remain in YAML even if it cannot be rendered
     as a catalogue row.
   - Expand `chatWheelModel.test.ts` for: absent vs empty mappings,
     quoted/unquoted values, toggling a known option without losing unknown
     entries, and form-to-YAML-to-form round trips.

3. **Build a browsable “Base game commands” panel.**
   - Add `src/components/chatwheel/BaseCommandCatalog.tsx` beside the existing
     radial preview. It should have text search, category filters, a compact
     count, and rows showing the command name plus its game-default status.
   - Give each row two explicit controls: “Chat Wheel / bind” and “Ping wheel”.
     The control state is derived from the YAML override when present; otherwise
     it displays the catalogue default. Include a concise legend explaining
     inherited/default, enabled, and disabled.
   - Put unknown YAML overrides in a visible “Other commands in this file”
     group, showing their raw IDs and allowing their booleans to be changed.
     This prevents a catalogue update from hiding user-owned configuration.
   - Keep the form keyboard-accessible: semantic checkboxes, accessible labels,
     filter focus management, and no drag-only interaction.

4. **Integrate without disrupting custom menus.**
   - Add the catalogue as a separate collapsible section beneath “Menus and
     commands”, initially open for new drafts and retaining the user's open
     state during one edit session.
   - Update the starter template only if the validated baseline needs explicit
     values; otherwise continue using empty maps and show inherited defaults in
     the UI. Do not create dozens of no-op YAML entries merely to populate the
     catalogue.
   - Keep Advanced YAML as the escape hatch and ensure manual edits immediately
     update catalogue controls through the current `parseChatWheelYaml` path.

5. **Copy, verification, and game smoke test.**
   - Add `chatWheel.*` translations for the catalogue, statuses, search empty
     state, warning, and unknown-command group; run `pnpm i18n:check`.
   - Add component tests for searching/filtering and the three-state override
     display. Run focused Chat Wheel tests, then `pnpm typecheck`, `pnpm lint`,
     and `pnpm test`.
   - Manually save a wheel that enables one normally hidden command in each
     mapping; confirm it appears in Deadlock's Chat Wheel settings, can be
     assigned there, and survives reopening the generated VPK in Grimoire.

## Non-goals / later work

- Recreating the full ChatLane drag-and-drop GUI or editing the game's active
  slot bindings from Grimoire.
- Runtime scraping of game files or network-delivered command lists.
- Resolving known ChatLane/game limitations (for example, wheel-slot-specific
  command selection issues); document relevant limitations near the controls
  once the exact affected commands are known.

## Exit criteria

A user can search every catalogued base command, understand whether it is
normally available, change either override without touching YAML, and reopen a
saved VPK with all known and unknown overrides preserved. Custom menus, the
radial preview, and Advanced YAML retain their current behavior.
