export type StarterEnv = Partial<
  Record<'VITE_RPC_ETHEREUM' | 'VITE_RPC_SOLANA' | 'VERCEL_ENV' | 'CI', string>
> & { DEV?: boolean };

export const DEFAULT_RPC = {
  ethereum: 'https://ethereum-rpc.publicnode.com',
  solana: 'https://solana-rpc.publicnode.com',
} as const;

export const DEV_API_PROXY_PATH = '/api/august';
