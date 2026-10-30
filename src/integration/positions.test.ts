import { readPositions } from './positions';

const STELLAR = 'GAHBXQUD5ALLP33GEE3ZUTGTPMC74CZVBQHKNGP2UOR763AR4W3V3Y7I';
const none = { evm: null, solana: null, stellar: null };

describe('readPositions', () => {
  it('skips the read entirely when no wallet is connected', async () => {
    const getVaultPositions = vi.fn();
    await expect(readPositions({ getVaultPositions }, none)).resolves.toEqual({
      rows: [],
      failed: [],
    });
    expect(getVaultPositions).not.toHaveBeenCalled();
  });

  it('reads each connected family on its own with the address exactly as given', async () => {
    const getVaultPositions = vi.fn().mockResolvedValue([]);
    await readPositions(
      { getVaultPositions },
      { evm: '0xAbC', solana: null, stellar: STELLAR },
    );
    expect(getVaultPositions).toHaveBeenCalledTimes(2);
    expect(getVaultPositions).toHaveBeenCalledWith({ wallet: '0xAbC' });
    expect(getVaultPositions).toHaveBeenCalledWith({ stellarWallet: STELLAR });
  });

  it('keeps the families that answered when another one fails', async () => {
    const getVaultPositions = vi.fn(
      async (props: { wallet?: string; solanaWallet?: string }) => {
        if (props.wallet) throw new Error('rpc down');
        return [{ vault: 'Sol1' }];
      },
    );
    const result = await readPositions({ getVaultPositions } as never, {
      evm: '0x1',
      solana: 'SoLaNa',
      stellar: null,
    });
    expect(result.failed).toEqual(['evm']);
    expect(result.rows).toEqual([
      { family: 'solana', position: { vault: 'Sol1' } },
    ]);
  });
});
