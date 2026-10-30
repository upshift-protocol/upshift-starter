import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { http, createConfig } from 'wagmi';
import { injected } from 'wagmi/connectors';
import {
  WagmiProvider,
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useWalletClient,
} from 'wagmi';
import { DEFAULT_RPC } from '../../config';
import { EVM_CHAINS } from '../evm-chains';

function createEvmConfig(rpcUrl: string = DEFAULT_RPC.ethereum) {
  return createConfig({
    chains: EVM_CHAINS,
    connectors: [injected()],
    transports: { [EVM_CHAINS[0].id]: http(rpcUrl) },
  });
}

const queryClient = new QueryClient();

export function EvmWalletProvider({
  children,
  rpcUrl,
}: {
  children: ReactNode;
  rpcUrl?: string;
}) {
  const [config] = useState(() => createEvmConfig(rpcUrl));
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

export function useEvmWallet() {
  const { address, chainId, isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const connect = async () => {
    const connector = connectors[0];
    if (!connector) throw new Error('No injected EVM wallet is installed.');
    await connectAsync({ connector });
  };
  return {
    address: address ?? null,
    connected: isConnected,
    chainId: chainId ?? null,
    walletClient: walletClient ?? null,
    switchChain: (target: number) => switchChainAsync({ chainId: target }),
    connect,
    disconnect: () => disconnectAsync(),
  };
}
