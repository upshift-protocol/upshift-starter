import type { IVault } from '@augustdigital/sdk';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { createSdk } from '../integration/sdk';
import { SolanaActions } from './SolanaActions';

const wallet = vi.hoisted(() => ({
  connected: true,
  address: 'HOLDER',
  publicKey: { toBase58: () => 'HOLDER' } as unknown,
  signTransaction: vi.fn() as unknown,
}));
const actions = vi.hoisted(() => ({
  readSolanaBalances: vi.fn(),
  solanaDeposit: vi.fn(),
  solanaWithdraw: vi.fn(),
}));
vi.mock('../integration/wallets/solana', () => ({
  useSolanaWallet: () => wallet,
}));
vi.mock('../integration/actions/solana', async (importActual) => ({
  ...(await importActual<typeof import('../integration/actions/solana')>()),
  ...actions,
  solanaExplorerLink: (sig: string) => `https://explorer/${sig}`,
}));

const sdk = {} as ReturnType<typeof createSdk>;
const vault = {
  address: 'VAULT',
  depositAssets: [{ address: 'mint', symbol: 'jitoSOL', decimals: 9 }],
  receipt: { address: 'VAULT', symbol: 'upJITO', decimals: 9 },
} as unknown as IVault;

beforeEach(() => {
  vi.clearAllMocks();
  wallet.connected = true;
  wallet.signTransaction = vi.fn();
  actions.readSolanaBalances.mockResolvedValue({
    deposit: { amount: '1500000000', decimals: 9 },
    shares: { amount: '2000000000', decimals: 9 },
  });
});

describe('SolanaActions', () => {
  it('asks to connect when no wallet is connected', () => {
    wallet.connected = false;
    render(<SolanaActions sdk={sdk} vault={vault} />);
    expect(screen.getByText(/Connect a Solana wallet/)).toBeInTheDocument();
  });

  it('fills Max from the live balance and deposits, then links the signature', async () => {
    actions.solanaDeposit.mockResolvedValue('sig123');
    render(<SolanaActions sdk={sdk} vault={vault} />);
    fireEvent.click(await screen.findByText('Max'));
    expect(screen.getByRole('textbox')).toHaveValue('1.5');
    fireEvent.click(screen.getByRole('button', { name: 'Deposit' }));
    await waitFor(() =>
      expect(actions.solanaDeposit).toHaveBeenCalledWith(
        sdk,
        expect.objectContaining({ publicKey: wallet.publicKey }),
        vault,
        '1.5',
      ),
    );
    expect(await screen.findByText('View on explorer')).toHaveAttribute(
      'href',
      'https://explorer/sig123',
    );
  });

  it('fills Max as a plain decimal for a balance of a few base units', async () => {
    actions.readSolanaBalances.mockResolvedValue({
      deposit: { amount: '100', decimals: 9 },
      shares: null,
    });
    render(<SolanaActions sdk={sdk} vault={vault} />);
    fireEvent.click(await screen.findByText('Max'));
    expect(screen.getByRole('textbox')).toHaveValue('0.0000001');
  });

  it('says the balance is unknown when it could not be read', async () => {
    actions.readSolanaBalances.mockResolvedValue({
      deposit: null,
      shares: null,
    });
    render(<SolanaActions sdk={sdk} vault={vault} />);
    expect(await screen.findByText(/Balance: unknown/)).toBeInTheDocument();
    expect(screen.queryByText('Max')).toBeNull();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'getTokenAccountsByOwner',
    );
  });

  it('shows no unavailable notice while the balance read is pending or succeeded', async () => {
    render(<SolanaActions sdk={sdk} vault={vault} />);
    expect(screen.queryByText(/Balance unavailable/)).toBeNull();
    expect(await screen.findByText('Max')).toBeInTheDocument();
    expect(screen.queryByText(/Balance unavailable/)).toBeNull();
  });

  it('withdraws using the share decimals from the balance read', async () => {
    actions.solanaWithdraw.mockResolvedValue('sig');
    render(<SolanaActions sdk={sdk} vault={vault} />);
    fireEvent.click(screen.getByText('Withdraw shares'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '1' } });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Withdraw' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    await waitFor(() =>
      expect(actions.solanaWithdraw).toHaveBeenCalledWith(
        sdk,
        expect.anything(),
        vault,
        '1',
        9,
      ),
    );
  });

  it('shows a declined signature without an error banner', async () => {
    const declined = new Error('User rejected the request.');
    declined.name = 'WalletSignTransactionError';
    actions.solanaDeposit.mockRejectedValue(declined);
    render(<SolanaActions sdk={sdk} vault={vault} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Deposit' }));
    expect(await screen.findByText(/Signature declined/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('blocks a deposit larger than the balance', async () => {
    render(<SolanaActions sdk={sdk} vault={vault} />);
    await screen.findByText('Max');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '2' } });
    expect(screen.getByRole('button', { name: 'Deposit' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '1.5' } });
    expect(screen.getByRole('button', { name: 'Deposit' })).toBeEnabled();
  });

  it('re-reads balances after a success, not after a rejection', async () => {
    const declined = new Error('User rejected the request.');
    declined.name = 'WalletSignTransactionError';
    actions.solanaDeposit
      .mockRejectedValueOnce(declined)
      .mockResolvedValueOnce('sig');
    render(<SolanaActions sdk={sdk} vault={vault} />);
    await waitFor(() =>
      expect(actions.readSolanaBalances).toHaveBeenCalledTimes(1),
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Deposit' }));
    await screen.findByText(/Signature declined/);
    expect(actions.readSolanaBalances).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Deposit' }));
    await screen.findByText('View on explorer');
    await waitFor(() =>
      expect(actions.readSolanaBalances).toHaveBeenCalledTimes(2),
    );
  });

  it('disables submit until the wallet can sign', async () => {
    wallet.signTransaction = undefined;
    render(<SolanaActions sdk={sdk} vault={vault} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '1' } });
    expect(
      screen.getByRole('button', { name: 'Reconnect wallet' }),
    ).toBeDisabled();
  });
});
