import type {
  IAddress,
  IHistoricalTimeseriesResponse,
  IVault,
} from '@augustdigital/sdk';

export interface HistoryPoint {
  date: string;
  sharePrice: number | null;
  tvl: number | null;
  dailyApy: number | null;
}

export interface VaultDetail {
  vault: IVault;
  history: HistoryPoint[];
  historyError: string | null;
}

export interface VaultDetailSdk {
  getVault: (props: { vault: IAddress; chainId?: number }) => Promise<IVault>;
  getVaultHistoricalTimeseries: (props: {
    vault: IAddress;
    nDays?: number;
  }) => Promise<IHistoricalTimeseriesResponse>;
}

export const HISTORY_DAYS = 30;

export function toHistoryPoints(
  response: IHistoricalTimeseriesResponse,
): HistoryPoint[] {
  return Object.entries(response.data)
    .filter(([, point]) => !point.missing)
    .map(([date, point]) => ({
      date,
      sharePrice: point.share_price,
      tvl: point.tvl,
      dailyApy: point.daily_apy,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function loadVaultDetail(
  sdk: VaultDetailSdk,
  target: Pick<IVault, 'address' | 'chainId'>,
): Promise<VaultDetail> {
  const address = target.address as IAddress;
  const [vault, timeseries] = await Promise.allSettled([
    sdk.getVault({ vault: address, chainId: target.chainId }),
    sdk.getVaultHistoricalTimeseries({
      vault: address,
      nDays: HISTORY_DAYS,
    }),
  ]);
  if (vault.status === 'rejected') throw vault.reason;
  if (timeseries.status === 'rejected') {
    const reason = timeseries.reason;
    return {
      vault: vault.value,
      history: [],
      historyError: reason instanceof Error ? reason.message : String(reason),
    };
  }
  return {
    vault: vault.value,
    history: toHistoryPoints(timeseries.value),
    historyError: null,
  };
}
