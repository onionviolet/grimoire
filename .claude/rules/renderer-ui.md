---
paths:
  - "src/components/**"
  - "src/pages/**"
  - "src/stores/**"
  - "src/index.css"
---
<!-- Twin of docs/agents/renderer-ui.md (read by Codex). Keep the text below identical in both files. -->
# Renderer UI and design

Read `docs/ui-conventions.md` before any renderer UI work. The short version:

- Reuse the primitives in `src/components/common/` (`ui.tsx`, `forms.tsx`, `PageComponents.tsx`, `Modal.tsx`, `menu.tsx`, `ToastStack.tsx`) before writing markup.
- Colors come from the tokens in `src/index.css` `@theme`, never raw hex or raw Tailwind palette colors.
- **The accent color is user-chosen at runtime** (`src/lib/accentColor.ts` rewrites `--color-accent*`), and so is the theme: dark, OLED or light (`src/lib/theme.ts`; each swaps the surface and ink tokens). Orange `#f97316` is only the default. Always use `accent`/`accent-hover`/`accent-foreground` utilities and never design around a specific hue.
- The z-index ladder is documented at the top of `src/index.css`. Don't invent new z values.

## Conventions

- `Installed.tsx` and `Browse.tsx` are god files (thousands of lines). Put new features in their own components under `src/components/<feature>/` rather than growing them. When splitting, make move-only PRs with no behavior or visual change mixed in.
- Experimental features are gated behind `experimental*` settings (see `AppSettings`) and default off.
