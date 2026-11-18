import type { IVault } from '@upshiftfinance/sdk';
import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactElement, cloneElement } from 'react';
import { VaultDetail, VaultHistoryChart, VaultStats } from './VaultDetail';

vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: ReactElement }) =>
    cloneElement(
      children as ReactElement<{ width?: number; height?: number }>,
      { width: 600, height: 240 },
    ),
}));

const vault = {
  address: '0x80E1048eDE66ec4c364b4F22C8768fc657FF6A42',
  chainId: 1,
  name: 'Upshift USDC',
  version: 'evm-2',
  receipt: { symbol: 'upUSDC' },
  depositAssets: [{ symbol: 'USDC' }],
  apy: { apy: 7.5 },
  totalAssets: { normalized: '1000000', raw: '0' },
  lagDuration: 172_800,
  isDepositPaused: false,
  isWithdrawalPaused: true,
} as unknown as IVault;

describe('VaultStats', () => {
  it('shows the fields an integrator checks before depositing', () => {
    render(<VaultStats vault={vault} />);
    expect(screen.getByText('evm-2')).toBeInTheDocument();
    expect(screen.getByText('upUSDC')).toBeInTheDocument();
    expect(screen.getByText('7.50%')).toBeInTheDocument();
    expect(screen.getByText('1,000,000 USDC')).toBeInTheDocument();
    expect(screen.getByText('2 days')).toBeInTheDocument();
    expect(
      screen.getByText('Withdrawals paused').nextSibling,
    ).toHaveTextContent('yes');
  });
});

describe('withdrawal period', () => {
  const period = (lagDuration: number | undefined) => {
    render(<VaultStats vault={{ ...vault, lagDuration } as IVault} />);
    return screen.getByText('Withdrawal period').nextSibling;
  };

  it('singularizes one day', () => {
    expect(period(86_400)).toHaveTextContent('1 day');
  });

  it('shows seconds below a day', () => {
    expect(period(3_600)).toHaveTextContent('3600 s');
  });

  it('says n/a when the vault has none', () => {
    expect(period(undefined)).toHaveTextContent('n/a');
  });
});

describe('VaultHistoryChart', () => {
  it('says so when there is no history', () => {
    render(<VaultHistoryChart history={[]} />);
    expect(screen.getByText('No history returned.')).toBeInTheDocument();
  });

  it('says why the history is missing instead of hiding the vault', () => {
    render(<VaultHistoryChart history={[]} error="timeseries 500" />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'History unavailable: timeseries 500',
    );
  });

  it('mounts the chart when there is history', () => {
    render(
      <VaultHistoryChart
        history={[{ date: '2026-10-01', sharePrice: 1, tvl: 1, dailyApy: 0 }]}
      />,
    );
    expect(screen.getByTestId('vault-chart')).toBeInTheDocument();
  });

  it('labels the TVL axis in compact notation so it fits a phone', () => {
    const { container } = render(
      <VaultHistoryChart
        history={[
          { date: '2026-10-01', sharePrice: 1, tvl: 0, dailyApy: 0 },
          { date: '2026-10-02', sharePrice: 1.01, tvl: 2_200_000, dailyApy: 0 },
        ]}
      />,
    );
    const ticks = [
      ...container.querySelectorAll(
        '.yAxis .recharts-cartesian-axis-tick-value',
      ),
    ].map((tick) => tick.textContent);
    expect(ticks).toContain('2.2M');
    expect(ticks).not.toContain('2,200,000');
  });
});

describe('VaultDetail', () => {
  it('navigates back', () => {
    const onBack = vi.fn();
    render(<VaultDetail vault={vault} history={[]} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /All vaults/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('switches to the vault’s integrate page, with Overview marked current', () => {
    render(<VaultDetail vault={vault} history={[]} onBack={() => {}} />);
    const views = screen.getByRole('navigation', { name: 'Vault view' });
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Integrate' })).toHaveAttribute(
      'href',
      `/vaults/ethereum/${vault.address}/integrate`,
    );
    expect(views).toContainElement(
      screen.getByRole('link', { name: 'Overview' }),
    );
  });

  it('has no view switch for a vault on a chain without templates', () => {
    render(
      <VaultDetail
        vault={{ ...vault, chainId: 8453 } as typeof vault}
        history={[]}
        onBack={() => {}}
      />,
    );
    expect(screen.queryByRole('navigation', { name: 'Vault view' })).toBeNull();
  });
});
