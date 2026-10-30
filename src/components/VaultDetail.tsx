import type { IVault } from '@augustdigital/sdk';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HistoryPoint } from '../integration/vault-detail';

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

function formatSeconds(seconds: number | undefined) {
  if (seconds === undefined) return 'n/a';
  const days = seconds / 86_400;
  if (days < 1) return `${seconds} s`;
  return `${number.format(days)} ${days === 1 ? 'day' : 'days'}`;
}

export function VaultStats({ vault }: { vault: IVault }) {
  const apy = vault.apy?.apy;
  const rows: Array<[string, string]> = [
    ['Address', vault.address],
    ['Chain id', String(vault.chainId)],
    ['Version', vault.version],
    ['Receipt token', vault.receipt?.symbol ?? 'n/a'],
    [
      'Deposit assets',
      vault.depositAssets?.map((a) => a.symbol).join(', ') || 'n/a',
    ],
    ['APY', typeof apy === 'number' ? `${apy.toFixed(2)}%` : 'n/a'],
    [
      'Total assets',
      `${number.format(Number(vault.totalAssets?.normalized ?? 0))} ${vault.depositAssets?.[0]?.symbol ?? ''}`.trim(),
    ],
    ['Withdrawal period', formatSeconds(vault.lagDuration)],
    ['Deposits paused', vault.isDepositPaused ? 'yes' : 'no'],
    ['Withdrawals paused', vault.isWithdrawalPaused ? 'yes' : 'no'],
  ];
  return (
    <dl className="vault-stats">
      {rows.map(([label, value]) => (
        <div key={label} className="vault-stat">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function VaultHistoryChart({
  history,
  error = null,
}: {
  history: HistoryPoint[];
  error?: string | null;
}) {
  if (error) return <p role="alert">History unavailable: {error}</p>;
  if (history.length === 0) return <p>No history returned.</p>;
  return (
    <div className="vault-chart" data-testid="vault-chart">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={history}>
          <XAxis dataKey="date" minTickGap={32} />
          <YAxis
            yAxisId="price"
            domain={['auto', 'auto']}
            tickFormatter={(v: number) => v.toFixed(3)}
            width={64}
          />
          <YAxis
            yAxisId="tvl"
            orientation="right"
            tickFormatter={(v: number) => number.format(v)}
            width={80}
          />
          <Tooltip />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="sharePrice"
            name="Share price"
            stroke="var(--up-color-chart-positive)"
            dot={false}
          />
          <Line
            yAxisId="tvl"
            type="monotone"
            dataKey="tvl"
            name="TVL"
            stroke="var(--up-color-chart-tvl)"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VaultDetail({
  vault,
  history,
  historyError = null,
  onBack,
}: {
  vault: IVault;
  history: HistoryPoint[];
  historyError?: string | null;
  onBack: () => void;
}) {
  return (
    <section className="vault-detail">
      <button type="button" className="link-button" onClick={onBack}>
        ← All vaults
      </button>
      <h2>{vault.name}</h2>
      <VaultStats vault={vault} />
      <h3>Last 30 days</h3>
      <VaultHistoryChart history={history} error={historyError} />
    </section>
  );
}
