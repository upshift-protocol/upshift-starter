import type AugustSDK from '@augustdigital/sdk';
import {
  type IAddress,
  type IVault,
  type IVaultAvailableRedemption,
  toNormalizedBn,
} from '@augustdigital/sdk';
import { depositAssetOf } from '../vaults';

export type EvmSdk = Pick<AugustSDK, 'evm' | 'getVaultAvailableRedemptions'>;

export interface EvmBalances {
  deposit: string | null;
  shares: string | null;
}

export interface EvmRedemptions {
  available: IVaultAvailableRedemption[];
  pending: IVaultAvailableRedemption[];
}

export type EvmSigner = Parameters<AugustSDK['evm']['setSigner']>[0];

type EvmVault = Pick<
  IVault,
  'address' | 'chainId' | 'depositAssets' | 'receipt' | 'version'
>;

function writeTarget(vault: EvmVault, wallet: string) {
  return {
    target: vault.address as IAddress,
    wallet: wallet as IAddress,
    chainId: vault.chainId,
    wait: true as const,
  };
}

export async function readEvmBalances(
  sdk: EvmSdk,
  wallet: string,
  vault: EvmVault,
): Promise<EvmBalances> {
  const owner = wallet as IAddress;
  const asset = depositAssetOf(vault);
  const read = (token: string, decimals: number) =>
    sdk.evm
      .balanceOf({ asset: token as IAddress, owner })
      .then((raw) => toNormalizedBn(raw, decimals).normalized)
      .catch(() => null);
  const [deposit, shares] = await Promise.all([
    read(asset.address, asset.decimals),
    read(vault.receipt.address, vault.receipt.decimals),
  ]);
  return { deposit, shares };
}

export async function evmApprove(
  sdk: EvmSdk,
  signer: EvmSigner,
  vault: EvmVault,
  wallet: string,
  amount: string,
) {
  sdk.evm.setSigner(signer);
  return sdk.evm.approve({ ...writeTarget(vault, wallet), amount });
}

export async function evmDeposit(
  sdk: EvmSdk,
  signer: EvmSigner,
  vault: EvmVault,
  wallet: string,
  amount: string,
): Promise<string> {
  sdk.evm.setSigner(signer);
  return sdk.evm.vaultDeposit({ ...writeTarget(vault, wallet), amount });
}

export async function evmRequestRedeem(
  sdk: EvmSdk,
  signer: EvmSigner,
  vault: EvmVault,
  wallet: string,
  shares: string,
): Promise<string> {
  sdk.evm.setSigner(signer);
  return sdk.evm.vaultRequestRedeem({
    ...writeTarget(vault, wallet),
    amount: shares,
  });
}

export async function readEvmRedemptions(
  sdk: EvmSdk,
  vault: EvmVault,
  wallet: string,
): Promise<EvmRedemptions> {
  const { availableRedemptions, pendingRedemptions } =
    await sdk.getVaultAvailableRedemptions({
      vault: vault.address as IAddress,
      chainId: vault.chainId,
      wallet: wallet as IAddress,
    });
  return { available: availableRedemptions, pending: pendingRedemptions };
}

export async function evmClaim(
  sdk: EvmSdk,
  signer: EvmSigner,
  vault: EvmVault,
  wallet: string,
  redemption: Pick<IVaultAvailableRedemption, 'year' | 'month' | 'day'>,
): Promise<string> {
  sdk.evm.setSigner(signer);
  const epoch = {
    year: redemption.year.raw,
    month: redemption.month.raw,
    day: redemption.day.raw,
  };
  const target = writeTarget(vault, wallet);
  return vault.version === 'evm-2'
    ? sdk.evm.claimWithdrawal({ ...target, ...epoch })
    : sdk.evm.vaultRedeem({ ...target, ...epoch, receiverIndex: '0' });
}
