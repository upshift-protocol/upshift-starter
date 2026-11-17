import { FEATURED_VAULTS } from '../../tests/canary/featured-vaults';
import type { ChainFamily } from '../integration/vaults';
import { VAULT } from '../snippets/evm/upshift-vault';
import { VAULT as SOLANA_VAULT } from '../snippets/solana/upshift-vault';
import { VAULT as STELLAR_VAULT } from '../snippets/stellar/upshift-vault';
import { renderSnippet } from './render';
import { MANAGERS, PACKAGES, SNIPPETS, installCommand } from './snippets';

const STELLAR_FEATURED = {
  chainId: FEATURED_VAULTS.stellar.chainId,
  address: FEATURED_VAULTS.stellar.address,
};

describe('snippets', () => {
  it.each([
    'evm',
    'solana',
    'stellar',
  ] as const)('ships exactly upshift-vault.ts and UpshiftVault.tsx for %s', (family) => {
    expect(SNIPPETS[family].map((file) => file.name)).toEqual([
      'upshift-vault.ts',
      'UpshiftVault.tsx',
    ]);
    for (const file of SNIPPETS[family]) {
      expect(file.source).toMatch(/^import /);
    }
  });

  it('defaults each template to the featured vault the canary reads', () => {
    expect(VAULT).toEqual(FEATURED_VAULTS.evm);
    expect(SOLANA_VAULT).toEqual(FEATURED_VAULTS.solana);
    expect(STELLAR_VAULT).toEqual(STELLAR_FEATURED);
  });

  it.each([
    ['solana', FEATURED_VAULTS.solana],
    ['stellar', STELLAR_FEATURED],
  ] as const)('renders the %s featured vault back to the shipped source', (family, featured) => {
    const source = SNIPPETS[family][0]?.source ?? '';
    expect(renderSnippet(source, featured)).toBe(source);
  });

  it('imports only the vault module, React, the SDK and that chain’s packages', () => {
    for (const [family, files] of Object.entries(SNIPPETS)) {
      const allowed = new Set([
        './upshift-vault',
        'react',
        ...PACKAGES[family as ChainFamily],
      ]);
      for (const { name, source } of files) {
        const imports = [...source.matchAll(/from '([^']+)'/g)].map(
          (match) => match[1],
        );
        expect(imports.length, name).toBeGreaterThan(0);
        expect(
          imports.filter((spec) => !allowed.has(spec as string)),
          name,
        ).toEqual([]);
      }
    }
  });

  it('lists the SDK first for every chain', () => {
    for (const packages of Object.values(PACKAGES)) {
      expect(packages[0]).toBe('@upshiftfinance/sdk');
    }
  });

  it.each([
    ['npm', 'npm install'],
    ['pnpm', 'pnpm add'],
    ['yarn', 'yarn add'],
    ['bun', 'bun add'],
  ] as const)('builds the %s install line', (manager, verb) => {
    expect(installCommand(manager, 'evm')).toBe(
      `${verb} @upshiftfinance/sdk wagmi viem @tanstack/react-query`,
    );
  });

  it('offers the four package managers in tab order', () => {
    expect(MANAGERS).toEqual(['npm', 'pnpm', 'yarn', 'bun']);
  });
});
