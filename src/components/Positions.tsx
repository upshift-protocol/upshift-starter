import { useEffect, useState } from 'react';
import {
  type ConnectedAddresses,
  type PositionsResult,
  readPositions,
} from '../integration/positions';
import type { createSdk } from '../integration/sdk';
import { type ChainFamily, FAMILY_LABELS } from '../integration/vaults';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; result: PositionsResult };

export function Positions({
  sdk,
  addresses,
  onOpen,
}: {
  sdk: ReturnType<typeof createSdk>;
  addresses: ConnectedAddresses;
  onOpen?: (family: ChainFamily, vault: string) => (() => void) | undefined;
}) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [retries, setRetries] = useState(0);
  const { evm, solana, stellar } = addresses;

  useEffect(() => {
    if (!evm && !solana && !stellar) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    readPositions(sdk, { evm, solana, stellar }).then(
      (result) => cancelled || setState({ status: 'ready', result }),
    );
    return () => {
      cancelled = true;
    };
  }, [sdk, evm, solana, stellar, retries]);

  if (state.status === 'idle') return null;
  const result = state.status === 'ready' ? state.result : null;
  return (
    <section className="positions">
      <h2>Your positions</h2>
      <small>
        EVM positions cover Ethereum mainnet, the one chain this app configures.
      </small>
      {state.status === 'loading' ? <p>Loading positions…</p> : null}
      {result && result.failed.length > 0 ? (
        <p role="alert">
          Could not read {result.failed.map((f) => FAMILY_LABELS[f]).join(', ')}{' '}
          positions.{' '}
          <button
            type="button"
            className="link-button"
            onClick={() => setRetries((count) => count + 1)}
          >
            Retry
          </button>
        </p>
      ) : null}
      {result && result.failed.length === 0 && result.rows.length === 0 ? (
        <p>No positions for the connected wallets.</p>
      ) : null}
      {result && result.rows.length > 0 ? (
        <ul className="vault-rows position-rows">
          <li className="vault-head" aria-hidden="true">
            <span>Vault</span>
            <span>Status</span>
            <span>Balance</span>
            <span>Redeemable</span>
          </li>
          {result.rows.map(({ family, position: p }) => {
            const open = onOpen?.(family, p.vault);
            return (
              <li key={`${family}:${p.vault}`}>
                <button
                  type="button"
                  className="vault-row"
                  disabled={!open}
                  onClick={open}
                >
                  <span className="vault-address">{p.vault}</span>
                  <span>{p.status}</span>
                  <span className="vault-metric">
                    {p.walletBalance.normalized} shares
                  </span>
                  <span className="vault-metric">
                    {p.redeemable.normalized} redeemable
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
