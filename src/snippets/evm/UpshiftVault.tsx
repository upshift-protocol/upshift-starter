import type { IVault } from '@upshiftfinance/sdk';
import { type SyntheticEvent, useEffect, useState } from 'react';
import {
  useAccount,
  useConnect,
  useConnectors,
  useDisconnect,
  useSwitchChain,
  useWalletClient,
} from 'wagmi';
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
  requestWithdraw,
} from './upshift-vault';

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export function UpshiftVault({
  sdk: given,
  vault = VAULT,
}: {
  sdk?: VaultSdk;
  vault?: Vault;
}) {
  const [sdk] = useState(() => given ?? createVaultSdk());
  const { address, chainId, isConnected } = useAccount();
  const connectors = useConnectors();
  const { connectAsync } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { data: signer } = useWalletClient();
  const { address: target, chainId: targetChain } = vault;
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
    readVault(sdk, { address: target, chainId: targetChain }).then(
      (next) => live && setLoaded({ target, info: next }),
      (error: unknown) => live && setStatus(errorText(error)),
    );
    return () => {
      live = false;
    };
  }, [sdk, target, targetChain]);

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

  const attempt = async (work: () => unknown) => {
    try {
      await work();
    } catch (error) {
      setStatus(errorText(error));
    }
  };

  const connect = () =>
    attempt(() => {
      const connector = connectors[0];
      if (!connector) throw new Error('Install a browser wallet to connect.');
      return connectAsync({ connector });
    });

  const send =
    (
      label: string,
      write: (signer: Signer, owner: string) => Promise<string>,
    ) =>
    async (event: SyntheticEvent) => {
      event.preventDefault();
      if (!signer || !address || busy) return;
      setBusy(true);
      setStatus(`${label}: confirm in your wallet`);
      try {
        setStatus(`${label} confirmed: ${await write(signer, address)}`);
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
  const held =
    position && position.key === `${info?.address}:${address}`
      ? position.value
      : null;
  const wrongChain = isConnected && chainId !== vault.chainId;
  const ready = Boolean(signer && address && info && !wrongChain && !busy);

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
      {isConnected ? (
        <p className="upshift-vault-wallet">
          <code>{address}</code>
          <button type="button" onClick={() => disconnect()}>
            Disconnect
          </button>
        </p>
      ) : (
        <button type="button" onClick={connect}>
          Connect wallet
        </button>
      )}
      {wrongChain ? (
        <button
          type="button"
          onClick={() =>
            attempt(() => switchChainAsync({ chainId: vault.chainId }))
          }
        >
          Switch network
        </button>
      ) : null}
      <form
        className="upshift-vault-form"
        onSubmit={send('Deposit', (signer, owner) =>
          deposit(sdk, signer, owner, amount, vault),
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
        onSubmit={send('Withdrawal request', (signer, owner) =>
          requestWithdraw(sdk, signer, owner, shares, vault),
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
        <button type="submit" disabled={!ready || !shares}>
          Request withdrawal
        </button>
      </form>
      <p role="status">{status}</p>
    </section>
  );
}
