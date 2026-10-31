import type { IVault } from '@augustdigital/sdk';
import { fireEvent, render, screen } from '@testing-library/react';
import type { VaultsByFamily } from '../integration/vaults';
import { VaultList } from './VaultList';

const vault = (overrides: Partial<IVault>) =>
  ({
    address: '0xabc',
    chainId: 1,
    name: 'Upshift USDC',
    apy: { apy: 5.25 },
    totalAssets: { normalized: '1234567.89', raw: '0' },
    depositAssets: [{ symbol: 'USDC' }],
    ...overrides,
  }) as IVault;

const vaults: VaultsByFamily = {
  evm: [vault({})],
  solana: [
    vault({
      chainId: -1,
      name: 'jitoSOL',
      address: 'sol',
      apy: undefined,
      totalAssets: { normalized: '42', raw: '0' },
      depositAssets: [{ symbol: 'jitoSOL' }],
    } as Partial<IVault>),
  ],
  stellar: [],
};

describe('VaultList', () => {
  it('shows one tab per family with its vault count', () => {
    render(<VaultList vaults={vaults} active="evm" onActiveChange={vi.fn()} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'EVM1',
      'Solana1',
      'Stellar0',
    ]);
    expect(screen.getByRole('tab', { name: /EVM/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(/EVM/);
  });

  it('renders name, address, APY and TVL for the active family only', () => {
    render(<VaultList vaults={vaults} active="evm" onActiveChange={vi.fn()} />);
    expect(screen.getByText('Upshift USDC')).toBeInTheDocument();
    expect(screen.getByText('0xabc')).toBeInTheDocument();
    expect(screen.getByText('5.25%')).toBeInTheDocument();
    expect(screen.getByText('1,234,567.89 USDC')).toBeInTheDocument();
    expect(screen.queryByText('jitoSOL')).not.toBeInTheDocument();
  });

  it('formats a missing APY and says when a family has no vaults', () => {
    const { rerender } = render(
      <VaultList vaults={vaults} active="solana" onActiveChange={vi.fn()} />,
    );
    expect(screen.getByText('n/a')).toBeInTheDocument();
    expect(screen.getByText('42 jitoSOL')).toBeInTheDocument();
    rerender(
      <VaultList vaults={vaults} active="stellar" onActiveChange={vi.fn()} />,
    );
    expect(screen.getByText('No vaults returned.')).toBeInTheDocument();
  });

  it('switches family on click and with the arrow, Home and End keys', () => {
    const onActiveChange = vi.fn();
    render(
      <VaultList
        vaults={vaults}
        active="evm"
        onActiveChange={onActiveChange}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: /Solana/ }));
    expect(onActiveChange).toHaveBeenLastCalledWith('solana');

    const evm = screen.getByRole('tab', { name: /EVM/ });
    fireEvent.keyDown(evm, { key: 'ArrowRight' });
    expect(onActiveChange).toHaveBeenLastCalledWith('solana');
    fireEvent.keyDown(evm, { key: 'ArrowLeft' });
    expect(onActiveChange).toHaveBeenLastCalledWith('stellar');
    fireEvent.keyDown(evm, { key: 'End' });
    expect(onActiveChange).toHaveBeenLastCalledWith('stellar');
    fireEvent.keyDown(evm, { key: 'Home' });
    expect(onActiveChange).toHaveBeenLastCalledWith('evm');
    expect(screen.getByRole('tab', { name: /EVM/ })).toHaveFocus();

    onActiveChange.mockClear();
    fireEvent.keyDown(evm, { key: 'Enter' });
    expect(onActiveChange).not.toHaveBeenCalled();
  });

  it('keeps only the active tab in the tab order', () => {
    render(
      <VaultList vaults={vaults} active="solana" onActiveChange={vi.fn()} />,
    );
    expect(
      screen.getAllByRole('tab').map((tab) => tab.getAttribute('tabindex')),
    ).toEqual(['-1', '0', '-1']);
  });
});
