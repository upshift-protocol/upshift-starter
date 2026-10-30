import type { IVault } from '@augustdigital/sdk';
import { HISTORY_DAYS, loadVaultDetail, toHistoryPoints } from './vault-detail';

const point = (overrides: Record<string, unknown>) => ({
  tvl: 1,
  daily_apy: 0.01,
  daily_pnl: 0,
  share_price: 1.01,
  total_assets: 1,
  total_shares: 1,
  asset_share_ratio: 1,
  missing: false,
  ...overrides,
});

describe('toHistoryPoints', () => {
  it('sorts by date and maps the fields the chart reads', () => {
    const points = toHistoryPoints({
      data: {
        '2026-10-02': point({ share_price: 1.02, tvl: 20 }),
        '2026-10-01': point({ share_price: 1.01, tvl: 10 }),
      },
    });
    expect(points).toEqual([
      { date: '2026-10-01', sharePrice: 1.01, tvl: 10, dailyApy: 0.01 },
      { date: '2026-10-02', sharePrice: 1.02, tvl: 20, dailyApy: 0.01 },
    ]);
  });

  it('drops days the API marks missing', () => {
    const points = toHistoryPoints({
      data: {
        '2026-10-01': point({}),
        '2026-10-02': point({ missing: true }),
      },
    });
    expect(points.map((p) => p.date)).toEqual(['2026-10-01']);
  });
});

describe('loadVaultDetail', () => {
  it('reads the vault and 30 days of history in parallel', async () => {
    const vault = { address: 'Cabc', chainId: -3, name: 'earnUSDC' } as IVault;
    const getVault = vi.fn().mockResolvedValue(vault);
    const getVaultHistoricalTimeseries = vi
      .fn()
      .mockResolvedValue({ data: { '2026-10-01': point({}) } });
    const detail = await loadVaultDetail(
      { getVault, getVaultHistoricalTimeseries },
      vault,
    );
    expect(getVault).toHaveBeenCalledWith({ vault: 'Cabc', chainId: -3 });
    expect(getVaultHistoricalTimeseries).toHaveBeenCalledWith({
      vault: 'Cabc',
      nDays: HISTORY_DAYS,
    });
    expect(detail.vault).toBe(vault);
    expect(detail.history).toHaveLength(1);
    expect(detail.historyError).toBeNull();
  });

  it('keeps the vault when the history request fails', async () => {
    const vault = { address: 'Cabc', chainId: -3, name: 'earnUSDC' } as IVault;
    const detail = await loadVaultDetail(
      {
        getVault: vi.fn().mockResolvedValue(vault),
        getVaultHistoricalTimeseries: vi
          .fn()
          .mockRejectedValue(new Error('timeseries 500')),
      },
      vault,
    );
    expect(detail).toEqual({
      vault,
      history: [],
      historyError: 'timeseries 500',
    });
  });

  it('fails when the vault itself cannot be read', async () => {
    const vault = { address: 'Cabc', chainId: -3 } as IVault;
    await expect(
      loadVaultDetail(
        {
          getVault: vi.fn().mockRejectedValue(new Error('vault 404')),
          getVaultHistoricalTimeseries: vi.fn().mockResolvedValue({ data: {} }),
        },
        vault,
      ),
    ).rejects.toThrow('vault 404');
  });
});
