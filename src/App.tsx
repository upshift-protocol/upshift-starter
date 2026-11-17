import type { IVault } from '@upshiftfinance/sdk';
import { useEffect, useState } from 'react';
import { VaultDetail } from './components/VaultDetail';
import { EvmActions } from './components/EvmActions';
import { Positions } from './components/Positions';
import { SolanaActions } from './components/SolanaActions';
import { StellarActions } from './components/StellarActions';
import { VaultList } from './components/VaultList';
import { vaultPath } from './integrate/paths';
import { sdk } from './integration/starter-sdk';
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
import { navigate } from './router';

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

// The list outlives App: Root unmounts it off /vaults and remounts it on a
// nav click. Neither should refetch or flash the loading state.
let cachedVaults: VaultsByFamily | null = null;

/** Forget the cached vault list (tests). */
export function clearVaultCache() {
  cachedVaults = null;
}

function findVault(
  vaults: VaultsByFamily,
  { chainId, address }: VaultRef,
): IVault | null {
  const family = familyOf(chainId);
  return (
    vaults[family].find(
      (v) =>
        v.chainId === chainId &&
        (family === 'evm'
          ? v.address.toLowerCase() === address.toLowerCase()
          : v.address === address),
    ) ?? null
  );
}

type VaultRef = { chainId: number; address: string };

export function App({ target = null }: { target?: VaultRef | null }) {
  const [vaults, setVaults] = useState<LoadState<VaultsByFamily>>(() =>
    cachedVaults
      ? { status: 'ready', data: cachedVaults }
      : { status: 'loading' },
  );
  const selected =
    target && vaults.status === 'ready' ? findVault(vaults.data, target) : null;
  const [family, setFamily] = useState<ChainFamily>(() =>
    target ? familyOf(target.chainId) : 'evm',
  );
  const [detail, setDetail] = useState<LoadState<Detail>>({
    status: 'loading',
  });
  const wallets = useWallets();

  useEffect(() => {
    if (cachedVaults) return;
    let cancelled = false;
    listVaultsByFamily(sdk).then(
      (data) => {
        cachedVaults = data;
        if (!cancelled) setVaults({ status: 'ready', data });
      },
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

  const open = (vault: IVault) => {
    setFamily(familyOf(vault.chainId));
    navigate(vaultPath(vault));
  };
  const back = () => navigate('/vaults');
  const shown =
    selected &&
    detail.status === 'ready' &&
    detail.data.vault.address === selected.address
      ? detail.data
      : null;

  const openPosition = (family: ChainFamily, address: string) => {
    if (vaults.status !== 'ready') return undefined;
    const vault = vaults.data[family].find(
      (v) =>
        v.address === address ||
        (family === 'evm' && v.address.toLowerCase() === address.toLowerCase()),
    );
    return vault ? () => open(vault) : undefined;
  };

  return (
    <>
      <h1>Vaults</h1>
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
      {target ? (
        <>
          {shown ? null : (
            <button type="button" className="link-button" onClick={back}>
              ← All vaults
            </button>
          )}
          {vaults.status === 'loading' ? <p>Loading vaults…</p> : null}
          {vaults.status === 'error' ? (
            <p role="alert">{vaults.message}</p>
          ) : null}
          {vaults.status === 'ready' && !selected ? (
            <p>
              No vault at <code>{target.address}</code>.
            </p>
          ) : null}
          {selected && !shown && detail.status !== 'error' ? (
            <p>Loading {selected.name}…</p>
          ) : null}
          {selected && detail.status === 'error' ? (
            <p role="alert">{detail.message}</p>
          ) : null}
          {shown ? (
            <>
              <VaultDetail
                vault={shown.vault}
                history={shown.history}
                historyError={shown.historyError}
                onBack={back}
              />
              {familyOf(shown.vault.chainId) === 'evm' ? (
                <EvmActions sdk={sdk} vault={shown.vault} />
              ) : null}
              {familyOf(shown.vault.chainId) === 'solana' ? (
                <SolanaActions sdk={sdk} vault={shown.vault} />
              ) : null}
              {familyOf(shown.vault.chainId) === 'stellar' ? (
                <StellarActions sdk={sdk} vault={shown.vault} />
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
            <VaultList
              vaults={vaults.data}
              active={family}
              onActiveChange={setFamily}
              onSelect={open}
            />
          ) : null}
        </>
      )}
    </>
  );
}
