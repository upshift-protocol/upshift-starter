import type { IVault } from '@augustdigital/sdk';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { createSdk } from '../integration/sdk';
import { StellarActions } from './StellarActions';

const wallet = vi.hoisted(() => ({
  connected: true,
  address: 'GHOLDER',
  signTransaction: vi.fn(),
}));
const actions = vi.hoisted(() => ({
  readStellarAccount: vi.fn(),
  readStellarBalances: vi.fn(),
  previewShares: vi.fn(),
  stellarDeposit: vi.fn(),
  stellarWithdraw: vi.fn(),
}));
vi.mock('../integration/wallets/stellar', () => ({
  useStellarWallet: () => wallet,
}));
vi.mock('../integration/actions/stellar', async (importActual) => ({
  ...(await importActual<typeof import('../integration/actions/stellar')>()),
  ...actions,
}));

const sdk = {} as ReturnType<typeof createSdk>;
const NATIVE = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA';
const vault = {
  address: 'CVAULT',
  depositAssets: [{ address: 'CUSDC', symbol: 'USDC', decimals: 7 }],
  receipt: { address: 'CVAULT', symbol: 'earnUSDC', decimals: 13 },
} as unknown as IVault;

beforeEach(() => {
  vi.clearAllMocks();
  wallet.connected = true;
  actions.readStellarAccount.mockResolvedValue({
    funded: true,
    spendableXlm: 8,
  });
  actions.readStellarBalances.mockResolvedValue({
    deposit: '10',
    shares: { amount: '10000000000000', decimals: 13, trusted: true },
  });
  actions.previewShares.mockResolvedValue('0.9');
});

describe('StellarActions', () => {
  describe('account pre-flight retry', () => {
    afterEach(() => vi.useRealTimers());
    const advance = (ms: number) =>
      act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      });

    it('retries a few times when Horizon is unreachable, then stops', async () => {
      vi.useFakeTimers();
      actions.readStellarAccount.mockResolvedValue({
        funded: null,
        spendableXlm: null,
      });
      render(<StellarActions sdk={sdk} vault={vault} />);
      await advance(60_000);
      expect(actions.readStellarAccount).toHaveBeenCalledTimes(4);
    });

    it('recovers the reserve cap once Horizon answers', async () => {
      vi.useFakeTimers();
      actions.readStellarAccount
        .mockResolvedValueOnce({ funded: null, spendableXlm: null })
        .mockResolvedValue({ funded: true, spendableXlm: 3 });
      const xlmVault = {
        ...vault,
        depositAssets: [{ address: NATIVE, symbol: 'XLM', decimals: 7 }],
      } as unknown as IVault;
      render(<StellarActions sdk={sdk} vault={xlmVault} />);
      await advance(1_000);
      expect(screen.getByText(/Balance: 8/)).toBeInTheDocument();
      await advance(5_000);
      expect(screen.getByText(/Balance: 3/)).toBeInTheDocument();
      expect(actions.readStellarAccount).toHaveBeenCalledTimes(2);
    });
  });

  it('asks to connect Freighter when disconnected', () => {
    wallet.connected = false;
    render(<StellarActions sdk={sdk} vault={vault} />);
    expect(screen.getByText(/Connect Freighter/)).toBeInTheDocument();
  });

  it('blocks an unfunded account and explains activation', async () => {
    actions.readStellarAccount.mockResolvedValue({
      funded: false,
      spendableXlm: null,
    });
    render(<StellarActions sdk={sdk} vault={vault} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/not activated/);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '1' } });
    expect(screen.getByRole('button', { name: 'Deposit' })).toBeDisabled();
  });

  it('previews shares and deposits', async () => {
    actions.stellarDeposit.mockResolvedValue('hash1');
    render(<StellarActions sdk={sdk} vault={vault} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '1' } });
    expect(
      await screen.findByText('Estimated shares: 0.9'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Deposit' }));
    await waitFor(() =>
      expect(actions.stellarDeposit).toHaveBeenCalledWith(
        sdk,
        expect.objectContaining({ address: 'GHOLDER' }),
        vault,
        '1',
      ),
    );
    expect(await screen.findByText('View on explorer')).toHaveAttribute(
      'href',
      expect.stringContaining('hash1'),
    );
  });

  it('caps Max for the native XLM vault at the spendable amount', async () => {
    const xlmVault = {
      ...vault,
      depositAssets: [{ address: NATIVE, symbol: 'XLM', decimals: 7 }],
    } as unknown as IVault;
    render(<StellarActions sdk={sdk} vault={xlmVault} />);
    fireEvent.click(await screen.findByText('Max'));
    expect(screen.getByRole('textbox')).toHaveValue('8');
  });

  it('refuses to withdraw while share decimals come from the fallback', async () => {
    actions.readStellarBalances.mockResolvedValue({
      deposit: '10',
      shares: { amount: '1', decimals: 13, trusted: false },
    });
    render(<StellarActions sdk={sdk} vault={vault} />);
    fireEvent.click(screen.getByText('Withdraw shares'));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '0.0000000000001' },
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      /could not be read/,
    );
    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeDisabled();
  });

  it('withdraws with the on-chain share decimals when trusted', async () => {
    actions.stellarWithdraw.mockResolvedValue('hash2');
    render(<StellarActions sdk={sdk} vault={vault} />);
    fireEvent.click(screen.getByText('Withdraw shares'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '0.5' } });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Withdraw' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    await waitFor(() =>
      expect(actions.stellarWithdraw).toHaveBeenCalledWith(
        sdk,
        expect.anything(),
        vault,
        '0.5',
        13,
      ),
    );
  });
});
