import { SPECIAL_CHAINS } from '@upshiftfinance/sdk';
import { CHAIN_SLUGS, type ChainSlug, type Route } from '../router';

const CHAIN_IDS: Record<ChainSlug, number> = {
  ethereum: 1,
  solana: SPECIAL_CHAINS.solana.chainId,
  stellar: SPECIAL_CHAINS.stellar.chainId,
};

export const chainIdOf = (slug: ChainSlug) => CHAIN_IDS[slug];

const slugOf = (chainId: number) =>
  CHAIN_SLUGS.find((slug) => CHAIN_IDS[slug] === chainId);

type VaultRef = { chainId: number; address: string };

export function vaultTarget(route: Route): VaultRef | null {
  if (route.name !== 'vault') return null;
  const slug = CHAIN_SLUGS.find((s) => s === route.chain);
  return {
    chainId: slug ? CHAIN_IDS[slug] : Number(route.chain),
    address: route.address,
  };
}

export function vaultPath(vault: VaultRef): `/${string}` {
  return `/vaults/${slugOf(vault.chainId) ?? vault.chainId}/${vault.address}`;
}

export function integratePath(vault: VaultRef): `/${string}` | null {
  const slug = slugOf(vault.chainId);
  if (!slug) return null;
  return `/vaults/${slug}/${vault.address}/integrate`;
}
