import type { IAddress, IVault } from '@upshiftfinance/sdk';
import UpshiftSDK from '@upshiftfinance/sdk';
import { formatUnits } from 'viem';

export interface Vault {
  chainId: number;
  address: string;
}

export const VAULT: Vault = {
  chainId: 1,
  address: '0x80E1048eDE66ec4c364b4F22C8768fc657FF6A42',
};

const RPC_URL = 'https://ethereum-rpc.publicnode.com';

export type VaultSdk = InstanceType<typeof UpshiftSDK>;
export type Signer = Parameters<VaultSdk['evm']['setSigner']>[0];

export interface Position {
  deposit: string;
  shares: string;
}

export function createVaultSdk(): VaultSdk {
  return new UpshiftSDK({
    appName: 'my-app',
    providers: { [VAULT.chainId]: RPC_URL },
  });
}

export function readVault(sdk: VaultSdk, vault = VAULT): Promise<IVault> {
  return sdk.getVault({
    vault: vault.address as IAddress,
    chainId: vault.chainId,
  });
}

export async function readPosition(
  sdk: VaultSdk,
  info: IVault,
  wallet: string,
): Promise<Position> {
  const asset = info.depositAssets[0];
  if (!asset) throw new Error('This vault has no deposit token.');
  const owner = wallet as IAddress;
  const [deposit, shares] = await Promise.all([
    sdk.evm.balanceOf({ asset: asset.address as IAddress, owner }),
    sdk.evm.balanceOf({ asset: info.receipt.address as IAddress, owner }),
  ]);
  return {
    deposit: formatUnits(deposit, asset.decimals),
    shares: formatUnits(shares, info.receipt.decimals),
  };
}

function writeOptions(vault: Vault, wallet: string, amount: string) {
  return {
    target: vault.address as IAddress,
    wallet: wallet as IAddress,
    chainId: vault.chainId,
    amount,
    wait: true,
  };
}

export async function deposit(
  sdk: VaultSdk,
  signer: Signer,
  wallet: string,
  amount: string,
  vault = VAULT,
): Promise<string> {
  sdk.evm.setSigner(signer);
  await sdk.evm.approve(writeOptions(vault, wallet, amount));
  return sdk.evm.vaultDeposit(writeOptions(vault, wallet, amount));
}

export async function requestWithdraw(
  sdk: VaultSdk,
  signer: Signer,
  wallet: string,
  shares: string,
  vault = VAULT,
): Promise<string> {
  sdk.evm.setSigner(signer);
  return sdk.evm.vaultRequestRedeem(writeOptions(vault, wallet, shares));
}
