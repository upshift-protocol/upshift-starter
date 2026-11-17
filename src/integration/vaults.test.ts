import type { IVault } from '@upshiftfinance/sdk';
import { groupVaultsByFamily, listVaultsByFamily } from './vaults';

const vault = (
  chainId: number,
  name: string,
  extra: Partial<Pick<IVault, 'status' | 'isVisible'>> = {},
) =>
  ({
    chainId,
    name,
    address: name,
    status: 'active',
    isVisible: true,
    ...extra,
  }) as IVault;

describe('groupVaultsByFamily', () => {
  it('splits vaults into evm, solana and stellar by synthetic chain id', () => {
    const grouped = groupVaultsByFamily([
      vault(1, 'eth'),
      vault(-1, 'sol'),
      vault(-3, 'xlm'),
      vault(42161, 'arb'),
    ]);
    expect(grouped.evm.map((v) => v.name)).toEqual(['eth', 'arb']);
    expect(grouped.solana.map((v) => v.name)).toEqual(['sol']);
    expect(grouped.stellar.map((v) => v.name)).toEqual(['xlm']);
  });

  it('returns empty families rather than missing keys', () => {
    expect(groupVaultsByFamily([])).toEqual({
      evm: [],
      solana: [],
      stellar: [],
    });
  });
});

describe('listVaultsByFamily', () => {
  it('reads the catalog once, without per-vault enrichment, and groups it', async () => {
    const getVaults = vi.fn().mockResolvedValue([vault(-3, 'xlm')]);
    const grouped = await listVaultsByFamily({ getVaults });
    expect(getVaults).toHaveBeenCalledTimes(1);
    expect(getVaults).toHaveBeenCalledWith({
      loans: false,
      allocations: false,
      loadSubaccounts: false,
      loadSnapshots: false,
    });
    expect(grouped.stellar).toHaveLength(1);
  });

  it('lists only active, visible vaults on chains the starter supports', async () => {
    const getVaults = vi
      .fn()
      .mockResolvedValue([
        vault(1, 'eth'),
        vault(-1, 'sol'),
        vault(-3, 'xlm'),
        vault(1, 'no-flag', { isVisible: undefined }),
        vault(1, 'closed', { status: 'closed' }),
        vault(1, 'testing', { status: 'testing' }),
        vault(1, 'migrated', { status: 'migrated' }),
        vault(1, 'invisible', { isVisible: false }),
        vault(-3, 'invisible-xlm', { isVisible: false }),
        vault(101, 'sui'),
        vault(42161, 'arb'),
      ]);
    const grouped = await listVaultsByFamily({ getVaults });
    expect(grouped.evm.map((v) => v.name)).toEqual(['eth', 'no-flag']);
    expect(grouped.solana.map((v) => v.name)).toEqual(['sol']);
    expect(grouped.stellar.map((v) => v.name)).toEqual(['xlm']);
  });
});
