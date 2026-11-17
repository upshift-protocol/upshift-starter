import { useState } from 'react';
import { FAMILY_LABELS } from '../integration/vaults';
import type { WalletSummary } from '../integration/wallets';

function short(address: string) {
  const head = address.startsWith('0x') ? 6 : 4;
  return address.length > head + 5
    ? `${address.slice(0, head)}…${address.slice(-4)}`
    : address;
}

function WalletButton({ wallet }: { wallet: WalletSummary }) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setError(undefined);
    setBusy(true);
    try {
      await (wallet.connected ? wallet.disconnect() : wallet.connect());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };
  const address =
    wallet.connected && wallet.address ? short(wallet.address) : null;
  return (
    <div className={wallet.connected ? 'wallet wallet-connected' : 'wallet'}>
      <span className="wallet-chip">
        <span className="wallet-label">{FAMILY_LABELS[wallet.family]}</span>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-label={address ? `Disconnect ${address}` : undefined}
          data-tooltip={address ? 'Disconnect' : undefined}
        >
          {address ?? 'Connect'}
        </button>
      </span>
      {error ? (
        <span role="alert" className="wallet-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function WalletBar({
  wallets,
}: {
  wallets: Record<'evm' | 'solana' | 'stellar', WalletSummary>;
}) {
  return (
    <div className="wallet-bar">
      <WalletButton wallet={wallets.evm} />
      <WalletButton wallet={wallets.solana} />
      <WalletButton wallet={wallets.stellar} />
    </div>
  );
}
