import type AugustSDK from '@augustdigital/sdk';
import {
  AugustSDKError,
  type IVault,
  toNormalizedBn,
} from '@augustdigital/sdk';
import { depositAssetOf } from './solana';

export type StellarSdk = Pick<AugustSDK, 'stellar'>;

export interface StellarSigner {
  address: string;
  signTransaction: (xdr: string) => Promise<string>;
}

export interface StellarAccount {
  funded: boolean | null;
  spendableXlm: number | null;
}

export interface StellarBalances {
  deposit: string | null;
  shares: { amount: string; decimals: number; trusted: boolean } | null;
}

export const NATIVE_XLM_CONTRACT =
  'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA';
const HORIZON_URL = 'https://horizon.stellar.org';

const BASE_RESERVE_XLM = 0.5;
const BASE_ENTRIES = 2;
const FEE_BUFFER_XLM = 0.3;
const STROOPS_PER_XLM = 1e7;

interface HorizonAccount {
  subentry_count: number;
  num_sponsoring?: number;
  num_sponsored?: number;
  balances: Array<{
    asset_type: string;
    balance: string;
    selling_liabilities?: string;
  }>;
}

export function spendableXlm(account: HorizonAccount): number {
  const native = account.balances.find((b) => b.asset_type === 'native');
  if (!native) return 0;
  const entries =
    BASE_ENTRIES +
    account.subentry_count +
    (account.num_sponsoring ?? 0) -
    (account.num_sponsored ?? 0);
  const spendable =
    Number(native.balance) -
    entries * BASE_RESERVE_XLM -
    Number(native.selling_liabilities ?? 0) -
    FEE_BUFFER_XLM;
  return Math.max(spendable, 0);
}

export async function readStellarAccount(
  address: string,
  fetchImpl: typeof fetch = fetch,
): Promise<StellarAccount> {
  try {
    const response = await fetchImpl(`${HORIZON_URL}/accounts/${address}`);
    if (response.status === 404) return { funded: false, spendableXlm: null };
    if (!response.ok) return { funded: null, spendableXlm: null };
    const account = (await response.json()) as HorizonAccount;
    return { funded: true, spendableXlm: spendableXlm(account) };
  } catch {
    return { funded: null, spendableXlm: null };
  }
}

export async function readStellarBalances(
  sdk: StellarSdk,
  address: string,
  vault: Pick<IVault, 'address' | 'depositAssets'>,
): Promise<StellarBalances> {
  const asset = depositAssetOf(vault);
  const [deposit, shares] = await Promise.all([
    sdk.stellar
      .getUserPosition(asset.address, address)
      .then((pos) =>
        pos ? toNormalizedBn(BigInt(pos.shares), pos.decimals).normalized : '0',
      )
      .catch(() => null),
    sdk.stellar
      .getUserPosition(vault.address, address)
      .then((pos) =>
        pos
          ? {
              amount: pos.shares,
              decimals: pos.decimals,
              trusted: !pos.decimalsFromFallback,
            }
          : null,
      )
      .catch(() => null),
  ]);
  return { deposit, shares };
}

export function depositMax(
  balance: string | null,
  assetContract: string,
  account: StellarAccount,
): string | null {
  if (balance === null) return null;
  if (assetContract !== NATIVE_XLM_CONTRACT) return balance;
  const cap = account.spendableXlm ?? Math.max(Number(balance) - 2, 0);
  if (cap >= Number(balance)) return balance;
  const stroops = Math.floor(cap * STROOPS_PER_XLM);
  return (stroops / STROOPS_PER_XLM).toFixed(7).replace(/\.?0+$/, '');
}

export async function previewShares(
  sdk: StellarSdk,
  vault: Pick<IVault, 'address' | 'depositAssets' | 'receipt'>,
  amount: string,
): Promise<string | null> {
  const raw = toNormalizedBn(amount, depositAssetOf(vault).decimals).raw;
  const shares = await sdk.stellar.convertToShares(vault.address, raw);
  return shares === null
    ? null
    : toNormalizedBn(BigInt(shares), vault.receipt.decimals).normalized;
}

export function isStaleSequence(error: unknown): boolean {
  return (
    error instanceof AugustSDKError && error.context?.resultCode === 'txBadSeq'
  );
}

async function signAndSubmit(
  sdk: StellarSdk,
  signer: StellarSigner,
  build: () => Promise<string>,
): Promise<string> {
  const submit = async () =>
    sdk.stellar.submitTransaction(await signer.signTransaction(await build()));
  try {
    return await submit();
  } catch (error) {
    if (!isStaleSequence(error)) throw error;
    return submit();
  }
}

export function stellarDeposit(
  sdk: StellarSdk,
  signer: StellarSigner,
  vault: Pick<IVault, 'address' | 'depositAssets'>,
  amount: string,
): Promise<string> {
  const raw = toNormalizedBn(amount, depositAssetOf(vault).decimals).raw;
  return signAndSubmit(sdk, signer, () =>
    sdk.stellar.vaultDeposit({
      contractId: vault.address,
      amount: raw,
      senderAddress: signer.address,
    }),
  );
}

export function stellarWithdraw(
  sdk: StellarSdk,
  signer: StellarSigner,
  vault: Pick<IVault, 'address'>,
  shares: string,
  shareDecimals: number,
): Promise<string> {
  const raw = toNormalizedBn(shares, shareDecimals).raw;
  return signAndSubmit(sdk, signer, () =>
    sdk.stellar.vaultRedeem({
      contractId: vault.address,
      shares: raw,
      receiverAddress: signer.address,
    }),
  );
}

export function stellarExplorerLink(hash: string): string {
  return `https://stellar.expert/explorer/public/tx/${hash}`;
}
