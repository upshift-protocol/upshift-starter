import { type IVault, SPECIAL_CHAINS } from '@augustdigital/sdk';

export type ChainFamily = 'evm' | 'solana' | 'stellar';
export type VaultsByFamily = Record<ChainFamily, IVault[]>;

export function familyOf(chainId: number): ChainFamily {
  if (chainId === SPECIAL_CHAINS.solana.chainId) return 'solana';
  if (chainId === SPECIAL_CHAINS.stellar.chainId) return 'stellar';
  return 'evm';
}

export function groupVaultsByFamily(vaults: IVault[]): VaultsByFamily {
  const grouped: VaultsByFamily = { evm: [], solana: [], stellar: [] };
  for (const vault of vaults) grouped[familyOf(vault.chainId)].push(vault);
  return grouped;
}

export async function listVaultsByFamily(sdk: {
  getVaults: () => Promise<IVault[]>;
}): Promise<VaultsByFamily> {
  return groupVaultsByFamily(await sdk.getVaults());
}
