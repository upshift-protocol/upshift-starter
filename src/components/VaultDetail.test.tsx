import type { IVault } from '@augustdigital/sdk';
import { fireEvent, render, screen } from '@testing-library/react';
import { VaultDetail, VaultHistoryChart, VaultStats } from './VaultDetail';

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
});

describe('VaultDetail', () => {
  it('navigates back', () => {
    const onBack = vi.fn();
    render(<VaultDetail vault={vault} history={[]} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /All vaults/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
