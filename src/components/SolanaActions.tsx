import type { IVault } from '@augustdigital/sdk';
import { useEffect, useState } from 'react';
import {
  type SolanaBalances,
  depositAssetOf,
  normalizeBalance,
  readSolanaBalances,
  solanaDeposit,
  solanaExplorerLink,
  solanaWithdraw,
} from '../integration/actions/solana';
import type { createSdk } from '../integration/sdk';
import { useTxFlow } from '../integration/tx-flow';
import { useSolanaWallet } from '../integration/wallets/solana';
import { TxStatus } from './TxStatus';

type Mode = 'deposit' | 'withdraw';

export function SolanaActions({
  sdk,
  vault,
}: {
  sdk: ReturnType<typeof createSdk>;
  vault: IVault;
}) {
  const wallet = useSolanaWallet();
  const [mode, setMode] = useState<Mode>('deposit');
  const [amount, setAmount] = useState('');
  const [balances, setBalances] = useState<SolanaBalances | null>(null);
  const { phase, run, reset } = useTxFlow();

  const address = wallet.address;
  const refreshKey = phase.status === 'success' ? phase.hash : null;
  useEffect(() => {
    if (!address) {
      setBalances(null);
      return;
    }
    let cancelled = false;
    readSolanaBalances(sdk, address, vault).then(
      (next) => cancelled || setBalances(next),
    );
    return () => {
      cancelled = true;
    };
  }, [sdk, address, vault, refreshKey]);

  const asset = depositAssetOf(vault);
  const shares = balances?.shares ?? null;
  const balance = mode === 'deposit' ? balances?.deposit : shares;
  const max = balance ? normalizeBalance(balance) : null;
  const balanceUnavailable = balances !== null && !balance;
  const ready = Boolean(wallet.publicKey && wallet.signTransaction);
  const overMax = max !== null && Number(amount) > Number(max);
  const canSubmit =
    ready &&
    Number(amount) > 0 &&
    !overMax &&
    phase.status !== 'submitting' &&
    (mode === 'deposit' || shares !== null);

  const submit = () => {
    const { publicKey, signTransaction } = wallet;
    if (!publicKey || !signTransaction) return;
    const signer = { publicKey, signTransaction };
    run(() =>
      mode === 'deposit'
        ? solanaDeposit(sdk, signer, vault, amount)
        : solanaWithdraw(
            sdk,
            signer,
            vault,
            amount,
            (shares as NonNullable<typeof shares>).decimals,
          ),
    ).then((hash) => hash && setAmount(''));
  };

  if (!wallet.connected) return <p>Connect a Solana wallet to transact.</p>;

  return (
    <div className="tx-form">
      <div className="tx-tabs">
        {(['deposit', 'withdraw'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              setAmount('');
              reset();
            }}
          >
            {m === 'deposit' ? `Deposit ${asset.symbol}` : 'Withdraw shares'}
          </button>
        ))}
      </div>
      <label className="tx-field">
        <span>
          Amount{' '}
          <small>
            Balance: {max ?? 'unknown'}
            {max ? (
              <button
                type="button"
                className="link-button"
                onClick={() => setAmount(max)}
              >
                Max
              </button>
            ) : null}
          </small>
        </span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            reset();
          }}
        />
      </label>
      {balanceUnavailable ? (
        <p role="alert">
          Balance unavailable. The Solana RPC could not read your token
          accounts. Use an RPC that allows getTokenAccountsByOwner and set
          VITE_RPC_SOLANA.
        </p>
      ) : null}
      <small>Slippage floor: 50 bps (SDK default).</small>
      <button type="button" disabled={!canSubmit} onClick={submit}>
        {ready
          ? mode === 'deposit'
            ? 'Deposit'
            : 'Withdraw'
          : 'Reconnect wallet'}
      </button>
      <TxStatus phase={phase} explorerLink={solanaExplorerLink} />
    </div>
  );
}
