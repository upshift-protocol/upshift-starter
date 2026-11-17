import { SPECIAL_CHAINS } from '@upshiftfinance/sdk';
import { FEATURED_VAULTS } from '../../tests/canary/featured-vaults';
import { chainIdOf, integratePath } from './paths';

describe('integrate paths', () => {
  it('maps each chain slug to its chain id', () => {
    expect(chainIdOf('ethereum')).toBe(1);
    expect(chainIdOf('solana')).toBe(SPECIAL_CHAINS.solana.chainId);
    expect(chainIdOf('stellar')).toBe(SPECIAL_CHAINS.stellar.chainId);
  });

  it('builds the integrate path for an Ethereum vault, address case kept', () => {
    expect(integratePath(FEATURED_VAULTS.evm)).toBe(
      `/vaults/ethereum/${FEATURED_VAULTS.evm.address}/integrate`,
    );
  });

  it('builds the integrate path for a Solana vault, base58 case kept', () => {
    expect(integratePath(FEATURED_VAULTS.solana)).toBe(
      `/vaults/solana/${FEATURED_VAULTS.solana.address}/integrate`,
    );
  });

  it('builds the integrate path for a Stellar vault, strkey case kept', () => {
    expect(integratePath(FEATURED_VAULTS.stellar)).toBe(
      `/vaults/stellar/${FEATURED_VAULTS.stellar.address}/integrate`,
    );
  });

  it('has no path for an EVM chain other than Ethereum', () => {
    expect(
      integratePath({ chainId: 8453, address: FEATURED_VAULTS.evm.address }),
    ).toBeNull();
  });

  it('has no path for an EVM chain the starter does not serve', () => {
    expect(integratePath({ chainId: 8453, address: '0xabc' })).toBeNull();
  });
});
