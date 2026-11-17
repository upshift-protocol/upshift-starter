import type { IAddress, IVault } from '@upshiftfinance/sdk';
import UpshiftSDK from '@upshiftfinance/sdk';

export interface Vault {
  chainId: number;
  address: string;
}

export const VAULT: Vault = {
  chainId: -3,
  address: 'CCL3WITWFFXIHV2I52ECV5DPIEOFSTU3PBPR53ILPLF2IP5KHECXRUTY',
};

const RPC_URL = 'https://soroban-rpc.mainnet.stellar.gateway.fm';

export const NETWORK_PASSPHRASE =
  'Public Global Stellar Network ; September 2015';

export type VaultSdk = InstanceType<typeof UpshiftSDK>;
export type Sign = (xdr: string) => Promise<string>;

export interface Position {
  deposit: string | null;
  shares: string | null;
  shareDecimals: number | null;
}

export function createVaultSdk(): VaultSdk {
  return new UpshiftSDK({
    appName: 'my-app',
    stellar: { network: 'mainnet', rpcUrl: RPC_URL },
  });
}

export function readVault(sdk: VaultSdk, vault = VAULT): Promise<IVault> {
  return sdk.getVault({
    vault: vault.address as IAddress,
    chainId: vault.chainId,
  });
}

function toUnits(raw: bigint, decimals: number): string {
  const digits = raw.toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

function fromUnits(amount: string, decimals: number): string {
  const [, whole = '', fraction = ''] =
    /^(\d*)(?:\.(\d*))?$/.exec(amount.trim()) ?? [];
  const digits = fraction.replace(/0+$/, '');
  const raw =
    digits.length > decimals
      ? 0n
      : BigInt(`0${whole}${digits.padEnd(decimals, '0')}`);
  if (raw <= 0n) {
    throw new Error(
      `Enter an amount above 0 with at most ${decimals} decimals.`,
    );
  }
  return raw.toString();
}

const sdkError = (error: unknown) =>
  (error ?? {}) as {
    code?: string;
    context?: { resultCode?: string; hash?: string };
  };

export function unconfirmedHash(error: unknown): string | null {
  const { code, context } = sdkError(error);
  return code === 'TIMEOUT' ? (context?.hash ?? null) : null;
}

async function signAndSubmit(
  sdk: VaultSdk,
  sign: Sign,
  build: () => Promise<string>,
): Promise<string> {
  const send = async () =>
    sdk.stellar.submitTransaction(await sign(await build()));
  try {
    return await send();
  } catch (error) {
    if (sdkError(error).context?.resultCode !== 'txBadSeq') throw error;
    return send();
  }
}

export async function readPosition(
  sdk: VaultSdk,
  info: IVault,
  wallet: string,
): Promise<Position> {
  const asset = info.depositAssets[0];
  if (!asset) throw new Error('This vault has no deposit token.');
  const [deposit, shares] = await Promise.all([
    sdk.stellar.getUserPosition(asset.address, wallet),
    sdk.stellar.getUserPosition(info.address, wallet),
  ]);
  return {
    deposit: deposit ? toUnits(BigInt(deposit.shares), deposit.decimals) : null,
    shares: shares ? toUnits(BigInt(shares.shares), shares.decimals) : null,
    shareDecimals:
      shares && !shares.decimalsFromFallback ? shares.decimals : null,
  };
}

export async function deposit(
  sdk: VaultSdk,
  sign: Sign,
  wallet: string,
  amount: string,
  info: IVault,
): Promise<string> {
  const asset = info.depositAssets[0];
  if (!asset) throw new Error('This vault has no deposit token.');
  const token = await sdk.stellar.getUserPosition(asset.address, wallet);
  if (!token || token.decimalsFromFallback) {
    throw new Error(`Could not read ${asset.symbol} decimals on chain.`);
  }
  const raw = fromUnits(amount, token.decimals);
  return signAndSubmit(sdk, sign, () =>
    sdk.stellar.vaultDeposit({
      contractId: info.address,
      amount: raw,
      senderAddress: wallet,
    }),
  );
}

export async function withdraw(
  sdk: VaultSdk,
  sign: Sign,
  wallet: string,
  shares: string,
  shareDecimals: number,
  vault = VAULT,
): Promise<string> {
  const raw = fromUnits(shares, shareDecimals);
  return signAndSubmit(sdk, sign, () =>
    sdk.stellar.vaultRedeem({
      contractId: vault.address,
      shares: raw,
      receiverAddress: wallet,
    }),
  );
}
