import type { KeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';

interface FoundrySearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** A concise reminder of the fields searched by this surface. */
  scope: string;
  clearLabel: string;
}

/**
 * The catalog views deliberately share one small search treatment. It keeps the
 * searched fields visible, offers a labelled reset, and gives Escape its usual
 * local meaning without interfering with modal-level Escape handlers.
 */
export default function FoundrySearchInput({
  value,
  onChange,
  placeholder,
  scope,
  clearLabel,
}: FoundrySearchInputProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && value) {
      event.preventDefault();
      onChange('');
    }
  };

  return (
    <div className="min-w-[200px] flex-1">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-sm border border-border bg-bg-tertiary py-2 pl-9 pr-9 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent/50 focus:outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={clearLabel}
            title={clearLabel}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] text-text-secondary">{scope}</p>
    </div>
  );
}
