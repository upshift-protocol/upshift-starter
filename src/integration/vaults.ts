import {
  type IGetVaultsOptions,
  type IVault,
  SPECIAL_CHAINS,
} from '@augustdigital/sdk';

export type ChainFamily = 'evm' | 'solana' | 'stellar';
export type VaultsByFamily = Record<ChainFamily, IVault[]>;

export const FAMILY_LABELS: Record<ChainFamily, string> = {
  evm: 'EVM',
  solana: 'Solana',
  stellar: 'Stellar',
};

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

export function depositAssetOf(vault: Pick<IVault, 'depositAssets'>) {
  const asset = vault.depositAssets[0];
  if (!asset) throw new Error('Vault has no deposit asset.');
  return asset;
}

const LIST_OPTIONS = {
  loans: false,
  allocations: false,
  loadSubaccounts: false,
  loadSnapshots: false,
} satisfies IGetVaultsOptions;

export async function listVaultsByFamily(sdk: {
  getVaults: (options: IGetVaultsOptions) => Promise<IVault[]>;
}): Promise<VaultsByFamily> {
  return groupVaultsByFamily(await sdk.getVaults(LIST_OPTIONS));
}
