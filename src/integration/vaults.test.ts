import type { IVault } from '@augustdigital/sdk';
import { groupVaultsByFamily, listVaultsByFamily } from './vaults';

const vault = (chainId: number, name: string) =>
  ({ chainId, name, address: name }) as IVault;

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
  it('reads the catalog once and groups it', async () => {
    const getVaults = vi.fn().mockResolvedValue([vault(-3, 'xlm')]);
    const grouped = await listVaultsByFamily({ getVaults });
    expect(getVaults).toHaveBeenCalledTimes(1);
    expect(getVaults).toHaveBeenCalledWith();
    expect(grouped.stellar).toHaveLength(1);
  });
});
