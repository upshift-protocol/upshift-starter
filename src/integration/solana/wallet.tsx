import { WalletReadyState } from '@solana/wallet-adapter-base';
import { CoinbaseWalletAdapter } from '@solana/wallet-adapter-coinbase';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import {
  ConnectionProvider,
  WalletNotSelectedError,
  WalletProvider,
  useWallet,
} from '@solana/wallet-adapter-react';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { type ReactNode, useState } from 'react';
import { DEFAULT_RPC } from '../config';

export function SolanaWalletProvider({
  children,
  rpcUrl = DEFAULT_RPC.solana,
}: {
  children: ReactNode;
  rpcUrl?: string;
}) {
  const [wallets] = useState(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new CoinbaseWalletAdapter(),
  ]);
  return (
    <ConnectionProvider endpoint={rpcUrl}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}

export function useSolanaWallet() {
  const {
    publicKey,
    connected,
    signTransaction,
    wallets,
    select,
    connect,
    disconnect,
  } = useWallet();
  const installed = wallets.filter(
    (w) =>
      w.readyState === WalletReadyState.Installed ||
      w.readyState === WalletReadyState.Loadable,
  );
  return {
    address: publicKey ? publicKey.toBase58() : null,
    publicKey,
    connected,
    signTransaction,
    wallets: installed.map((w) => w.adapter.name),
    connect: async (name?: string) => {
      const target = name ?? installed[0]?.adapter.name;
      if (!target) throw new Error('No Solana wallet is installed.');
      select(target as Parameters<typeof select>[0]);
      try {
        await connect();
      } catch (error) {
        if (!(error instanceof WalletNotSelectedError)) throw error;
      }
    },
    disconnect,
  };
}
