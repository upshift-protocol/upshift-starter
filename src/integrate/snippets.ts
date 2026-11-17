import type { ChainFamily } from '../integration/vaults';
import evmWidget from '../snippets/evm/UpshiftVault.tsx?raw';
import { VAULT as EVM_VAULT } from '../snippets/evm/upshift-vault';
import evmVault from '../snippets/evm/upshift-vault.ts?raw';
import solanaWidget from '../snippets/solana/UpshiftVault.tsx?raw';
import { VAULT as SOLANA_VAULT } from '../snippets/solana/upshift-vault';
import solanaVault from '../snippets/solana/upshift-vault.ts?raw';
import stellarWidget from '../snippets/stellar/UpshiftVault.tsx?raw';
import { VAULT as STELLAR_VAULT } from '../snippets/stellar/upshift-vault';
import stellarVault from '../snippets/stellar/upshift-vault.ts?raw';

export interface SnippetFile {
  name: string;
  source: string;
}

export const SNIPPETS: Record<ChainFamily, SnippetFile[]> = {
  evm: [
    { name: 'upshift-vault.ts', source: evmVault },
    { name: 'UpshiftVault.tsx', source: evmWidget },
  ],
  solana: [
    { name: 'upshift-vault.ts', source: solanaVault },
    { name: 'UpshiftVault.tsx', source: solanaWidget },
  ],
  stellar: [
    { name: 'upshift-vault.ts', source: stellarVault },
    { name: 'UpshiftVault.tsx', source: stellarWidget },
  ],
};

export const FEATURED: Record<
  ChainFamily,
  { chainId: number; address: string }
> = { evm: EVM_VAULT, solana: SOLANA_VAULT, stellar: STELLAR_VAULT };

export const PACKAGES: Record<ChainFamily, string[]> = {
  evm: ['@upshiftfinance/sdk', 'wagmi', 'viem', '@tanstack/react-query'],
  solana: [
    '@upshiftfinance/sdk',
    '@solana/web3.js',
    '@solana/wallet-adapter-react',
  ],
  stellar: ['@upshiftfinance/sdk', '@stellar/freighter-api'],
};

export const MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'] as const;
export type Manager = (typeof MANAGERS)[number];

export function installCommand(manager: Manager, family: ChainFamily) {
  const verb = manager === 'npm' ? 'install' : 'add';
  return `${manager} ${verb} ${PACKAGES[family].join(' ')}`;
}
