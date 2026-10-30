import type { ReactNode } from 'react';
import { EvmWalletProvider, useEvmWallet } from './evm/wallet';
import { SolanaWalletProvider, useSolanaWallet } from './solana/wallet';
import { StellarWalletProvider, useStellarWallet } from './stellar/wallet';
import type { ChainFamily } from './vaults';

export interface WalletSummary {
  family: ChainFamily;
  address: string | null;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void | Promise<void>;
}

export function WalletProviders({
  children,
  rpc,
}: {
  children: ReactNode;
  rpc?: { ethereum?: string; solana?: string };
}) {
  return (
    <EvmWalletProvider rpcUrl={rpc?.ethereum}>
      <SolanaWalletProvider rpcUrl={rpc?.solana}>
        <StellarWalletProvider>{children}</StellarWalletProvider>
      </SolanaWalletProvider>
    </EvmWalletProvider>
  );
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
