import type { IVault } from '@augustdigital/sdk';
import { render, screen } from '@testing-library/react';
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

describe('VaultList', () => {
  it('renders one section per family with name, address, APY and TVL', () => {
    render(
      <VaultList
        vaults={{
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
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'EVM' })).toBeInTheDocument();
    expect(screen.getByText('Upshift USDC')).toBeInTheDocument();
    expect(screen.getByText('0xabc')).toBeInTheDocument();
    expect(screen.getByText('5.25%')).toBeInTheDocument();
    expect(screen.getByText('1,234,567.89 USDC')).toBeInTheDocument();
    expect(screen.getByText('n/a')).toBeInTheDocument();
    expect(screen.getByText('42 jitoSOL')).toBeInTheDocument();
    expect(screen.getByText('No vaults returned.')).toBeInTheDocument();
  });
});
