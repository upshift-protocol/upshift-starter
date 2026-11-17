import type { ReactNode } from 'react';
import { useWallets } from '../integration/wallets';
import { Link, type Route } from '../router';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { WalletBar } from './WalletBar';

type LayoutProps = { current: Route['name']; children: ReactNode };

export function Layout({ current, children }: LayoutProps) {
  const wallets = useWallets();
  const section =
    current === 'integrate' || current === 'vault' ? 'vaults' : current;
  const here = (name: Route['name']) => (name === section ? 'page' : undefined);
  return (
    <main className="app">
      <header className="app-header">
        <Link to="/" className="app-brand">
          <Logo />
          <span>Upshift</span> <small>SDK Example</small>
        </Link>
        <nav className="app-nav" aria-label="Main">
          <Link to="/" aria-current={here('home')}>
            Integrate
          </Link>
          <Link to="/vaults" aria-current={here('vaults')}>
            Vaults
          </Link>
        </nav>
        <div className="app-actions">
          <WalletBar wallets={wallets} />
          <ThemeToggle />
        </div>
      </header>
      {children}
    </main>
  );
}
