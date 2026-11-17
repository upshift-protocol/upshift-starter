import {
  type AnchorHTMLAttributes,
  type MouseEvent,
  useSyncExternalStore,
} from 'react';

export const CHAIN_SLUGS = ['ethereum', 'solana', 'stellar'] as const;
export type ChainSlug = (typeof CHAIN_SLUGS)[number];

export type Route =
  | { name: 'home' }
  | { name: 'vaults' }
  | { name: 'vault'; chain: string; address: string }
  | { name: 'integrate'; chain: ChainSlug; address: string }
  | { name: 'not-found' };

const NAVIGATE_EVENT = 'starter:navigate';
const INTEGRATE_PATH = /^\/vaults\/([^/]+)\/([^/]+)\/integrate$/;
const VAULT_PATH = /^\/vaults\/([^/]+)\/([^/]+)$/;

const isChainSlug = (slug: string): slug is ChainSlug =>
  (CHAIN_SLUGS as readonly string[]).includes(slug);

export function matchRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return { name: 'home' };
  if (path === '/vaults') return { name: 'vaults' };
  const [, chain = '', address = ''] = path.match(INTEGRATE_PATH) ?? [];
  if (isChainSlug(chain)) return { name: 'integrate', chain, address };
  const [, segment = '', vault = ''] = path.match(VAULT_PATH) ?? [];
  if (isChainSlug(segment) || /^\d+$/.test(segment)) {
    return { name: 'vault', chain: segment, address: vault };
  }
  return { name: 'not-found' };
}

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener(NAVIGATE_EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(NAVIGATE_EVENT, onChange);
  };
}

function readPathname() {
  return window.location.pathname;
}

export function usePathname() {
  return useSyncExternalStore(subscribe, readPathname);
}

export function navigate(to: string) {
  const { pathname, search, hash } = window.location;
  if (to === pathname + search + hash)
    window.history.replaceState(null, '', to);
  else window.history.pushState(null, '', to);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
  window.scrollTo(0, 0);
}

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.button === 0 &&
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function Link({
  to,
  onClick,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  to: `/${string}`;
}) {
  return (
    <a
      {...props}
      href={to}
      onClick={(event) => {
        onClick?.(event);
        const opensElsewhere =
          (props.target !== undefined && props.target !== '_self') ||
          props.download !== undefined;
        if (opensElsewhere || !isPlainLeftClick(event)) return;
        event.preventDefault();
        navigate(to);
      }}
    />
  );
}
