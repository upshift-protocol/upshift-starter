import type { IVault } from '@augustdigital/sdk';
import {
  type SolanaSdk,
  type SolanaSigner,
  normalizeBalance,
  readSolanaBalances,
  resolveSolanaTarget,
  solanaDeposit,
  solanaWithdraw,
  toRawAmount,
} from './solana';

const sdkMocks = vi.hoisted(() => ({
  getVaultMints: vi.fn(),
  resolveProgramId: vi.fn(),
}));
vi.mock('@augustdigital/sdk', async (importActual) => {
  const actual = await importActual<typeof import('@augustdigital/sdk')>();
  return {
    ...actual,
    Solana: {
      ...actual.Solana,
      constants: { ...actual.Solana.constants, vaultIdl: { name: 'idl' } },
      utils: {
        ...actual.Solana.utils,
        getVaultMints: sdkMocks.getVaultMints,
        resolveProgramId: sdkMocks.resolveProgramId,
      },
    },
  };
});

const PROGRAM = 'up12bytoZBmwofqsySf2uqKQ7zpfeKiAWwfvqzJjtRt';
const HOLDER = '11111111111111111111111111111111';
const JITO_MINT = 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn';
const SHARE_MINT = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const VAULT = '2tmMcVv2Ene7wFGebPivhwYhAZyjaJoibMz1GYVaXsB1';
const vault = {
  address: VAULT,
  programId: PROGRAM,
  depositAssets: [{ address: JITO_MINT, symbol: 'jitoSOL', decimals: 9 }],
  receipt: { address: VAULT, symbol: 'upJITO', decimals: 9 },
} as unknown as IVault;
const signer = {
  publicKey: { toBase58: () => HOLDER },
  signTransaction: vi.fn(),
} as unknown as SolanaSigner;

function sdk() {
  const mock = {
    solana: {
      connection: {
        getParsedTokenAccountsByOwner: vi.fn().mockResolvedValue({ value: [] }),
      },
      setWalletProvider: vi.fn(),
      fetchUserShareBalanceRaw: vi.fn(
        async (
          _owner: string,
          mint: string,
        ): Promise<{ amount: string; decimals: number | null }> =>
          mint === JITO_MINT
            ? { amount: '1500000000', decimals: 9 }
            : { amount: '2000000000', decimals: 9 },
      ),
      vaultDeposit: vi.fn().mockResolvedValue('depositSig'),
      vaultRedeem: vi.fn().mockResolvedValue('redeemSig'),
    },
  };
  return mock as unknown as SolanaSdk & typeof mock;
}

beforeEach(() => {
  vi.clearAllMocks();
  sdkMocks.resolveProgramId.mockReturnValue(PROGRAM);
  sdkMocks.getVaultMints.mockResolvedValue({ shareMint: SHARE_MINT });
});

describe('resolveSolanaTarget', () => {
  it('hands the catalog programId to the SDK resolver and keeps the state address', () => {
    expect(resolveSolanaTarget({ address: VAULT, programId: PROGRAM })).toEqual(
      { programId: PROGRAM, vaultAddress: VAULT },
    );
    expect(sdkMocks.resolveProgramId).toHaveBeenCalledWith(VAULT, {
      program_id: PROGRAM,
    });
  });

  it('omits the vault address for legacy vaults where address is the program', () => {
    sdkMocks.resolveProgramId.mockReturnValue(VAULT);
    expect(
      resolveSolanaTarget({ address: VAULT, programId: undefined })
        .vaultAddress,
    ).toBeUndefined();
  });
});

describe('toRawAmount', () => {
  it('converts the UI amount with the token decimals into a bigint', () => {
    expect(toRawAmount('1.5', 9)).toBe(1_500_000_000n);
  });
});

describe('readSolanaBalances', () => {
  it('returns raw deposit and share balances with on-chain decimals', async () => {
    const s = sdk();
    await expect(readSolanaBalances(s, HOLDER, vault)).resolves.toEqual({
      deposit: { amount: '1500000000', decimals: 9 },
      shares: { amount: '2000000000', decimals: 9 },
    });
    expect(s.solana.fetchUserShareBalanceRaw).toHaveBeenCalledWith(
      HOLDER,
      JITO_MINT,
    );
    expect(s.solana.fetchUserShareBalanceRaw).toHaveBeenCalledWith(
      HOLDER,
      SHARE_MINT,
    );
  });

  it('reports unknown, never zero, when a read fails', async () => {
    const s = sdk();
    s.solana.fetchUserShareBalanceRaw.mockRejectedValue(new Error('rpc'));
    sdkMocks.getVaultMints.mockRejectedValue(new Error('rpc'));
    await expect(readSolanaBalances(s, HOLDER, vault)).resolves.toEqual({
      deposit: null,
      shares: null,
    });
  });

  it('treats a swallowed lookup failure as unknown when the RPC rejects token-account queries', async () => {
    const s = sdk();
    s.solana.fetchUserShareBalanceRaw.mockResolvedValue({
      amount: '0',
      decimals: null,
    });
    s.solana.connection.getParsedTokenAccountsByOwner.mockRejectedValue(
      new Error('Indexed requests require a personal token'),
    );
    await expect(readSolanaBalances(s, HOLDER, vault)).resolves.toEqual({
      deposit: null,
      shares: null,
    });
  });

  it('reports a genuine zero when the wallet has no token account and the endpoint is up', async () => {
    const s = sdk();
    s.solana.fetchUserShareBalanceRaw.mockResolvedValue({
      amount: '0',
      decimals: null,
    });
    await expect(readSolanaBalances(s, HOLDER, vault)).resolves.toEqual({
      deposit: { amount: '0', decimals: 9 },
      shares: { amount: '0', decimals: 9 },
    });
  });
});

describe('normalizeBalance', () => {
  it('keeps tiny balances as plain decimals, not exponent notation', () => {
    expect(normalizeBalance({ amount: '100', decimals: 9 })).toBe('0.0000001');
  });

  it('keeps every base unit of a large balance', () => {
    expect(normalizeBalance({ amount: '9007199254740993', decimals: 9 })).toBe(
      '9007199.254740993',
    );
  });
});

describe('solanaDeposit', () => {
  it('hands the wallet to the SDK, then deposits raw units with undefined in slot five', async () => {
    const s = sdk();
    await expect(solanaDeposit(s, signer, vault, '1.5')).resolves.toBe(
      'depositSig',
    );
    expect(s.solana.setWalletProvider).toHaveBeenCalledWith(
      signer.publicKey,
      signer.signTransaction,
    );
    expect(s.solana.vaultDeposit).toHaveBeenCalledWith(
      PROGRAM,
      { name: 'idl' },
      signer.publicKey,
      1_500_000_000n,
      undefined,
      VAULT,
      undefined,
    );
  });
});

describe('solanaWithdraw', () => {
  it('sizes shares with the share decimals, not the deposit decimals', async () => {
    const s = sdk();
    await solanaWithdraw(s, signer, vault, '2', 6, { slippageBps: 100 });
    expect(s.solana.vaultRedeem).toHaveBeenCalledWith(
      PROGRAM,
      { name: 'idl' },
      signer.publicKey,
      2_000_000n,
      undefined,
      VAULT,
      { slippageBps: 100 },
    );
  });
});
