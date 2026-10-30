import { type IVault, toNormalizedBn } from '@augustdigital/sdk';
import { useEffect, useState } from 'react';
import {
  type StellarAccount,
  type StellarBalances,
  depositMax,
  previewShares,
  readStellarAccount,
  readStellarBalances,
  stellarDeposit,
  stellarExplorerLink,
  stellarWithdraw,
} from '../integration/stellar/actions';
import type { createSdk } from '../integration/sdk';
import { useTxFlow } from '../integration/tx-flow';
import { useStellarWallet } from '../integration/stellar/wallet';
import { depositAssetOf } from '../integration/vaults';
import { TxStatus } from './TxStatus';

type Mode = 'deposit' | 'withdraw';
const UNFUNDED_POLL_MS = 8000;
const UNKNOWN_RETRY_MS = 5000;
const UNKNOWN_RETRIES = 3;

export function StellarActions({
  sdk,
  vault,
}: {
  sdk: ReturnType<typeof createSdk>;
  vault: IVault;
}) {
  const wallet = useStellarWallet();
  const [mode, setMode] = useState<Mode>('deposit');
  const [amount, setAmount] = useState('');
  const [balances, setBalances] = useState<StellarBalances | null>(null);
  const [account, setAccount] = useState<StellarAccount>({
    funded: null,
    spendableXlm: null,
  });
  const [preview, setPreview] = useState<string | null>(null);
  const { phase, run, reset } = useTxFlow();

  const address = wallet.address;
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let unknownRetries = 0;
    const check = async () => {
      const next = await readStellarAccount(address);
      if (cancelled) return;
      setAccount(next);
      if (next.funded === false) {
        timer = setTimeout(check, UNFUNDED_POLL_MS);
      } else if (next.funded === null && unknownRetries < UNKNOWN_RETRIES) {
        unknownRetries += 1;
        timer = setTimeout(check, UNKNOWN_RETRY_MS);
      }
    };
    check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [address]);

  useEffect(() => {
    if (!address) {
      setBalances(null);
      return;
    }
    let cancelled = false;
    readStellarBalances(sdk, address, vault).then(
      (next) => cancelled || setBalances(next),
    );
    return () => {
      cancelled = true;
    };
  }, [sdk, address, vault, phase.status]);

  useEffect(() => {
    if (mode !== 'deposit' || !(Number(amount) > 0)) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    previewShares(sdk, vault, amount)
      .catch(() => null)
      .then((next) => cancelled || setPreview(next));
    return () => {
      cancelled = true;
    };
  }, [sdk, vault, mode, amount]);

  const asset = depositAssetOf(vault);
  const shares = balances?.shares ?? null;
  const shareBalance = shares
    ? toNormalizedBn(BigInt(shares.amount), shares.decimals).normalized
    : null;
  const max =
    mode === 'deposit'
      ? depositMax(balances?.deposit ?? null, asset.address, account)
      : shareBalance;
  const unfunded = account.funded === false;
  const sharesUntrusted = mode === 'withdraw' && !shares?.trusted;
  const overMax = max !== null && Number(amount) > Number(max);
  const canSubmit =
    wallet.connected &&
    Number(amount) > 0 &&
    !unfunded &&
    !sharesUntrusted &&
    !overMax &&
    phase.status !== 'submitting';

  const submit = () => {
    if (!address) return;
    const signer = { address, signTransaction: wallet.signTransaction };
    run(() =>
      mode === 'deposit'
        ? stellarDeposit(sdk, signer, vault, amount)
        : stellarWithdraw(
            sdk,
            signer,
            vault,
            amount,
            (shares as NonNullable<typeof shares>).decimals,
          ),
    ).then((hash) => hash && setAmount(''));
  };

  if (!wallet.connected) return <p>Connect Freighter to transact.</p>;

  return (
    <div className="tx-form">
      {unfunded ? (
        <p role="alert" className="tx-error">
          This Stellar account is not activated. Send at least 1 XLM to{' '}
          <code>{address}</code>, then wait. This check re-runs every 8 s.
        </p>
      ) : null}
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
      {overMax && mode === 'deposit' && balances?.deposit !== max ? (
        <small>
          Native XLM keeps the account reserve and fee; the full balance is not
          depositable.
        </small>
      ) : null}
      {mode === 'deposit' && Number(amount) > 0 ? (
        <small>Estimated shares: {preview ?? 'unknown'}</small>
      ) : null}
      {sharesUntrusted && shares ? (
        <small role="status">
          Share decimals could not be read on-chain; withdrawals are paused
          until they can.
        </small>
      ) : null}
      <button type="button" disabled={!canSubmit} onClick={submit}>
        {mode === 'deposit' ? 'Deposit' : 'Withdraw'}
      </button>
      <TxStatus phase={phase} explorerLink={stellarExplorerLink} />
    </div>
  );
}
