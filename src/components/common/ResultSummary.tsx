interface ResultSummaryProps {
  /** A concise reminder of the fields this surface searches. Shown when idle. */
  scope?: string;
  /** Replaces `scope` while narrowed, e.g. "Showing 3 of 47 mods". */
  summary?: string;
  /** Set when a field points at this with aria-describedby. */
  id?: string;
  className?: string;
}

/**
 * What a filtered list says about itself, in one place.
 *
 * A list that just gets shorter tells a sighted user something and a screen
 * reader user nothing, so the count belongs in a live region. The app had
 * roughly twenty live regions across sixteen files and no shared answer for
 * this one: some surfaces printed "Showing X of Y" as ordinary text well below
 * the field, some announced their loading skeleton instead, and two did both at
 * once, which is worse than either.
 *
 * `role="status"` rather than `aria-live` on a container: the whole paragraph is
 * the message, so it should be announced as one, and status is already implicitly
 * polite. `tabular-nums` keeps the digits from shifting the line as the count
 * changes under a keystroke.
 *
 * The zero-result state stays at the call site, because only the page knows what
 * the useful next action is. It must offer one.
 */
export default function ResultSummary({ scope, summary, id, className = '' }: ResultSummaryProps) {
  const text = summary ?? scope;
  if (!text) return null;
  return (
    <p id={id} role="status" className={`tabular-nums text-text-secondary ${className}`}>
      {text}
    </p>
  );
}
