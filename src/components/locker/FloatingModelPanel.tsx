import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { GripHorizontal, PanelLeft, PanelRight, PictureInPicture2, X } from 'lucide-react';
import type { ModelPanelSurface } from './useModelPanelOpen';

/**
 * An adjustable panel for a surface's live 3D hero model.
 *
 * The model used to live in a fixed strip whose left offset was hardcoded to
 * the rail + selection-column widths (780/880px), so it only worked on wide
 * windows and collapsed to a sliver at the lg breakpoint. A floating panel
 * decoupled the viewer from panel widths entirely, but floating alone lost
 * something the old strip had: a big, stable stage that never overlaps the
 * cards you are picking from. So the panel now has three modes: float, and
 * docked to either side as a full-height stage. Mode and geometry persist to
 * localStorage, per surface.
 *
 * Positioned `absolute` inside the host overlay root (its offset parent), so
 * left/top are relative to that container and `overflow-hidden` on the root
 * clips it. Float drag and every resize clamp inside the parent and re-clamp
 * on window/overlay resize.
 */

interface Geom {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Which edge/corner a resize gesture grabbed. */
type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

type PanelMode = 'float' | 'dock-left' | 'dock-right';

interface PanelState {
  mode: PanelMode;
  geom: Geom | null;
  /** Width of the docked stage, independent of the float size. */
  dockW: number;
}

const storageKey = (surface: ModelPanelSurface) => `grimoire.${surface}.modelPanel.state`;
/** Pre-modes key: geometry only. Read once so parked panels survive the upgrade.
 *  Locker-only because the panel did not exist on any other surface then. */
const LEGACY_GEOM_KEY = 'grimoire.locker.modelPanel.geom';
const DEFAULT_SIZE = { w: 360, h: 460 };
const DEFAULT_DOCK_W = 420;
const MIN = { w: 240, h: 260 };
const MARGIN = 12;
/** Docked panels never eat the whole overlay: leave this much for the content. */
const DOCK_MIN_REMAINDER = 320;

function isGeom(v: unknown): v is Geom {
  const g = v as Partial<Geom> | null;
  return (
    typeof g?.x === 'number' &&
    typeof g?.y === 'number' &&
    typeof g?.w === 'number' &&
    typeof g?.h === 'number'
  );
}

function readStored(surface: ModelPanelSurface): PanelState {
  try {
    const raw = localStorage.getItem(storageKey(surface));
    if (raw) {
      const v = JSON.parse(raw) as Partial<PanelState>;
      return {
        mode:
          v?.mode === 'dock-left' || v?.mode === 'dock-right' || v?.mode === 'float'
            ? v.mode
            : 'float',
        geom: isGeom(v?.geom) ? v.geom : null,
        dockW: typeof v?.dockW === 'number' ? v.dockW : DEFAULT_DOCK_W,
      };
    }
    const legacy = surface === 'locker' ? localStorage.getItem(LEGACY_GEOM_KEY) : null;
    if (legacy) {
      const g: unknown = JSON.parse(legacy);
      if (isGeom(g)) return { mode: 'float', geom: g, dockW: DEFAULT_DOCK_W };
    }
  } catch {
    /* ignore malformed storage */
  }
  return { mode: 'float', geom: null, dockW: DEFAULT_DOCK_W };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function clampGeom(g: Geom, pw: number, ph: number): Geom {
  const w = clamp(g.w, MIN.w, pw - MARGIN * 2);
  const h = clamp(g.h, MIN.h, ph - MARGIN * 2);
  const x = clamp(g.x, MARGIN, pw - w - MARGIN);
  const y = clamp(g.y, MARGIN, ph - h - MARGIN);
  return { x, y, w, h };
}

function clampDockW(width: number, pw: number): number {
  return clamp(width, MIN.w, Math.max(MIN.w, pw - DOCK_MIN_REMAINDER));
}

/**
 * Apply a drag delta to one edge or corner. Each axis pins the opposite side:
 * dragging the west edge moves x and shrinks w by the same amount, so the east
 * edge stays put even once the width bottoms out at MIN.
 */
function resizeBy(base: Geom, edge: Edge, dx: number, dy: number): Geom {
  let { x, y, w, h } = base;
  if (edge.includes('e')) w = Math.max(MIN.w, base.w + dx);
  if (edge.includes('w')) {
    w = Math.max(MIN.w, base.w - dx);
    x = base.x + (base.w - w);
  }
  if (edge.includes('s')) h = Math.max(MIN.h, base.h + dy);
  if (edge.includes('n')) {
    h = Math.max(MIN.h, base.h - dy);
    y = base.y + (base.h - h);
  }
  return { x, y, w, h };
}

/** Hit areas for the eight resize grips, as Tailwind position + cursor classes. */
const EDGE_GRIPS: Array<{ edge: Edge; className: string }> = [
  { edge: 'n', className: 'left-2 right-2 top-0 h-1.5 cursor-ns-resize' },
  { edge: 's', className: 'left-2 right-2 bottom-0 h-1.5 cursor-ns-resize' },
  { edge: 'w', className: 'top-2 bottom-2 left-0 w-1.5 cursor-ew-resize' },
  { edge: 'e', className: 'top-2 bottom-2 right-0 w-1.5 cursor-ew-resize' },
  { edge: 'nw', className: 'left-0 top-0 h-3 w-3 cursor-nwse-resize' },
  { edge: 'ne', className: 'right-0 top-0 h-3 w-3 cursor-nesw-resize' },
  { edge: 'sw', className: 'left-0 bottom-0 h-3 w-3 cursor-nesw-resize' },
  { edge: 'se', className: 'right-0 bottom-0 h-3 w-3 cursor-nwse-resize' },
];

export default function FloatingModelPanel({
  surface,
  title,
  onClose,
  children,
}: {
  /** Which surface's remembered panel this is. Locker and Foundry are separate
   *  habits: where you park the stage while picking skins is not where you want
   *  it while editing one. Matches the key split in useModelPanelOpen. */
  surface: ModelPanelSurface;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PanelState>(() => readStored(surface));
  const [parent, setParent] = useState<{ w: number; h: number } | null>(null);
  const { mode, geom, dockW } = state;
  const docked = mode !== 'float';

  const setGeom = useCallback(
    (next: Geom | ((current: Geom | null) => Geom | null)) =>
      setState((s) => ({ ...s, geom: typeof next === 'function' ? next(s.geom) : next })),
    []
  );

  // Track the overlay size: docked geometry is derived from it, and float
  // geometry gets re-clamped against it so the panel never drifts off screen.
  useLayoutEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    const apply = () => {
      const pw = host.clientWidth;
      const ph = host.clientHeight;
      if (pw === 0 || ph === 0) return;
      setParent({ w: pw, h: ph });
      setState((s) => {
        // Seed the float default (bottom-right) the first time we can measure.
        const seeded =
          s.geom ??
          (() => {
            const w = Math.min(DEFAULT_SIZE.w, pw - MARGIN * 2);
            const h = Math.min(DEFAULT_SIZE.h, ph - MARGIN * 2);
            return { w, h, x: pw - w - MARGIN, y: ph - h - MARGIN };
          })();
        return { ...s, geom: clampGeom(seeded, pw, ph), dockW: clampDockW(s.dockW, pw) };
      });
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  // Persist mode and both geometries so the panel comes back as it was left.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey(surface), JSON.stringify(state));
    } catch {
      /* ignore quota/availability errors */
    }
  }, [state, surface]);

  // Esc closes it, like every other dismissable overlay in the app.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const beginGesture = useCallback(
    (e: React.PointerEvent, onDelta: (dx: number, dy: number) => void) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const onMove = (ev: PointerEvent) => onDelta(ev.clientX - startX, ev.clientY - startY);
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    []
  );

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      if (docked || !parent || !geom) return;
      const base = geom;
      beginGesture(e, (dx, dy) =>
        setGeom(clampGeom({ ...base, x: base.x + dx, y: base.y + dy }, parent.w, parent.h))
      );
    },
    [beginGesture, docked, geom, parent, setGeom]
  );

  const startResize = useCallback(
    (e: React.PointerEvent, edge: Edge) => {
      if (!parent) return;
      if (docked) {
        // A docked stage only resizes along its inner edge, and only that edge
        // is rendered, so any grip here means "change the stage width".
        const base = dockW;
        const sign = mode === 'dock-right' ? -1 : 1;
        beginGesture(e, (dx) =>
          setState((s) => ({ ...s, dockW: clampDockW(base + sign * dx, parent.w) }))
        );
        return;
      }
      if (!geom) return;
      const base = geom;
      beginGesture(e, (dx, dy) =>
        setGeom(clampGeom(resizeBy(base, edge, dx, dy), parent.w, parent.h))
      );
    },
    [beginGesture, docked, dockW, geom, mode, parent, setGeom]
  );

  const setMode = useCallback((next: PanelMode) => setState((s) => ({ ...s, mode: next })), []);

  const dockWidth = parent ? clampDockW(dockW, parent.w) : dockW;
  const style: React.CSSProperties = docked
    ? parent
      ? {
          left: mode === 'dock-left' ? 0 : parent.w - dockWidth,
          top: 0,
          width: dockWidth,
          height: parent.h,
        }
      : { left: -9999, top: -9999, width: dockWidth, height: DEFAULT_SIZE.h }
    : geom
      ? { left: geom.x, top: geom.y, width: geom.w, height: geom.h }
      : // Park off-screen until the layout effect measures the parent and seeds a
        // real position, so the panel never flashes at 0,0.
        { left: -9999, top: -9999, width: DEFAULT_SIZE.w, height: DEFAULT_SIZE.h };

  const modeButtons: Array<{ mode: PanelMode; icon: typeof PanelLeft; label: string }> = [
    { mode: 'dock-left', icon: PanelLeft, label: t('locker.model.dockLeft', 'Dock left') },
    {
      mode: 'float',
      icon: PictureInPicture2,
      label: t('locker.model.float', 'Float'),
    },
    { mode: 'dock-right', icon: PanelRight, label: t('locker.model.dockRight', 'Dock right') },
  ];

  return (
    <div
      ref={ref}
      className={`absolute z-30 flex flex-col overflow-hidden border border-border/70 bg-bg-secondary/95 shadow-2xl backdrop-blur-md ${
        // Docked stages sit flush against their edge, so only the inner corners round.
        mode === 'dock-left'
          ? 'rounded-r-xl border-l-0'
          : mode === 'dock-right'
            ? 'rounded-l-xl border-r-0'
            : 'rounded-xl'
      }`}
      style={style}
    >
      <div
        onPointerDown={startDrag}
        className={`flex select-none items-center gap-2 border-b border-border/60 bg-bg-tertiary/60 px-3 py-2 ${
          docked ? '' : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        {!docked && <GripHorizontal className="h-4 w-4 flex-shrink-0 text-text-secondary" />}
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-text-primary">
          {title}
        </span>
        <div className="flex flex-shrink-0 items-center gap-0.5">
          {modeButtons.map(({ mode: target, icon: Icon, label }) => (
            <button
              key={target}
              type="button"
              onClick={() => setMode(target)}
              title={label}
              aria-label={label}
              aria-pressed={mode === target}
              className={`cursor-pointer rounded p-1 transition-colors ${
                mode === target
                  ? 'bg-accent/20 text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
          <button
            type="button"
            onClick={onClose}
            title={t('locker.model.close3d')}
            aria-label={t('locker.model.close3d')}
            className="-mr-1 cursor-pointer rounded p-1 text-text-secondary transition-colors hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body. `relative` so the viewer's absolute inset-0 states fill it, and
          `overflow-hidden` so overlay controls inside it cannot escape the panel. */}
      <div className="relative flex-1 overflow-hidden bg-bg-primary/40">{children}</div>

      {docked ? (
        <div
          onPointerDown={(e) => startResize(e, mode === 'dock-right' ? 'w' : 'e')}
          title={t('locker.model.resize')}
          className={`absolute inset-y-0 w-1.5 cursor-ew-resize ${
            mode === 'dock-right' ? 'left-0' : 'right-0'
          }`}
        />
      ) : (
        EDGE_GRIPS.map(({ edge, className }) => (
          <div
            key={edge}
            onPointerDown={(e) => startResize(e, edge)}
            title={t('locker.model.resize')}
            className={`absolute ${className} ${
              edge === 'se' ? 'flex items-end justify-end p-0.5' : ''
            }`}
          >
            {/* Only the classic bottom-right corner draws a glyph; the other
                seven grips are invisible hit areas along the frame. */}
            {edge === 'se' && (
              <svg viewBox="0 0 10 10" aria-hidden className="h-2.5 w-2.5 text-text-secondary/60">
                <path d="M9 1 L1 9 M9 5 L5 9" stroke="currentColor" strokeWidth="1.2" fill="none" />
              </svg>
            )}
          </div>
        ))
      )}
    </div>
  );
}
