import type { ReactNode } from 'react';
import { EvmWalletProvider } from './evm';
import { SolanaWalletProvider } from './solana';
import { StellarWalletProvider } from './stellar';

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
