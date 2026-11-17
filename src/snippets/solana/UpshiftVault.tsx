import type { IVault } from '@upshiftfinance/sdk';
import { useWallet } from '@solana/wallet-adapter-react';
import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import {
  type Position,
  type Signer,
  VAULT,
  type Vault,
  type VaultSdk,
  createVaultSdk,
  deposit,
  readPosition,
  readVault,
  withdraw,
} from './upshift-vault';

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const USABLE: string[] = ['Installed', 'Loadable'];

export function UpshiftVault({
  sdk: given,
  vault = VAULT,
}: {
  sdk?: VaultSdk;
  vault?: Vault;
}) {
  const [sdk] = useState(() => given ?? createVaultSdk());
  const {
    publicKey,
    signTransaction,
    wallet,
    wallets,
    select,
    connect,
    disconnect,
  } = useWallet();
  const address = publicKey?.toBase58() ?? null;
  const { address: target, chainId, programId } = vault;
  const [loaded, setLoaded] = useState<{
    target: string;
    info: IVault;
  } | null>(null);
  const [position, setPosition] = useState<{
    key: string;
    value: Position | null;
    error: string;
  } | null>(null);
  const [amount, setAmount] = useState('');
  const [shares, setShares] = useState('');
  const [status, setStatus] = useState('');
  const [writes, setWrites] = useState(0);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const info = loaded?.target === target ? loaded.info : null;
  const key = `${info?.address}:${address}`;

  useEffect(() => {
    let live = true;
    readVault(sdk, { address: target, chainId, programId }).then(
      (next) => live && setLoaded({ target, info: next }),
      (error: unknown) => live && setStatus(errorText(error)),
    );
    return () => {
      live = false;
    };
  }, [sdk, target, chainId, programId]);

  useEffect(() => {
    if (!info || !address) return;
    let live = true;
    const read = `${info.address}:${address}`;
    readPosition(sdk, info, address).then(
      (value) => live && setPosition({ key: read, value, error: '' }),
      (error: unknown) =>
        live &&
        setPosition({ key: read, value: null, error: errorText(error) }),
    );
    return () => {
      live = false;
    };
  }, [sdk, info, address, writes]);

  useEffect(() => {
    if (!pending.current || !wallet) return;
    pending.current = false;
    connect().catch((error: unknown) => setStatus(errorText(error)));
  }, [wallet, connect]);

  const attempt = async (work: () => unknown) => {
    try {
      await work();
    } catch (error) {
      setStatus(errorText(error));
    }
  };

  const connectWallet = () =>
    attempt(async () => {
      if (wallet && USABLE.includes(wallet.readyState)) {
        await connect();
        return;
      }
      const found = wallets.find((w) => USABLE.includes(w.readyState));
      if (!found) throw new Error('Install a Solana wallet to connect.');
      pending.current = true;
      select(found.adapter.name);
    });

  const send =
    (label: string, write: (signer: Signer) => Promise<string>) =>
    async (event: SyntheticEvent) => {
      event.preventDefault();
      if (!publicKey || !signTransaction || busy) return;
      setBusy(true);
      setStatus(`${label}: confirm in your wallet`);
      try {
        setStatus(await write({ publicKey, signTransaction }));
        setWrites((count) => count + 1);
      } catch (error) {
        setStatus(`${label} failed: ${errorText(error)}`);
      } finally {
        setBusy(false);
      }
    };

  const asset = info?.depositAssets[0];
  const share = info?.receipt.symbol ?? 'shares';
  const apy = info?.apy?.apy;
  const mine = position && position.key === key ? position : null;
  const held = mine?.value ?? null;
  const ready = Boolean(publicKey && signTransaction && info && !busy);

  return (
    <section className="upshift-vault">
      <h3>{info?.name ?? 'Loading vault…'}</h3>
      <dl className="upshift-vault-stats">
        <div>
          <dt>APY</dt>
          <dd>{typeof apy === 'number' ? `${apy.toFixed(2)}%` : '–'}</dd>
        </div>
        <div>
          <dt>TVL</dt>
          <dd>
            {info
              ? `${number.format(Number(info.totalAssets.normalized))} ${asset?.symbol ?? ''}`
              : '–'}
          </dd>
        </div>
        {held ? (
          <>
            <div>
              <dt>Balance</dt>
              <dd>{`${held.deposit} ${asset?.symbol ?? ''}`}</dd>
            </div>
            <div>
              <dt>Shares</dt>
              <dd>{`${held.shares} ${share}`}</dd>
            </div>
          </>
        ) : null}
      </dl>
      {mine?.error ? <p>Balance unavailable: {mine.error}</p> : null}
      {address ? (
        <p className="upshift-vault-wallet">
          <code>{address}</code>
          <button type="button" onClick={() => attempt(disconnect)}>
            Disconnect
          </button>
        </p>
      ) : (
        <button type="button" onClick={connectWallet}>
          Connect wallet
        </button>
      )}
      <form
        className="upshift-vault-form"
        onSubmit={send(
          'Deposit',
          async (signer) =>
            `Deposit confirmed: ${await deposit(sdk, signer, amount, vault)}`,
        )}
      >
        <label>
          Deposit amount ({asset?.symbol ?? 'tokens'})
          <input
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <button type="submit" disabled={!ready || !amount}>
          Deposit
        </button>
      </form>
      <form
        className="upshift-vault-form"
        onSubmit={send('Withdrawal', async (signer) => {
          const done = await withdraw(
            sdk,
            signer,
            shares,
            held?.shareDecimals ?? 0,
            vault,
          );
          return done.queued
            ? `Withdrawal requested: ${done.signature}. Claim it once the cooldown ends.`
            : `Withdrawal confirmed: ${done.signature}`;
        })}
      >
        <label>
          Shares to withdraw ({share})
          <input
            inputMode="decimal"
            placeholder="0.0"
            value={shares}
            onChange={(event) => setShares(event.target.value)}
          />
        </label>
        <button type="submit" disabled={!ready || !held || !shares}>
          Withdraw
        </button>
      </form>
      <p role="status">{status}</p>
    </section>
  );
}
