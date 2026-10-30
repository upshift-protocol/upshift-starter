import { useState } from 'react';
import type { WalletSummary } from '../integration/wallets/use-wallets';

const LABELS = { evm: 'EVM', solana: 'Solana', stellar: 'Stellar' } as const;

function short(address: string) {
  return address.length > 14
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
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
  return (
    <div className="wallet">
      <span className="wallet-label">{LABELS[wallet.family]}</span>
      <button type="button" onClick={toggle} disabled={busy}>
        {wallet.connected && wallet.address
          ? `Disconnect ${short(wallet.address)}`
          : 'Connect'}
      </button>
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
