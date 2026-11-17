import {
  type IGetVaultsOptions,
  type IVault,
  SPECIAL_CHAINS,
} from '@upshiftfinance/sdk';
import { EVM_CHAINS } from './evm/chains';

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

const LISTED_CHAIN_IDS = new Set<number>([
  ...EVM_CHAINS.map((chain) => chain.id),
  SPECIAL_CHAINS.solana.chainId,
  SPECIAL_CHAINS.stellar.chainId,
]);

function isListed(vault: IVault): boolean {
  return (
    vault.status === 'active' &&
    vault.isVisible !== false &&
    LISTED_CHAIN_IDS.has(vault.chainId)
  );
}

export async function listVaultsByFamily(sdk: {
  getVaults: (options: IGetVaultsOptions) => Promise<IVault[]>;
}): Promise<VaultsByFamily> {
  const vaults = await sdk.getVaults(LIST_OPTIONS);
  return groupVaultsByFamily(vaults.filter(isListed));
}
