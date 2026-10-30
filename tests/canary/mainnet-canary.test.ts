import * as sdkModule from '@augustdigital/sdk';
import { type IAddress, Solana, Stellar } from '@augustdigital/sdk';
import { describe, expect, it } from 'vitest';
import { FEATURED_VAULTS } from '../../src/config';
import { resolveSolanaTarget } from '../../src/integration/actions/solana';
import { buildSdkConfig, resolveSdkClass } from '../../src/integration/sdk';
import { familyOf } from '../../src/integration/vaults';

const STELLAR_HOLDER =
  'GAHBXQUD5ALLP33GEE3ZUTGTPMC74CZVBQHKNGP2UOR763AR4W3V3Y7I';

const AugustSDK = resolveSdkClass(sdkModule);
const sdk = new AugustSDK(
  buildSdkConfig({
    CI: 'true',
    VITE_RPC_SOLANA: process.env.VITE_RPC_SOLANA || undefined,
  }),
);

describe('featured vaults resolve through the pinned SDK', () => {
  it.each(
    Object.entries(FEATURED_VAULTS),
  )('%s vault is in the catalog with the exact-case address', async (family, featured) => {
    const vault = await sdk.getVault({
      vault: featured.address as IAddress,
      chainId: featured.chainId,
    });
    expect(vault.address).toBe(featured.address);
    expect(familyOf(vault.chainId)).toBe(family);
    expect(vault.depositAssets.length).toBeGreaterThan(0);
  });
});

describe('Solana invariants', () => {
  it('resolves the jitoSOL vault to the v2 program and a separate state PDA', () => {
    expect(resolveSolanaTarget(FEATURED_VAULTS.solana)).toEqual({
      programId: FEATURED_VAULTS.solana.programId,
      vaultAddress: FEATURED_VAULTS.solana.address,
    });
    expect(Solana.constants.vaultIdl.address).toBe(
      FEATURED_VAULTS.solana.programId,
    );
  });

  it('reads a share mint for the featured vault', async () => {
    const { shareMint } = await Solana.utils.getVaultMints({
      vaultProgramId: FEATURED_VAULTS.solana.programId,
      vaultAddress: FEATURED_VAULTS.solana.address,
      connection: sdk.solana.connection,
      idl: Solana.constants.vaultIdl,
    });
    expect(Solana.utils.isSolanaAddress(shareMint)).toBe(true);
  });
});

describe('Stellar invariants', () => {
  it('rejects a lowercased contract id', () => {
    expect(
      Stellar.utils.isStellarAddress(FEATURED_VAULTS.stellar.address),
    ).toBe(true);
    expect(
      Stellar.utils.isStellarAddress(
        FEATURED_VAULTS.stellar.address.toLowerCase(),
      ),
    ).toBe(false);
  });

  it('reads on-chain share decimals for a known holder, never the fallback', async () => {
    const position = await sdk.stellar.getUserPosition(
      FEATURED_VAULTS.stellar.address,
      STELLAR_HOLDER,
    );
    expect(position).not.toBeNull();
    expect(position?.decimalsFromFallback).toBe(false);
    expect(position?.decimals).toBe(FEATURED_VAULTS.stellar.shareDecimals);
  });
});
