# Phase 6 - UI Review

**Audited:** 2026-08-10
**Baseline:** 06-UI-SPEC.md (draft, 2026-08-07)
**Screenshots:** not captured (code-only audit; the handoff seam is covered by the phase's real-function seam tests)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All declared copy verbatim; CTA is "Add to library", not generic "Confirm" |
| 2. Visuals | 4/4 | Kind groups grouped with Tools visually distinct; refusal banner matches the failure-banner shape |
| 3. Color | 4/4 | Accent confined to Tools group, primary CTA, focus rings; danger only on the refusal banner |
| 4. Typography | 4/4 | Declared 2-weight scale held; Button's locked 500 weight disclosed as inherited |
| 5. Spacing | 4/4 | 4/8/16/24 scale; documented legacy exceptions reused verbatim |
| 6. Experience Design | 4/4 | Downloading toast, replaced toast, refusal-before-confirm, interrupted fallback; replace-newest policy tested |

**Overall: 24/24**

---

## Top 3 Priority Fixes

1. None - no code-fixable findings. The three contract backstops (longest label wrap at narrowest window, downloading-toast timing, stale-pending-id held-out test) are all covered: the held-out stale-pending test exists (06-06/06-07 regression coverage), and the remaining two are recorded human rows.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

Every declared string exists verbatim: `browser.toolDownload.title` ("Add this download to your mod library?"), `message` ("Will add to your mod library as \"{{name}}\"."), `confirm` ("Add to library"), `cancel` ("Discard"), `downloading` ("Downloading from {{tool}}..."), `replaced`, `refusedPrefix` ("Not added: "), `fallbackName` ("Browser download"), plus the extra `interrupted` state ("The download did not finish. Nothing was added."). Kind-group headers match the contract exactly and render in the declared order. All copy is i18n-keyed with fallbacks; the main-process rejection clause stays main-process English per precedent, wrapped by the translated prefix.

### Pillar 2: Visuals (4/4)

Kind groups render as grouped shortcut rows (`flex flex-wrap gap-1.5`) with the `Tools` header accent-tinted so the file-producing destination reads distinct from Mod hosts/Reference/Community. The disclosure reuses `useConfirm`/`ConfirmModal`. The refusal banner reuses the existing failure-banner shape (`rounded-sm border ... px-3 py-2 text-xs`) upgraded to danger.

### Pillar 3: Color (4/4)

Accent appears only on the Tools group header, the primary "Add to library" button (`variant="primary"`), and focus rings. The refusal banner is the only danger surface (`border-state-danger/40 bg-state-danger/10 text-state-danger`); "Discard" stays neutral secondary. No repaint of existing toolbar chrome.

### Pillar 4: Typography (4/4)

Body `text-sm` for disclosure/banner/toast copy; Label `text-xs font-semibold uppercase tracking-wider` for the kind-group headers (kept local rather than widening `SectionHeader` to a third weight, per the spec's own note). The Button 500 weight is inherited from the shared primitive and disclosed as pre-existing.

### Pillar 5: Spacing (4/4)

`gap-1` icon-to-label, `gap-2` within a kind group, `gap-4` between groups, `gap-6` section spacing. The 2px/6px/12px legacy values are the documented carve-outs reused verbatim.

### Pillar 6: Experience Design (4/4)

The click-to-dialog gap is never silent (downloading toast from `will-download`); a replaced pending download surfaces the replaced toast; a refused file is refused before any confirm step with a stated reason; an interrupted download says nothing was added. The replace-newest single-pending policy is proven by the held-out confused-deputy test and the real seam test. Empty kind groups render nothing (no placeholder), zero-one-many (single Tools entry) renders as one button.

Remaining human backstops (recorded): downloading-toast-before-write timing in a live app, and the longest-catalog-label wrap at the narrowest window.

---

**Registry audit:** shadcn not initialized; no third-party registries; not applicable.

_Audited: 2026-08-10 (Phase 7 UI review, first UI-REVIEW ever produced for this phase)_
