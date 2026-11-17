import * as sdkModule from '@upshiftfinance/sdk';
import { describe, expect, it } from 'vitest';
import { resolveSdkClass } from '../../src/integration/sdk';
import {
  VAULT,
  createVaultSdk,
  readPosition,
  readVault,
} from '../../src/snippets/evm/upshift-vault';
import * as solana from '../../src/snippets/solana/upshift-vault';
import * as stellar from '../../src/snippets/stellar/upshift-vault';
import {
  FEATURED_VAULTS,
  SOLANA_HOLDER,
  STELLAR_HOLDER,
} from './featured-vaults';

describe('the shipped Stellar template reads mainnet', () => {
  it('reads the featured vault and a holder’s position with on-chain share decimals', async () => {
    expect(stellar.VAULT).toEqual({
      chainId: FEATURED_VAULTS.stellar.chainId,
      address: FEATURED_VAULTS.stellar.address,
    });
    const sdk = stellar.createVaultSdk();
    const info = await stellar.readVault(sdk);
    expect(info.address).toBe(stellar.VAULT.address);
    const position = await stellar.readPosition(sdk, info, STELLAR_HOLDER);
    expect(position.shares).not.toBeNull();
    expect(position.shareDecimals).toBe(FEATURED_VAULTS.stellar.shareDecimals);
  });
});

const SOLANA_RPC = process.env.VITE_RPC_SOLANA;

describe('the shipped Solana template reads mainnet', () => {
  it('reads the featured vault through upshift-vault.ts as shipped', async () => {
    expect(solana.VAULT).toEqual(FEATURED_VAULTS.solana);
    const info = await solana.readVault(solana.createVaultSdk());
    expect(info.address).toBe(solana.VAULT.address);
    expect(info.programId).toBe(solana.VAULT.programId);
  });

  it.skipIf(!SOLANA_RPC)(
    'reads a position through the share mint on a keyed RPC',
    async () => {
      const UpshiftSDK = resolveSdkClass(sdkModule);
      const sdk = new UpshiftSDK({
        appName: 'starter-canary',
        solana: { rpcUrl: SOLANA_RPC as string, network: 'mainnet-beta' },
      });
      const info = await solana.readVault(sdk);
      const position = await solana.readPosition(sdk, info, SOLANA_HOLDER);
      expect(Number.isFinite(Number(position.deposit))).toBe(true);
      expect(Number.isFinite(Number(position.shares))).toBe(true);
      expect(position.shareDecimals).toBe(info.receipt.decimals);
    },
  );
});

describe('the shipped EVM template reads mainnet', () => {
  it('reads the featured vault and a position through upshift-vault.ts as shipped', async () => {
    expect(VAULT).toEqual(FEATURED_VAULTS.evm);
    const sdk = createVaultSdk();
    const info = await readVault(sdk);
    expect(info.address).toBe(VAULT.address);
    expect(info.depositAssets.length).toBeGreaterThan(0);
    const position = await readPosition(sdk, info, VAULT.address);
    expect(Number.isFinite(Number(position.deposit))).toBe(true);
    expect(Number.isFinite(Number(position.shares))).toBe(true);
  });
});
