import { AugustSDKError, type IVault } from '@augustdigital/sdk';
import {
  NATIVE_XLM_CONTRACT,
  type StellarSdk,
  depositMax,
  isStaleSequence,
  previewShares,
  readStellarAccount,
  readStellarBalances,
  spendableXlm,
  stellarDeposit,
  stellarExplorerLink,
  stellarWithdraw,
} from './stellar';

const USDC = 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75';
const vault = {
  address: 'CCL3WITWFFXIHV2I52ECV5DPIEOFSTU3PBPR53ILPLF2IP5KHECXRUTY',
  depositAssets: [{ address: USDC, symbol: 'USDC', decimals: 7 }],
  receipt: { address: 'CCL3', symbol: 'earnUSDC', decimals: 13 },
} as unknown as IVault;
const signer = {
  address: 'GHOLDER',
  signTransaction: vi.fn(async (xdr: string) => `signed:${xdr}`),
};

function sdk() {
  const mock = {
    stellar: {
      getUserPosition: vi.fn(),
      convertToShares: vi.fn(),
      vaultDeposit: vi.fn().mockResolvedValue('depositXdr'),
      vaultRedeem: vi.fn().mockResolvedValue('redeemXdr'),
      submitTransaction: vi.fn().mockResolvedValue('hash'),
    },
  };
  return mock as unknown as StellarSdk & typeof mock;
}

beforeEach(() => vi.clearAllMocks());

describe('spendableXlm', () => {
  it('holds back the reserve, liabilities and a fee buffer', () => {
    expect(
      spendableXlm({
        subentry_count: 1,
        balances: [
          { asset_type: 'native', balance: '10', selling_liabilities: '0.5' },
        ],
      }),
    ).toBeCloseTo(10 - 1.5 - 0.5 - 0.3);
  });
});

describe('readStellarAccount', () => {
  it('reports an unfunded account on 404 and unknown on other failures', async () => {
    const notFound = vi.fn().mockResolvedValue({ status: 404, ok: false });
    await expect(readStellarAccount('G', notFound as never)).resolves.toEqual({
      funded: false,
      spendableXlm: null,
    });
    const down = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(readStellarAccount('G', down as never)).resolves.toEqual({
      funded: null,
      spendableXlm: null,
    });
  });

  it('reports a funded account with its spendable XLM', async () => {
    const ok = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        subentry_count: 0,
        balances: [{ asset_type: 'native', balance: '5' }],
      }),
    });
    await expect(readStellarAccount('G', ok as never)).resolves.toEqual({
      funded: true,
      spendableXlm: 5 - 1 - 0.3,
    });
  });
});

describe('readStellarBalances', () => {
  it('reads the deposit token and the vault shares, keeping the fallback flag', async () => {
    const s = sdk();
    s.stellar.getUserPosition
      .mockResolvedValueOnce({ shares: '25000000', decimals: 7 })
      .mockResolvedValueOnce({
        shares: '1',
        decimals: 13,
        decimalsFromFallback: true,
      });
    await expect(readStellarBalances(s, 'G', vault)).resolves.toEqual({
      deposit: '2.5',
      shares: { amount: '1', decimals: 13, trusted: false },
    });
  });

  it('treats a null token read as no trustline, and a throw as unknown', async () => {
    const s = sdk();
    s.stellar.getUserPosition
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('rpc'));
    await expect(readStellarBalances(s, 'G', vault)).resolves.toEqual({
      deposit: '0',
      shares: null,
    });
  });
});

describe('depositMax', () => {
  it('floors the native cap to stroops so float drift never reaches the input', () => {
    expect(
      depositMax('100', NATIVE_XLM_CONTRACT, {
        funded: true,
        spendableXlm: 0.1 + 0.2,
      }),
    ).toBe('0.3');
  });

  it('writes a single stroop as a plain decimal, never exponent notation', () => {
    expect(
      depositMax('10', NATIVE_XLM_CONTRACT, {
        funded: true,
        spendableXlm: 0.0000001,
      }),
    ).toBe('0.0000001');
  });

  it('writes a zero cap and whole-number caps without stray digits', () => {
    const cap = (spendableXlm: number) =>
      depositMax('1000', NATIVE_XLM_CONTRACT, { funded: true, spendableXlm });
    expect(cap(0)).toBe('0');
    expect(cap(100)).toBe('100');
    expect(cap(10.25)).toBe('10.25');
  });

  it('caps native XLM at the spendable amount', () => {
    expect(
      depositMax('10', NATIVE_XLM_CONTRACT, { funded: true, spendableXlm: 8 }),
    ).toBe('8');
    expect(
      depositMax('10', NATIVE_XLM_CONTRACT, {
        funded: null,
        spendableXlm: null,
      }),
    ).toBe('8');
    expect(depositMax('10', USDC, { funded: true, spendableXlm: 1 })).toBe(
      '10',
    );
  });
});

describe('previewShares', () => {
  it('returns null, not zero, when the preview is unavailable', async () => {
    const s = sdk();
    s.stellar.convertToShares.mockResolvedValue(null);
    await expect(previewShares(s, vault, '1')).resolves.toBeNull();
    s.stellar.convertToShares.mockResolvedValue('10000000000000');
    await expect(previewShares(s, vault, '1')).resolves.toBe('1.0');
    expect(s.stellar.convertToShares).toHaveBeenCalledWith(
      vault.address,
      '10000000',
    );
  });
});

describe('stellarDeposit', () => {
  it('builds in smallest units, signs, submits', async () => {
    const s = sdk();
    await expect(stellarDeposit(s, signer, vault, '1.5')).resolves.toBe('hash');
    expect(s.stellar.vaultDeposit).toHaveBeenCalledWith({
      contractId: vault.address,
      amount: '15000000',
      senderAddress: 'GHOLDER',
    });
    expect(s.stellar.submitTransaction).toHaveBeenCalledWith(
      'signed:depositXdr',
    );
  });

  it('rebuilds and resubmits once on txBadSeq', async () => {
    const s = sdk();
    s.stellar.submitTransaction
      .mockRejectedValueOnce(
        new AugustSDKError('TRANSACTION_FAILED' as never, 'bad seq', {
          context: { resultCode: 'txBadSeq' },
        }),
      )
      .mockResolvedValueOnce('hash2');
    await expect(stellarDeposit(s, signer, vault, '1')).resolves.toBe('hash2');
    expect(s.stellar.vaultDeposit).toHaveBeenCalledTimes(2);
  });
});

describe('stellarWithdraw', () => {
  it('sizes shares with the share decimals', async () => {
    const s = sdk();
    await stellarWithdraw(s, signer, vault, '1', 13);
    expect(s.stellar.vaultRedeem).toHaveBeenCalledWith({
      contractId: vault.address,
      shares: '10000000000000',
      receiverAddress: 'GHOLDER',
    });
  });
});

describe('isStaleSequence', () => {
  it('only matches an SDK error carrying txBadSeq', () => {
    expect(isStaleSequence(new Error('txBadSeq'))).toBe(false);
    expect(
      isStaleSequence(
        new AugustSDKError('TRANSACTION_FAILED' as never, 'x', {
          context: { resultCode: 'txBadSeq' },
        }),
      ),
    ).toBe(true);
  });
});

describe('stellarExplorerLink', () => {
  it('links the public network transaction page', () => {
    expect(stellarExplorerLink('abc123')).toBe(
      'https://stellar.expert/explorer/public/tx/abc123',
    );
  });
});
