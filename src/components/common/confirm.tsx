import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmModal } from './PageComponents';
import { ConfirmContext, type ConfirmFn, type ConfirmRequest } from './confirmContext';

/**
 * One confirmation dialog, as a promise.
 *
 * Destructive and consequential confirmations used to be `window.confirm` in
 * twelve places. In Electron a native confirm blocks the renderer, ignores the
 * app's visual language, gives a destructive action the same styling as a
 * benign one, and cannot render the affected mods as a scannable list, so
 * several call sites joined them into one comma string. The app already owns
 * `common/Modal` (focus handling, Escape, backdrop dismissal) and a
 * `ConfirmModal` built on it; what was missing was a way to await one from an
 * imperative call site, which is what kept those twelve on the native dialog.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  // The pending answer. Held in a ref rather than state so settling it never
  // depends on a render having happened first.
  const resolveRef = useRef<((answer: boolean) => void) | null>(null);

  // Stable, so call sites can list it as a hook dependency.
  const confirm = useCallback<ConfirmFn>((next) => {
    // A second request while one is open would strand the first promise
    // forever, and an un-awaited confirm is a silently stuck action. Decline
    // the older one rather than leak it.
    resolveRef.current?.(false);
    setRequest(next);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const settle = useCallback((answer: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setRequest(null);
    resolve?.(answer);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmModal
        isOpen={request !== null}
        title={request?.title ?? ''}
        variant={request?.variant ?? 'primary'}
        confirmLabel={request?.confirmLabel}
        cancelLabel={request?.cancelLabel}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
        message={
          <>
            {request?.message}
            {request?.items && request.items.length > 0 && (
              <>
                <p className="mt-3 text-xs uppercase tracking-wide text-text-secondary">
                  {t('common.confirm.affects', { count: request.items.length })}
                </p>
                <ul className="mt-1.5 max-h-48 space-y-1 overflow-y-auto scrollbar-glass rounded-md border border-border bg-bg-sunken/60 p-2">
                  {request.items.map((item) => (
                    <li key={item} className="truncate text-sm text-text-primary" title={item}>
                      {item}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}
