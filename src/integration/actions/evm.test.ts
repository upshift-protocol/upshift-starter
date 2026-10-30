import type { IVault, IVaultAvailableRedemption } from '@augustdigital/sdk';
import {
  type EvmSdk,
  type EvmSigner,
  evmApprove,
  evmClaim,
  evmDeposit,
  evmRequestRedeem,
  readEvmBalances,
  readEvmRedemptions,
} from './evm';

const VAULT = '0x80E1048eDE66ec4c364b4F22C8768fc657FF6A42';
const WALLET = '0x1111111111111111111111111111111111111111';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const vault = {
  address: VAULT,
  chainId: 1,
  version: 'evm-2',
  depositAssets: [{ address: USDC, symbol: 'USDC', decimals: 6 }],
  receipt: { address: VAULT, symbol: 'upUSDC', decimals: 18 },
} as unknown as IVault;
const signer = { account: WALLET } as unknown as EvmSigner;
const redemption = {
  year: { raw: '2026', normalized: '2026' },
  month: { raw: '10', normalized: '10' },
  day: { raw: '28', normalized: '28' },
} as IVaultAvailableRedemption;

function sdk() {
  const mock = {
    evm: {
      setSigner: vi.fn(),
      balanceOf: vi.fn(),
      approve: vi.fn().mockResolvedValue({ kind: 'sent', hash: 'approveHash' }),
      vaultDeposit: vi.fn().mockResolvedValue('depositHash'),
      vaultRequestRedeem: vi.fn().mockResolvedValue('requestHash'),
      vaultRedeem: vi.fn().mockResolvedValue('redeemHash'),
      claimWithdrawal: vi.fn().mockResolvedValue('claimHash'),
    },
    getVaultAvailableRedemptions: vi.fn().mockResolvedValue({
      availableRedemptions: [redemption],
      pendingRedemptions: [],
      processedWithdrawals: [],
      requestedWithdrawals: [],
    }),
  };
  return mock as unknown as EvmSdk & typeof mock;
}

const base = { target: VAULT, wallet: WALLET, chainId: 1, wait: true };

describe('readEvmBalances', () => {
  it('normalizes the deposit token and the receipt token with their own decimals', async () => {
    const s = sdk();
    s.evm.balanceOf
      .mockResolvedValueOnce(2_500_000n)
      .mockResolvedValueOnce(10n ** 18n);
    await expect(readEvmBalances(s, WALLET, vault)).resolves.toEqual({
      deposit: '2.5',
      shares: '1.0',
    });
  });

  it('reports unknown, never zero, when a read fails', async () => {
    const s = sdk();
    s.evm.balanceOf.mockRejectedValue(new Error('rpc'));
    await expect(readEvmBalances(s, WALLET, vault)).resolves.toEqual({
      deposit: null,
      shares: null,
    });
  });
});

describe('writes', () => {
  it('sets the signer before every write', async () => {
    const s = sdk();
    await evmApprove(s, signer, vault, WALLET, '100');
    await evmDeposit(s, signer, vault, WALLET, '100');
    await evmRequestRedeem(s, signer, vault, WALLET, '50');
    await evmClaim(s, signer, vault, WALLET, redemption);
    expect(s.evm.setSigner).toHaveBeenCalledTimes(4);
    expect(s.evm.setSigner).toHaveBeenCalledWith(signer);
  });

  it('approves as a separate, visible step', async () => {
    const s = sdk();
    await expect(evmApprove(s, signer, vault, WALLET, '100')).resolves.toEqual({
      kind: 'sent',
      hash: 'approveHash',
    });
    expect(s.evm.approve).toHaveBeenCalledWith({ ...base, amount: '100' });
  });

  it('deposits and requests redeem in human units with wait', async () => {
    const s = sdk();
    await evmDeposit(s, signer, vault, WALLET, '100');
    await evmRequestRedeem(s, signer, vault, WALLET, '50');
    expect(s.evm.vaultDeposit).toHaveBeenCalledWith({ ...base, amount: '100' });
    expect(s.evm.vaultRequestRedeem).toHaveBeenCalledWith({
      ...base,
      amount: '50',
    });
  });
});

describe('claims', () => {
  it('lists available and pending redemptions for the wallet', async () => {
    const s = sdk();
    await expect(readEvmRedemptions(s, vault, WALLET)).resolves.toEqual({
      available: [redemption],
      pending: [],
    });
    expect(s.getVaultAvailableRedemptions).toHaveBeenCalledWith({
      vault: VAULT,
      chainId: 1,
      wallet: WALLET,
    });
  });

  it('uses claimWithdrawal on evm-2 and vaultRedeem elsewhere', async () => {
    const s = sdk();
    await expect(evmClaim(s, signer, vault, WALLET, redemption)).resolves.toBe(
      'claimHash',
    );
    expect(s.evm.claimWithdrawal).toHaveBeenCalledWith({
      ...base,
      year: '2026',
      month: '10',
      day: '28',
    });
    const legacy = { ...vault, version: 'evm-1' } as IVault;
    await expect(evmClaim(s, signer, legacy, WALLET, redemption)).resolves.toBe(
      'redeemHash',
    );
    expect(s.evm.vaultRedeem).toHaveBeenCalledWith({
      ...base,
      year: '2026',
      month: '10',
      day: '28',
      receiverIndex: '0',
    });
  });
});
