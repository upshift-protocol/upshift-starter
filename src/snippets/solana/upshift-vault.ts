import type { IAddress, IVault } from '@upshiftfinance/sdk';
import UpshiftSDK from '@upshiftfinance/sdk';
import {
  PublicKey,
  type Transaction,
  type VersionedTransaction,
} from '@solana/web3.js';

export interface Vault {
  chainId: number;
  address: string;
  programId: string;
}

export const VAULT: Vault = {
  chainId: -1,
  address: '2tmMcVv2Ene7wFGebPivhwYhAZyjaJoibMz1GYVaXsB1',
  programId: 'up12bytoZBmwofqsySf2uqKQ7zpfeKiAWwfvqzJjtRt',
};

const RPC_URL = 'https://solana-rpc.publicnode.com';

export type VaultSdk = InstanceType<typeof UpshiftSDK>;

export interface Signer {
  publicKey: PublicKey;
  signTransaction: <T extends Transaction | VersionedTransaction>(
    transaction: T,
  ) => Promise<T>;
}

export interface Position {
  deposit: string;
  shares: string;
  shareDecimals: number;
}

export interface Withdrawal {
  signature: string;
  queued: boolean;
}

export function createVaultSdk(): VaultSdk {
  return new UpshiftSDK({
    appName: 'my-app',
    solana: { rpcUrl: RPC_URL, network: 'mainnet-beta' },
  });
}

export function readVault(sdk: VaultSdk, vault = VAULT): Promise<IVault> {
  return sdk.getVault({
    vault: vault.address as IAddress,
    chainId: vault.chainId,
    options: { loans: false, allocations: false },
  });
}

const vaultAccount = (vault: Vault) =>
  vault.address === vault.programId ? undefined : vault.address;

const stateAccount = (vault: Vault) =>
  vaultAccount(vault) ??
  PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('VAULT_STATE')],
    new PublicKey(vault.programId),
  )[0];

function toUnits(raw: bigint, decimals: number): string {
  const digits = raw.toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

function fromUnits(amount: string, decimals: number): bigint {
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
  return raw;
}

async function readState(sdk: VaultSdk, vault: Vault) {
  const { vaultState, depositMintDecimals } =
    await sdk.solana.getVaultStateReadOnly(
      vault.programId,
      undefined,
      vaultAccount(vault),
    );
  if (!vaultState?.shareMint || depositMintDecimals === null) {
    throw new Error('Could not read this vault on chain.');
  }
  const queue = vaultState.withdrawalQueueAuthority;
  return {
    shareMint: vaultState.shareMint,
    depositDecimals: depositMintDecimals,
    queued: Boolean(
      queue && new PublicKey(queue).toBase58() !== PublicKey.default.toBase58(),
    ),
  };
}

async function tokenBalance(
  sdk: VaultSdk,
  owner: string,
  mint: PublicKey | string,
  fallbackDecimals: number,
) {
  const { value } = await sdk.solana.connection.getParsedTokenAccountsByOwner(
    new PublicKey(owner),
    { mint: new PublicKey(mint) },
  );
  const amounts = value.map(
    ({ account }) =>
      account.data.parsed.info.tokenAmount as {
        amount: string;
        decimals: number;
      },
  );
  return {
    raw: amounts.reduce((sum, { amount }) => sum + BigInt(amount), 0n),
    decimals: amounts[0]?.decimals ?? fallbackDecimals,
  };
}

export async function readPosition(
  sdk: VaultSdk,
  info: IVault,
  wallet: string,
): Promise<Position> {
  const asset = info.depositAssets[0];
  if (!asset) throw new Error('This vault has no deposit token.');
  const vault = {
    chainId: info.chainId,
    address: info.address,
    programId: info.programId || info.address,
  };
  const [state, deposit] = await Promise.all([
    readState(sdk, vault),
    tokenBalance(sdk, wallet, asset.address, asset.decimals),
  ]);
  const shares = await tokenBalance(
    sdk,
    wallet,
    state.shareMint,
    info.receipt.decimals,
  );
  return {
    deposit: toUnits(deposit.raw, deposit.decimals),
    shares: toUnits(shares.raw, shares.decimals),
    shareDecimals: shares.decimals,
  };
}

export async function deposit(
  sdk: VaultSdk,
  signer: Signer,
  amount: string,
  vault = VAULT,
): Promise<string> {
  const { depositDecimals } = await readState(sdk, vault);
  const raw = fromUnits(amount, depositDecimals);
  sdk.solana.setWalletProvider(signer.publicKey, signer.signTransaction);
  return sdk.solana.vaultDeposit(
    vault.programId,
    undefined,
    signer.publicKey,
    raw,
    undefined,
    vaultAccount(vault),
  );
}

export async function withdraw(
  sdk: VaultSdk,
  signer: Signer,
  shares: string,
  shareDecimals: number,
  vault = VAULT,
): Promise<Withdrawal> {
  const { queued } = await readState(sdk, vault);
  const amount = fromUnits(shares, shareDecimals);
  sdk.solana.setWalletProvider(signer.publicKey, signer.signTransaction);
  if (queued) {
    const { signature } = await sdk.solana.vaultRequestRedeem({
      vault: stateAccount(vault),
      wallet: signer.publicKey,
      amount,
    });
    return { signature, queued };
  }
  const signature: string = await sdk.solana.vaultRedeem(
    vault.programId,
    undefined,
    signer.publicKey,
    amount,
    undefined,
    vaultAccount(vault),
  );
  return { signature, queued };
}
