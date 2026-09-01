import { type KeyboardEvent } from 'react';

/**
 * The one chip visual language shared by the catalogue's filter chips and
 * every option button, plus the roving-focus key handler they share.
 *
 * These live outside the components so fast refresh keeps working (a component
 * module that also exports helpers loses it).
 */

const CHIP_BASE =
  'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:opacity-50';
const CHIP_ACTIVE = 'border-accent/70 bg-accent/15 text-text-primary';
const CHIP_INACTIVE = 'border-border bg-bg-tertiary text-text-secondary hover:border-accent/40 hover:text-text-primary';

export function chipClass(active: boolean): string {
  return `${CHIP_BASE} ${active ? CHIP_ACTIVE : CHIP_INACTIVE}`;
}

/**
 * Move DOM focus between sibling buttons inside a control group. Focus only:
 * activating an option writes saved YAML, so an arrow key must not mutate the
 * document the way SegmentedControl's arrow handler does.
 */
export function rovingArrowKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
  const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
  const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
  if (!forward && !back) return;
  const button = event.currentTarget;
  const siblings = Array.from(button.parentElement?.querySelectorAll('button') ?? []);
  const index = siblings.indexOf(button);
  if (index === -1 || siblings.length < 2) return;
  event.preventDefault();
  const next = siblings[(index + (forward ? 1 : siblings.length - 1)) % siblings.length];
  next.focus();
}
