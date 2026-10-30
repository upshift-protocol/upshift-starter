import type { IVault } from '@augustdigital/sdk';
import type { ChainFamily, VaultsByFamily } from '../integration/vaults';

const FAMILIES: Record<ChainFamily, string> = {
  evm: 'EVM',
  solana: 'Solana',
  stellar: 'Stellar',
};
const tvl = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

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
  onSelect,
}: {
  vaults: VaultsByFamily;
  onSelect?: (vault: IVault) => void;
}) {
  return (
    <div>
      {(Object.keys(FAMILIES) as ChainFamily[]).map((family) => (
        <section key={family} className="vault-family">
          <h2>{FAMILIES[family]}</h2>
          {vaults[family].length === 0 ? <p>No vaults returned.</p> : null}
          <ul className="vault-rows">
            {vaults[family].map((vault) => (
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
      ))}
    </div>
  );
}
