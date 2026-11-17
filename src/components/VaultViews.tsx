import { integratePath, vaultPath } from '../integrate/paths';
import { Link } from '../router';

export function VaultViews({
  vault,
  current,
}: {
  vault: { chainId: number; address: string };
  current: 'overview' | 'integrate';
}) {
  const integrate = integratePath(vault);
  if (!integrate) return null;
  const views = [
    ['overview', 'Overview', vaultPath(vault)],
    ['integrate', 'Integrate', integrate],
  ] as const;
  return (
    <nav className="view-toggle" aria-label="Vault view">
      {views.map(([view, label, to]) => (
        <Link
          key={view}
          to={to}
          aria-current={view === current ? 'page' : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
