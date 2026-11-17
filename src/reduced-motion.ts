import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function query() {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY)
    : null;
}

function subscribe(onChange: () => void) {
  const list = query();
  list?.addEventListener?.('change', onChange);
  return () => list?.removeEventListener?.('change', onChange);
}

const read = () => query()?.matches ?? false;

/** Follows the OS reduced-motion setting live; false where matchMedia is
 * missing (old browsers, jsdom). */
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, read, () => false);
}
