import { FEATURED_VAULTS } from '../../tests/canary/featured-vaults';
import evmVault from '../snippets/evm/upshift-vault.ts?raw';
import { renderSnippet } from './render';

const FEATURED = FEATURED_VAULTS.evm;
const OTHER = {
  chainId: 1,
  address: '0x0000000000000000000000000000000000000001',
};
const BLOCK =
  "export const VAULT: Vault = {\n  chainId: 1,\n  address: '0x1',\n};";

describe('renderSnippet', () => {
  it('returns the shipped template unchanged for the featured vault', () => {
    expect(renderSnippet(evmVault, FEATURED)).toBe(evmVault);
  });

  it('changes only the VAULT values for another vault', () => {
    const before = evmVault.split('\n');
    const after = renderSnippet(evmVault, OTHER).split('\n');
    expect(after).toHaveLength(before.length);
    expect(after.filter((line, i) => line !== before[i])).toEqual([
      `  address: '${OTHER.address}',`,
    ]);
  });

  it('keeps the template key order whatever order the vault lists', () => {
    expect(
      renderSnippet(evmVault, {
        address: FEATURED.address,
        chainId: FEATURED.chainId,
      }),
    ).toBe(evmVault);
  });

  it('writes numbers bare and strings in single quotes', () => {
    expect(renderSnippet(BLOCK, { chainId: -1, address: 'So1ana' })).toBe(
      "export const VAULT: Vault = {\n  chainId: -1,\n  address: 'So1ana',\n};",
    );
  });

  it.each([
    ['no VAULT block', 'export const other = 1;\n', /found 0/],
    ['two VAULT blocks', `${BLOCK}\n${BLOCK}\n`, /found 2/],
  ])('throws on %s', (_, source, message) => {
    expect(() => renderSnippet(source, OTHER)).toThrow(message);
  });

  it.each([
    ['a missing key', { chainId: 1 }],
    ['an extra key', { ...OTHER, programId: 'up12' }],
  ])('throws on %s', (_, vault) => {
    expect(() => renderSnippet(evmVault, vault)).toThrow(/keys/);
  });
});
