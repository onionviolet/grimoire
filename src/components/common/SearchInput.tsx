import { useId, type KeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';

/**
 * One search field, with the contract every search surface owes the user.
 *
 * Roughly thirty hand-rolled text and search inputs exist across the app, each
 * deciding for itself whether to say what it searches, whether to report how
 * much it narrowed, and whether Escape clears it. This started as Foundry's
 * `FoundrySearchInput` and is promoted here so the answer is the same
 * everywhere:
 *
 * - **Scope is visible.** A field that silently searches names but not paths
 *   reads as broken when a pasted path finds nothing.
 * - **The result count is stated** while narrowed, in a live region, so a
 *   filtered list announces itself rather than just getting shorter.
 * - **The clear control is labelled**, and Escape clears while focused. The
 *   handler stops there, so it never steals Escape from a modal.
 *
 * The zero-result state stays at the call site, because only the page knows
 * what the useful next action is. It must offer one.
 */

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** A concise reminder of the fields this surface searches. Shown when idle. */
  scope: string;
  clearLabel: string;
  /** Visible label above the field. Omit where the surrounding context names it. */
  label?: string;
  /** Replaces `scope` while narrowed, e.g. "Showing 3 of 47 mods". */
  summary?: string;
  className?: string;
}

export default function SearchInput({
  value,
  onChange,
  placeholder,
  scope,
  clearLabel,
  label,
  summary,
  className = '',
}: SearchInputProps) {
  const id = useId();
  const summaryId = `${id}-summary`;

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Only when there is something to clear, so an empty field lets Escape
    // reach whatever encloses it (a modal, a popover).
    if (event.key === 'Escape' && value) {
      event.preventDefault();
      onChange('');
    }
  };

  return (
    <div className={`min-w-[200px] flex-1 ${className}`}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-text-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          id={id}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-describedby={summaryId}
          className="w-full rounded-sm border border-border bg-bg-tertiary py-2 pl-9 pr-9 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent/50 focus:outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={clearLabel}
            title={clearLabel}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-accent cursor-pointer"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {/* One live region per field: a narrowed list should announce what it
          narrowed to, not leave the user to notice it got shorter. */}
      <p id={summaryId} role="status" className="mt-1 text-[11px] tabular-nums text-text-secondary">
        {summary ?? scope}
      </p>
    </div>
  );
}
