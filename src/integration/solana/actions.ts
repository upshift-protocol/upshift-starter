import type AugustSDK from '@augustdigital/sdk';
import { type IVault, Solana, toNormalizedBn } from '@augustdigital/sdk';
import {
  PublicKey,
  type Transaction,
  type VersionedTransaction,
} from '@solana/web3.js';
import { depositAssetOf } from '../vaults';

export interface SolanaSigner {
  publicKey: PublicKey;
  signTransaction: <T extends Transaction | VersionedTransaction>(
    tx: T,
  ) => Promise<T>;
}

export interface SolanaTarget {
  programId: string;
  vaultAddress: string | undefined;
}

export interface RawBalance {
  amount: string;
  decimals: number;
}

export interface SolanaBalances {
  deposit: RawBalance | null;
  shares: RawBalance | null;
}

export type SolanaSdk = Pick<AugustSDK, 'solana'>;

export function resolveSolanaTarget(
  vault: Pick<IVault, 'address' | 'programId'>,
): SolanaTarget {
  const programId = Solana.utils.resolveProgramId(vault.address, {
    program_id: vault.programId,
  });
  return {
    programId,
    vaultAddress: vault.address === programId ? undefined : vault.address,
  };
}

async function readRawBalance(
  sdk: SolanaSdk,
  owner: PublicKey | string,
  mint: string,
  fallbackDecimals: number,
): Promise<RawBalance> {
  const { amount, decimals } = await sdk.solana.fetchUserShareBalanceRaw(
    owner,
    mint,
  );
  if (decimals === null && amount === '0')
    await sdk.solana.connection.getParsedTokenAccountsByOwner(
      new PublicKey(owner),
      { mint: new PublicKey(mint) },
    );
  return { amount, decimals: decimals ?? fallbackDecimals };
}

export function normalizeBalance(balance: RawBalance): string {
  return toNormalizedBn(BigInt(balance.amount), balance.decimals).normalized;
}

export async function readSolanaBalances(
  sdk: SolanaSdk,
  publicKey: PublicKey | string,
  vault: Pick<IVault, 'address' | 'programId' | 'depositAssets' | 'receipt'>,
): Promise<SolanaBalances> {
  const target = resolveSolanaTarget(vault);
  const asset = depositAssetOf(vault);
  const [deposit, shares] = await Promise.all([
    readRawBalance(sdk, publicKey, asset.address, asset.decimals).catch(
      () => null,
    ),
    Solana.utils
      .getVaultMints({
        vaultProgramId: target.programId,
        vaultAddress: target.vaultAddress,
        connection: sdk.solana.connection,
        idl: Solana.constants.vaultIdl,
      })
      .then(({ shareMint }) =>
        readRawBalance(sdk, publicKey, shareMint, vault.receipt.decimals),
      )
      .catch(() => null),
  ]);
  return { deposit, shares };
}

export function toRawAmount(amount: string, decimals: number): bigint {
  return BigInt(toNormalizedBn(amount, decimals).raw);
}

export async function solanaDeposit(
  sdk: SolanaSdk,
  signer: SolanaSigner,
  vault: Pick<IVault, 'address' | 'programId' | 'depositAssets'>,
  amount: string,
  options?: { slippageBps?: number },
): Promise<string> {
  const target = resolveSolanaTarget(vault);
  const raw = toRawAmount(amount, depositAssetOf(vault).decimals);
  sdk.solana.setWalletProvider(signer.publicKey, signer.signTransaction);
  return sdk.solana.vaultDeposit(
    target.programId,
    Solana.constants.vaultIdl,
    signer.publicKey,
    raw,
    undefined,
    target.vaultAddress,
    options,
  );
}

export async function solanaWithdraw(
  sdk: SolanaSdk,
  signer: SolanaSigner,
  vault: Pick<IVault, 'address' | 'programId'>,
  shares: string,
  shareDecimals: number,
  options?: { slippageBps?: number },
): Promise<string> {
  const target = resolveSolanaTarget(vault);
  const raw = toRawAmount(shares, shareDecimals);
  sdk.solana.setWalletProvider(signer.publicKey, signer.signTransaction);
  return sdk.solana.vaultRedeem(
    target.programId,
    Solana.constants.vaultIdl,
    signer.publicKey,
    raw,
    undefined,
    target.vaultAddress,
    options,
  );
}

export function solanaExplorerLink(signature: string): string {
  return Solana.utils.getExplorerLink({ signature, type: 'tx' });
}
