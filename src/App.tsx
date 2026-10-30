import type { IVault } from '@augustdigital/sdk';
import { useEffect, useState } from 'react';
import { VaultDetail } from './components/VaultDetail';
import { EvmActions } from './components/EvmActions';
import { Positions } from './components/Positions';
import { SolanaActions } from './components/SolanaActions';
import { StellarActions } from './components/StellarActions';
import { VaultList } from './components/VaultList';
import { WalletBar } from './components/WalletBar';
import { createSdk } from './integration/sdk';
import {
  type VaultDetail as Detail,
  loadVaultDetail,
} from './integration/vault-detail';
import {
  type ChainFamily,
  type VaultsByFamily,
  familyOf,
  listVaultsByFamily,
} from './integration/vaults';
import { useWallets } from './integration/wallets';

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const sdk = createSdk();

export function App() {
  const [vaults, setVaults] = useState<LoadState<VaultsByFamily>>({
    status: 'loading',
  });
  const [selected, setSelected] = useState<IVault | null>(null);
  const [detail, setDetail] = useState<LoadState<Detail>>({
    status: 'loading',
  });
  const wallets = useWallets();

  useEffect(() => {
    let cancelled = false;
    listVaultsByFamily(sdk).then(
      (data) => cancelled || setVaults({ status: 'ready', data }),
      (error: unknown) =>
        cancelled ||
        setVaults({ status: 'error', message: errorMessage(error) }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setDetail({ status: 'loading' });
    loadVaultDetail(sdk, selected).then(
      (data) => cancelled || setDetail({ status: 'ready', data }),
      (error: unknown) =>
        cancelled ||
        setDetail({ status: 'error', message: errorMessage(error) }),
    );
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const openPosition = (family: ChainFamily, address: string) => {
    if (vaults.status !== 'ready') return undefined;
    const vault = vaults.data[family].find(
      (v) =>
        v.address === address ||
        (family === 'evm' && v.address.toLowerCase() === address.toLowerCase()),
    );
    return vault ? () => setSelected(vault) : undefined;
  };

  return (
    <main className="app">
      <header className="app-header">
        <h1>Upshift SDK Starter</h1>
        <WalletBar wallets={wallets} />
      </header>
      <p className="app-banner">
        Mainnet. Real funds. Connecting a wallet does not move anything;
        deposits and withdrawals ask for a signature first.
      </p>
      <Positions
        sdk={sdk}
        addresses={{
          evm: wallets.evm.address,
          solana: wallets.solana.address,
          stellar: wallets.stellar.address,
        }}
        onOpen={openPosition}
      />
      {selected ? (
        <>
          {detail.status !== 'ready' ? (
            <button
              type="button"
              className="link-button"
              onClick={() => setSelected(null)}
            >
              ← All vaults
            </button>
          ) : null}
          {detail.status === 'loading' ? <p>Loading {selected.name}…</p> : null}
          {detail.status === 'error' ? (
            <p role="alert">{detail.message}</p>
          ) : null}
          {detail.status === 'ready' ? (
            <>
              <VaultDetail
                vault={detail.data.vault}
                history={detail.data.history}
                historyError={detail.data.historyError}
                onBack={() => setSelected(null)}
              />
              {familyOf(detail.data.vault.chainId) === 'evm' ? (
                <EvmActions sdk={sdk} vault={detail.data.vault} />
              ) : null}
              {familyOf(detail.data.vault.chainId) === 'solana' ? (
                <SolanaActions sdk={sdk} vault={detail.data.vault} />
              ) : null}
              {familyOf(detail.data.vault.chainId) === 'stellar' ? (
                <StellarActions sdk={sdk} vault={detail.data.vault} />
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <>
          {vaults.status === 'loading' ? <p>Loading vaults…</p> : null}
          {vaults.status === 'error' ? (
            <p role="alert">{vaults.message}</p>
          ) : null}
          {vaults.status === 'ready' ? (
            <VaultList vaults={vaults.data} onSelect={setSelected} />
          ) : null}
        </>
      )}
    </main>
  );
}
