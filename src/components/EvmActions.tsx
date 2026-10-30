import type { IVault } from '@augustdigital/sdk';
import { useEffect, useState } from 'react';
import {
  type EvmBalances,
  type EvmRedemptions,
  evmApprove,
  evmClaim,
  evmDeposit,
  evmRequestRedeem,
  readEvmBalances,
  readEvmRedemptions,
} from '../integration/actions/evm';
import { depositAssetOf } from '../integration/actions/solana';
import {
  evmChainOf,
  evmExplorerLink,
  parseAmount,
} from '../integration/evm-chains';
import type { createSdk } from '../integration/sdk';
import { useTxFlow } from '../integration/tx-flow';
import { useEvmWallet } from '../integration/wallets/evm';
import { TxStatus } from './TxStatus';

type Mode = 'deposit' | 'withdraw' | 'claim';
type Approval = 'unknown' | 'pending' | 'done';
type Redemptions =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: EvmRedemptions };

export function EvmActions({
  sdk,
  vault,
}: {
  sdk: ReturnType<typeof createSdk>;
  vault: IVault;
}) {
  const wallet = useEvmWallet();
  const [mode, setMode] = useState<Mode>('deposit');
  const [amount, setAmount] = useState('');
  const [approval, setApproval] = useState<Approval>('unknown');
  const [balances, setBalances] = useState<EvmBalances | null>(null);
  const [redemptions, setRedemptions] = useState<Redemptions>({
    status: 'loading',
  });
  const [retries, setRetries] = useState(0);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const { phase, run, reset } = useTxFlow();

  const address = wallet.address;
  useEffect(() => {
    if (!address) {
      setBalances(null);
      setRedemptions({ status: 'loading' });
      return;
    }
    let cancelled = false;
    readEvmBalances(sdk, address, vault).then(
      (next) => cancelled || setBalances(next),
    );
    readEvmRedemptions(sdk, vault, address).then(
      (data) => cancelled || setRedemptions({ status: 'ready', data }),
      () => cancelled || setRedemptions({ status: 'error' }),
    );
    return () => {
      cancelled = true;
    };
  }, [sdk, address, vault, phase.status, retries]);

  const retryRedemptions = () => {
    setRedemptions({ status: 'loading' });
    setRetries((count) => count + 1);
  };

  const asset = depositAssetOf(vault);
  const chain = evmChainOf(vault.chainId);
  const wrongNetwork = wallet.chainId !== vault.chainId;
  const max = mode === 'deposit' ? balances?.deposit : balances?.shares;
  const decimals = mode === 'deposit' ? asset.decimals : vault.receipt.decimals;
  const rawAmount = parseAmount(amount, decimals);
  const rawMax = max ? parseAmount(max, decimals) : null;
  const malformed = amount !== '' && rawAmount === null;
  const overMax = rawAmount !== null && rawMax !== null && rawAmount > rawMax;
  const ready = Boolean(address && wallet.walletClient && !wrongNetwork);
  const busy = phase.status === 'submitting';
  const canAct =
    ready && rawAmount !== null && rawAmount > 0n && !overMax && !busy;
  const claimUnit =
    vault.version === 'evm-2' ? vault.receipt.symbol : asset.symbol;

  const switchNetwork = async () => {
    setSwitchError(null);
    try {
      await wallet.switchChain(vault.chainId);
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : String(error));
    }
  };

  const withSigner = (
    fn: (
      signer: NonNullable<typeof wallet.walletClient>,
      owner: string,
    ) => Promise<string | null>,
  ) => {
    if (!address || !wallet.walletClient) return Promise.resolve(null);
    return run(() =>
      fn(
        wallet.walletClient as NonNullable<typeof wallet.walletClient>,
        address,
      ),
    );
  };

  const approve = () => {
    setApproval('pending');
    withSigner(async (signer, owner) => {
      try {
        const result = await evmApprove(sdk, signer, vault, owner, amount);
        setApproval('done');
        return result.kind === 'sent' ? result.hash : null;
      } catch (error) {
        setApproval('unknown');
        throw error;
      }
    });
  };

  const deposit = () =>
    withSigner((signer, owner) =>
      evmDeposit(sdk, signer, vault, owner, amount),
    ).then((hash) => {
      if (hash) {
        setAmount('');
        setApproval('unknown');
      }
    });

  const requestRedeem = () =>
    withSigner((signer, owner) =>
      evmRequestRedeem(sdk, signer, vault, owner, amount),
    ).then((hash) => hash && setAmount(''));

  const claim = (redemption: EvmRedemptions['available'][number]) =>
    withSigner((signer, owner) =>
      evmClaim(sdk, signer, vault, owner, redemption),
    );

  if (!wallet.connected) return <p>Connect an EVM wallet to transact.</p>;
  if (!chain) {
    return (
      <p role="alert">
        This starter signs on Ethereum mainnet only. This vault is on chain{' '}
        {vault.chainId}.
      </p>
    );
  }

  return (
    <div className="tx-form">
      {wrongNetwork ? (
        <>
          <p role="alert">
            Your wallet is on chain {wallet.chainId ?? 'unknown'}. This vault is
            on {chain.name}.
          </p>
          <button type="button" onClick={switchNetwork}>
            Switch to {chain.name}
          </button>
          {switchError ? <p role="alert">{switchError}</p> : null}
        </>
      ) : null}
      <div className="tx-tabs">
        {(['deposit', 'withdraw', 'claim'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              setAmount('');
              setApproval('unknown');
              reset();
            }}
          >
            {m === 'deposit'
              ? `Deposit ${asset.symbol}`
              : m === 'withdraw'
                ? 'Request withdrawal'
                : 'Claim'}
          </button>
        ))}
      </div>
      {mode !== 'claim' ? (
        <label className="tx-field">
          <span>
            Amount{' '}
            <small>
              Balance: {max ?? 'unknown'}
              {max ? (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setAmount(max);
                    setApproval('unknown');
                    reset();
                  }}
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
              setApproval('unknown');
              reset();
            }}
          />
        </label>
      ) : null}
      {malformed ? (
        <small role="alert">
          Enter a plain number with at most {decimals} decimals.
        </small>
      ) : null}
      {overMax ? (
        <small role="alert">That is more than your balance.</small>
      ) : null}
      {mode === 'deposit' ? (
        <div className="tx-steps">
          <button
            type="button"
            disabled={!canAct || approval === 'done'}
            onClick={approve}
          >
            {approval === 'done' ? '1. Approved' : `1. Approve ${asset.symbol}`}
          </button>
          <button
            type="button"
            disabled={!canAct || approval !== 'done'}
            onClick={deposit}
          >
            2. Deposit
          </button>
        </div>
      ) : null}
      {mode === 'withdraw' ? (
        <button type="button" disabled={!canAct} onClick={requestRedeem}>
          Request redeem of {amount || '0'} {vault.receipt.symbol}
        </button>
      ) : null}
      {mode === 'claim' ? (
        <ul className="redemptions">
          {redemptions.status === 'loading' ? (
            <li>Loading redemptions…</li>
          ) : null}
          {redemptions.status === 'error' ? (
            <li role="alert">
              Could not load redemptions.{' '}
              <button
                type="button"
                className="link-button"
                onClick={retryRedemptions}
              >
                Retry
              </button>
            </li>
          ) : null}
          {redemptions.status === 'ready' &&
          redemptions.data.available.length === 0 &&
          redemptions.data.pending.length === 0 ? (
            <li>No redemption requests for this wallet.</li>
          ) : null}
          {redemptions.status === 'ready'
            ? redemptions.data.available.map((r) => (
                <li key={r.id}>
                  {r.amount.normalized} {claimUnit}, matured{' '}
                  {r.date.toLocaleDateString()}{' '}
                  <button
                    type="button"
                    aria-label={`Claim ${r.amount.normalized} ${claimUnit}`}
                    disabled={!ready || busy}
                    onClick={() => claim(r)}
                  >
                    Claim
                  </button>
                </li>
              ))
            : null}
          {redemptions.status === 'ready'
            ? redemptions.data.pending.map((r) => (
                <li key={r.id}>
                  {r.amount.normalized} {claimUnit}, pending until{' '}
                  {r.date.toLocaleDateString()}
                </li>
              ))
            : null}
        </ul>
      ) : null}
      {!ready && !wrongNetwork ? (
        <small>Reconnect your wallet to sign.</small>
      ) : null}
      <TxStatus
        phase={phase}
        explorerLink={(hash) => evmExplorerLink(vault.chainId, hash)}
      />
    </div>
  );
}
