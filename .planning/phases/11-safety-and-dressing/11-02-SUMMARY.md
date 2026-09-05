---
phase: 11-safety-and-dressing
plan: 02
subsystem: chat-wheel
tags: [spike, preview, foundry, ipc]

requires:
  - Foundry catalog services (getTextures, ensureFullImage in foundryCatalog.ts)
  - RadialWheelPreview (Phase 9/10)
provides:
  - electron/main/services/chatWheelDressing.ts (pickChatWheelBackplate, resolveChatWheelDressing)
  - IPC chat-wheel:dressing, preload + api getChatWheelDressing, src/types/chatWheelDressing.ts
  - useChatWheelDressing hook with the pure chatWheelDressingEnabled gate
  - RadialWheelPreview optional `dressing` prop (clipped SVG <image> behind the ring)
affects: [REQ-cw-game-asset-dressing]

actuals:
  tokens: 0
  tasks: 1
  commits: 1

one_liner: The preview can wear a game backplate behind the Foundry gate; the pure-SVG wheel is unchanged whenever the gate is closed or nothing decodes.
---

# Plan 11-02 Summary: Game-asset dressing spike

## Delivered

- `electron/main/services/chatWheelDressing.ts`: no decoding of its own. It
  asks the Foundry catalog for `.vtex_c` entries matching `wheel` and `ping`,
  ranks the ones under `panorama/images/hud/` whose stem contains `wheel` and
  is not an icon (`chat` over `ping`, then backplate-ish tokens, then path
  order), and hands the winner to `ensureFullImage`, the same decoder and
  cache the Foundry lightbox uses. Every failure path resolves null and the
  function never throws.
- `chat-wheel:dressing` IPC handler (read-only, catches everything, returns
  null), preload and `api.getChatWheelDressing`, and the shared
  `ChatWheelDressing` type.
- `useChatWheelDressing(settings)`: asks main only when `experimentalFoundry`
  is on and a game path is configured (the dev dummy path counts in dev mode,
  the same rule `getActiveDeadlockPath` applies). Resets to null when the gate
  flips so a stale answer never shows.
- `RadialWheelPreview` takes an optional `dressing` prop and, only when a
  backplate URL is present, draws it as a clipped `<image>` behind the ring
  with the wedges made translucent. With `dressing` absent or null the markup
  is byte-identical to before.
- `docs/chat-wheel.md` gains a "Game-asset dressing" section.

## Tests

- `chatWheelDressing.test.ts`: ranking, HUD-root and icon rejection, null on
  no path, empty catalog, decode failure, and thrown errors.
- `useChatWheelDressing.test.tsx`: gate closed on flag off and on missing
  path, null on IPC rejection, data URL otherwise.
- `RadialWheelPreview.test.tsx`: identical slot markup with no dressing, the
  backplate image only when dressed.

## Spike verdict

- **Icons need no extraction.** ChatLane embeds the game's
  `scripts/ping_wheel_messages.vdata`, which names the stock set as
  `panorama/images/hud/ping/ping_icon_<name>.svg`. Those are compiled
  `.vsvg_c` entries the texture catalog does not index, and the eleven
  vendored icons in `src/lib/chatWheelIcons.ts` already carry exactly those
  names, so the preview wears the stock icon set today.
- **A backplate texture is not known to exist.** Neither ChatLane nor the
  vdata names one; the in-game ring is Panorama layout and style rather than
  a texture. So the spike ships as gated plumbing with a runtime resolver:
  when a user's pak does contain a qualifying `.vtex_c`, the preview is
  dressed; when it does not, null is the normal answer and nothing changes.
- **Extraction cost is one catalog search plus one cached decode**, both
  already paid for by Foundry, and both fingerprinted to the pak build.
- **Not verified against a real pak.** No Deadlock install exists on the
  macOS machine this ran on, so whether any shipped pak yields a backplate is
  unknown. That is the one open question; the fallback does not depend on it.
- **Duplicate decode code added: none.**
