import { useEffect, useRef } from 'react';
import { App } from './App';
import { Layout } from './components/Layout';
import { IntegrateLanding } from './pages/IntegrateLanding';
import { vaultTarget } from './integrate/paths';
import { IntegratePage } from './pages/IntegratePage';
import { Link, type Route, matchRoute, usePathname } from './router';

const SITE = 'Upshift SDK Example';

const TITLES: Record<Route['name'], string> = {
  home: `${SITE}: Vaults on EVM, Solana and Stellar`,
  vaults: `Vaults · ${SITE}`,
  vault: `Vault · ${SITE}`,
  integrate: `Integrate a vault · ${SITE}`,
  'not-found': `Page not found · ${SITE}`,
};

/** Sets the tab title per route and, after a client-side navigation, moves
 * focus to the new page's h1 so screen readers announce it. */
function useRouteAnnouncement(pathname: string, title: string) {
  const previous = useRef(pathname);
  useEffect(() => {
    document.title = title;
    if (previous.current === pathname) return;
    previous.current = pathname;
    const heading = document.querySelector<HTMLElement>('main h1');
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus();
  }, [pathname, title]);
}

function NotFound({ pathname }: { pathname: string }) {
  return (
    <>
      <meta name="robots" content="noindex" />
      <h1>Page not found</h1>
      <p>
        Nothing lives at <code>{pathname}</code>.
      </p>
      <nav className="not-found-links" aria-label="Ways back">
        <Link to="/">Home</Link>
        <Link to="/vaults">All vaults</Link>
      </nav>
    </>
  );
}

export function Root() {
  const pathname = usePathname();
  const route = matchRoute(pathname);
  useRouteAnnouncement(pathname, TITLES[route.name]);
  return (
    <Layout current={route.name}>
      {route.name === 'home' ? <IntegrateLanding /> : null}
      {route.name === 'vaults' || route.name === 'vault' ? (
        <App target={vaultTarget(route)} />
      ) : null}
      {route.name === 'integrate' ? (
        <IntegratePage
          key={`${route.chain}/${route.address}`}
          chain={route.chain}
          address={route.address}
        />
      ) : null}
      {route.name === 'not-found' ? <NotFound pathname={pathname} /> : null}
    </Layout>
  );
}
