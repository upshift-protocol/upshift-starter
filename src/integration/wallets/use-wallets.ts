import type { ChainFamily } from '../vaults';
import { useEvmWallet } from './evm';
import { useSolanaWallet } from './solana';
import { useStellarWallet } from './stellar';

export interface WalletSummary {
  family: ChainFamily;
  address: string | null;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void | Promise<void>;
}

export function useWallets(): Record<ChainFamily, WalletSummary> {
  const evm = useEvmWallet();
  const solana = useSolanaWallet();
  const stellar = useStellarWallet();
  return {
    evm: { family: 'evm', ...pick(evm) },
    solana: { family: 'solana', ...pick(solana) },
    stellar: { family: 'stellar', ...pick(stellar) },
  };
}

function pick(wallet: {
  address: string | null;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void | Promise<void>;
}) {
  return {
    address: wallet.address,
    connected: wallet.connected,
    connect: wallet.connect,
    disconnect: wallet.disconnect,
  };
}
