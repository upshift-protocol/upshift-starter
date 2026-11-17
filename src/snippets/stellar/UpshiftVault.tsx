import type { IVault } from '@upshiftfinance/sdk';
import {
  getAddress,
  isAllowed,
  isConnected,
  requestAccess,
  signTransaction,
} from '@stellar/freighter-api';
import { type SyntheticEvent, useEffect, useState } from 'react';
import {
  NETWORK_PASSPHRASE,
  type Position,
  type Sign,
  VAULT,
  type Vault,
  type VaultSdk,
  createVaultSdk,
  deposit,
  readPosition,
  readVault,
  unconfirmedHash,
  withdraw,
} from './upshift-vault';

const STORAGE_KEY = 'upshift-vault-stellar-address';
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

const signerFor =
  (address: string): Sign =>
  async (xdr) => {
    const signed = await signTransaction(xdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
      address,
    });
    if (signed.error || !signed.signedTxXdr) {
      throw new Error(signed.error?.message ?? 'Freighter did not sign.');
    }
    return signed.signedTxXdr;
  };

async function restoreAddress(): Promise<string | null> {
  if (!localStorage.getItem(STORAGE_KEY)) return null;
  if (!(await isConnected()).isConnected) return null;
  if (!(await isAllowed()).isAllowed) return null;
  return (await getAddress()).address || null;
}

export function UpshiftVault({
  sdk: given,
  vault = VAULT,
}: {
  sdk?: VaultSdk;
  vault?: Vault;
}) {
  const [sdk] = useState(() => given ?? createVaultSdk());
  const [address, setAddress] = useState<string | null>(null);
  const { address: target, chainId } = vault;
  const [loaded, setLoaded] = useState<{
    target: string;
    info: IVault;
  } | null>(null);
  const [position, setPosition] = useState<{
    key: string;
    value: Position;
  } | null>(null);
  const [amount, setAmount] = useState('');
  const [shares, setShares] = useState('');
  const [status, setStatus] = useState('');
  const [writes, setWrites] = useState(0);
  const [busy, setBusy] = useState(false);
  const info = loaded?.target === target ? loaded.info : null;

  useEffect(() => {
    let live = true;
    restoreAddress()
      .then((restored) => live && restored && setAddress(restored))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    readVault(sdk, { address: target, chainId }).then(
      (next) => live && setLoaded({ target, info: next }),
      (error: unknown) => live && setStatus(errorText(error)),
    );
    return () => {
      live = false;
    };
  }, [sdk, target, chainId]);

  useEffect(() => {
    if (!info || !address) return;
    let live = true;
    const read = `${info.address}:${address}`;
    readPosition(sdk, info, address).then(
      (value) => live && setPosition({ key: read, value }),
      () => live && setPosition(null),
    );
    return () => {
      live = false;
    };
  }, [sdk, info, address, writes]);

  const connect = async () => {
    try {
      if (!(await isConnected()).isConnected) {
        throw new Error('Install the Freighter extension to connect.');
      }
      const access = await requestAccess();
      if (access.error || !access.address) {
        throw new Error(access.error?.message ?? 'Freighter did not connect.');
      }
      localStorage.setItem(STORAGE_KEY, access.address);
      setAddress(access.address);
      setStatus('');
    } catch (error) {
      setStatus(errorText(error));
    }
  };

  const disconnect = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAddress(null);
  };

  const send =
    (
      label: string,
      write: (sign: Sign, owner: string, loaded: IVault) => Promise<string>,
    ) =>
    async (event: SyntheticEvent) => {
      event.preventDefault();
      if (!address || !info || busy) return;
      setBusy(true);
      setStatus(`${label}: confirm in Freighter`);
      try {
        setStatus(
          `${label} confirmed: ${await write(signerFor(address), address, info)}`,
        );
        setWrites((count) => count + 1);
      } catch (error) {
        const hash = unconfirmedHash(error);
        setStatus(
          hash
            ? `${label} sent but not confirmed yet: ${hash}. Check it on stellar.expert before you try again.`
            : `${label} failed: ${errorText(error)}`,
        );
      } finally {
        setBusy(false);
      }
    };

  const asset = info?.depositAssets[0];
  const share = info?.receipt.symbol ?? 'shares';
  const apy = info?.apy?.apy;
  const held =
    position && position.key === `${info?.address}:${address}`
      ? position.value
      : null;
  const ready = Boolean(address && info && !busy);
  const shown = (value: string | null, unit: string) =>
    value === null ? 'unavailable' : `${value} ${unit}`;

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
              <dd>{shown(held.deposit, asset?.symbol ?? '')}</dd>
            </div>
            <div>
              <dt>Shares</dt>
              <dd>{shown(held.shares, share)}</dd>
            </div>
          </>
        ) : null}
      </dl>
      {address ? (
        <p className="upshift-vault-wallet">
          <code>{address}</code>
          <button type="button" onClick={disconnect}>
            Disconnect
          </button>
        </p>
      ) : (
        <button type="button" onClick={connect}>
          Connect Freighter
        </button>
      )}
      <form
        className="upshift-vault-form"
        onSubmit={send('Deposit', (sign, owner, loaded) =>
          deposit(sdk, sign, owner, amount, loaded),
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
        onSubmit={send('Withdrawal', (sign, owner) =>
          withdraw(sdk, sign, owner, shares, held?.shareDecimals ?? 0, vault),
        )}
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
        <button
          type="submit"
          disabled={!ready || held?.shareDecimals == null || !shares}
        >
          Withdraw
        </button>
      </form>
      <p role="status">{status}</p>
    </section>
  );
}
