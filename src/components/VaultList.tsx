import type { IVault } from '@augustdigital/sdk';
import { type KeyboardEvent, useId } from 'react';
import {
  type ChainFamily,
  FAMILY_LABELS,
  type VaultsByFamily,
} from '../integration/vaults';
const tvl = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const FAMILIES = Object.keys(FAMILY_LABELS) as ChainFamily[];

function formatTvl(vault: IVault) {
  const amount = tvl.format(Number(vault.totalAssets?.normalized ?? 0));
  return `${amount} ${vault.depositAssets?.[0]?.symbol ?? ''}`.trim();
}

function formatApy(vault: IVault) {
  const apy = vault.apy?.apy;
  return typeof apy === 'number' ? `${apy.toFixed(2)}%` : 'n/a';
}

export function VaultList({
  vaults,
  active,
  onActiveChange,
  onSelect,
}: {
  vaults: VaultsByFamily;
  active: ChainFamily;
  onActiveChange: (family: ChainFamily) => void;
  onSelect?: (vault: IVault) => void;
}) {
  const id = useId();
  const tabId = (family: ChainFamily) => `${id}-${family}`;
  const onKeyDown = (event: KeyboardEvent) => {
    const index = FAMILIES.indexOf(active);
    const next = {
      ArrowRight: FAMILIES[(index + 1) % FAMILIES.length],
      ArrowLeft: FAMILIES[(index + FAMILIES.length - 1) % FAMILIES.length],
      Home: FAMILIES[0],
      End: FAMILIES[FAMILIES.length - 1],
    }[event.key];
    if (!next) return;
    event.preventDefault();
    onActiveChange(next);
    document.getElementById(tabId(next))?.focus();
  };
  return (
    <div className="vault-list">
      <div
        role="tablist"
        aria-label="Chain"
        className="chain-tabs"
        onKeyDown={onKeyDown}
      >
        {FAMILIES.map((family) => (
          <button
            key={family}
            id={tabId(family)}
            type="button"
            role="tab"
            aria-selected={family === active}
            aria-controls={`${id}-panel`}
            tabIndex={family === active ? 0 : -1}
            onClick={() => onActiveChange(family)}
          >
            {FAMILY_LABELS[family]}
            <span className="chain-count">{vaults[family].length}</span>
          </button>
        ))}
      </div>
      <section
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={tabId(active)}
        className="vault-family"
      >
        {vaults[active].length === 0 ? <p>No vaults returned.</p> : null}
        <ul className="vault-rows">
          <li className="vault-head" aria-hidden="true">
            <span>Vault</span>
            <span>Address</span>
            <span>APY</span>
            <span>TVL</span>
          </li>
          {vaults[active].map((vault) => (
            <li key={`${vault.chainId}:${vault.address}`}>
              <button
                type="button"
                className="vault-row"
                onClick={() => onSelect?.(vault)}
              >
                <span>{vault.name}</span>
                <span className="vault-address">{vault.address}</span>
                <span className="vault-metric">{formatApy(vault)}</span>
                <span className="vault-metric">{formatTvl(vault)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
