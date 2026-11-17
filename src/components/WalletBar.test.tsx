import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WalletSummary } from '../integration/wallets';
import { WalletBar } from './WalletBar';

const wallet = (
  family: WalletSummary['family'],
  overrides: Partial<WalletSummary> = {},
): WalletSummary => ({
  family,
  address: null,
  connected: false,
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
  ...overrides,
});

describe('WalletBar', () => {
  it('offers connect per family and shortens a connected address', () => {
    render(
      <WalletBar
        wallets={{
          evm: wallet('evm', {
            connected: true,
            address: '0x80E1048eDE66ec4c364b4F22C8768fc657FF6A42',
          }),
          solana: wallet('solana'),
          stellar: wallet('stellar'),
        }}
      />,
    );
    const disconnect = screen.getByRole('button', {
      name: 'Disconnect 0x80E1…6A42',
    });
    expect(disconnect).toHaveTextContent(/^0x80E1…6A42$/);
    expect(disconnect).toHaveAttribute('data-tooltip', 'Disconnect');
    expect(screen.getAllByText('Connect')).toHaveLength(2);
  });

  it('keeps four characters on each side of a non-EVM address', () => {
    render(
      <WalletBar
        wallets={{
          evm: wallet('evm'),
          solana: wallet('solana', {
            connected: true,
            address: '6JbuegVZKdfqKWkR1xe57DCC2xWr2jQEqJKzDz1TeFpW',
          }),
          stellar: wallet('stellar', {
            connected: true,
            address: 'GAHBXQUD5ALLP33GEE3ZUTGTPMC74CZVBQHKNGP2UOR763AR4W3V3Y7I',
          }),
        }}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Disconnect 6Jbu…eFpW' }),
    ).toHaveTextContent(/^6Jbu…eFpW$/);
    expect(
      screen.getByRole('button', { name: 'Disconnect GAHB…3Y7I' }),
    ).toBeInTheDocument();
  });

  it('shows a connect failure inline', async () => {
    const stellar = wallet('stellar', {
      connect: vi.fn().mockRejectedValue(new Error('Freighter missing')),
    });
    render(
      <WalletBar
        wallets={{ evm: wallet('evm'), solana: wallet('solana'), stellar }}
      />,
    );
    fireEvent.click(screen.getAllByText('Connect')[2] as HTMLElement);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Freighter missing'),
    );
  });
});
