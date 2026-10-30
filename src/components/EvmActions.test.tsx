import type { IVault } from '@augustdigital/sdk';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { createSdk } from '../integration/sdk';
import { EvmActions } from './EvmActions';

const wallet = vi.hoisted(() => ({
  connected: true,
  address: '0x1111111111111111111111111111111111111111',
  chainId: 1 as number | null,
  walletClient: { account: 'client' } as unknown,
  switchChain: vi.fn(),
}));
const actions = vi.hoisted(() => ({
  readEvmBalances: vi.fn(),
  readEvmRedemptions: vi.fn(),
  evmApprove: vi.fn(),
  evmDeposit: vi.fn(),
  evmRequestRedeem: vi.fn(),
  evmClaim: vi.fn(),
}));
vi.mock('../integration/evm/wallet', () => ({
  useEvmWallet: () => wallet,
}));
vi.mock('../integration/evm/actions', async (importActual) => ({
  ...(await importActual<typeof import('../integration/evm/actions')>()),
  ...actions,
}));

const sdk = {} as ReturnType<typeof createSdk>;
const vault = {
  address: '0x80E1048eDE66ec4c364b4F22C8768fc657FF6A42',
  chainId: 1,
  version: 'evm-2',
  depositAssets: [{ address: '0xusdc', symbol: 'USDC', decimals: 6 }],
  receipt: { address: '0x80E1', symbol: 'upUSDC', decimals: 18 },
} as unknown as IVault;
const redemption = {
  id: 'r1',
  amount: { normalized: '25' },
  date: new Date('2026-10-20'),
  year: { raw: '2026' },
  month: { raw: '10' },
  day: { raw: '20' },
};

beforeEach(() => {
  vi.clearAllMocks();
  wallet.connected = true;
  wallet.chainId = 1;
  wallet.walletClient = { account: 'client' };
  wallet.switchChain.mockResolvedValue(undefined);
  actions.readEvmBalances.mockResolvedValue({ deposit: '100', shares: '40' });
  actions.readEvmRedemptions.mockResolvedValue({
    available: [redemption],
    pending: [],
  });
});

describe('EvmActions', () => {
  it('asks to connect when disconnected', () => {
    wallet.connected = false;
    render(<EvmActions sdk={sdk} vault={vault} />);
    expect(screen.getByText(/Connect an EVM wallet/)).toBeInTheDocument();
  });

  it('keeps deposit locked behind a visible approve step', async () => {
    actions.evmApprove.mockResolvedValue({ kind: 'sent', hash: 'a' });
    actions.evmDeposit.mockResolvedValue('d');
    render(<EvmActions sdk={sdk} vault={vault} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '50' } });
    const deposit = screen.getByRole('button', { name: '2. Deposit' });
    expect(deposit).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '1. Approve USDC' }));
    await screen.findByRole('button', { name: '1. Approved' });
    expect(actions.evmApprove).toHaveBeenCalledWith(
      sdk,
      wallet.walletClient,
      vault,
      wallet.address,
      '50',
    );
    await waitFor(() => expect(deposit).toBeEnabled());
    fireEvent.click(deposit);
    await waitFor(() =>
      expect(actions.evmDeposit).toHaveBeenCalledWith(
        sdk,
        wallet.walletClient,
        vault,
        wallet.address,
        '50',
      ),
    );
    expect(await screen.findByText('View on explorer')).toHaveAttribute(
      'href',
      'https://etherscan.io/tx/d',
    );
  });

  it('treats an existing allowance as approved without showing a transaction', async () => {
    actions.evmApprove.mockResolvedValue({ kind: 'sufficient' });
    render(<EvmActions sdk={sdk} vault={vault} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: '1. Approve USDC' }));
    await screen.findByRole('button', { name: '1. Approved' });
    expect(screen.queryByText('View on explorer')).toBeNull();
    expect(screen.getByRole('button', { name: '2. Deposit' })).toBeEnabled();
  });

  it('lets the user retry the approval after it fails', async () => {
    actions.evmApprove.mockRejectedValue(new Error('rpc down'));
    render(<EvmActions sdk={sdk} vault={vault} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: '1. Approve USDC' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('rpc down');
    expect(
      screen.getByRole('button', { name: '1. Approve USDC' }),
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: '2. Deposit' })).toBeDisabled();
  });

  it('drops a stale approval when Max changes the amount', async () => {
    actions.evmApprove.mockResolvedValue({ kind: 'sent', hash: 'a' });
    render(<EvmActions sdk={sdk} vault={vault} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: '1. Approve USDC' }));
    await screen.findByRole('button', { name: '1. Approved' });
    fireEvent.click(await screen.findByText('Max'));
    expect(screen.getByRole('textbox')).toHaveValue('100');
    expect(screen.getByRole('button', { name: '2. Deposit' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: '1. Approve USDC' }),
    ).toBeEnabled();
  });

  it('requests a redeem in shares', async () => {
    actions.evmRequestRedeem.mockResolvedValue('r');
    render(<EvmActions sdk={sdk} vault={vault} />);
    fireEvent.click(screen.getByText('Request withdrawal'));
    fireEvent.click(await screen.findByText('Max'));
    expect(screen.getByRole('textbox')).toHaveValue('40');
    fireEvent.click(screen.getByRole('button', { name: /Request redeem/ }));
    await waitFor(() =>
      expect(actions.evmRequestRedeem).toHaveBeenCalledWith(
        sdk,
        wallet.walletClient,
        vault,
        wallet.address,
        '40',
      ),
    );
  });

  it('lists matured redemptions and claims one', async () => {
    actions.evmClaim.mockResolvedValue('c');
    render(<EvmActions sdk={sdk} vault={vault} />);
    fireEvent.click(screen.getByText('Claim', { selector: '.tx-tabs button' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Claim 25 upUSDC' }),
    );
    await waitFor(() =>
      expect(actions.evmClaim).toHaveBeenCalledWith(
        sdk,
        wallet.walletClient,
        vault,
        wallet.address,
        redemption,
      ),
    );
  });

  it('asks for a reconnect when the wallet client is gone', () => {
    wallet.walletClient = null;
    render(<EvmActions sdk={sdk} vault={vault} />);
    expect(screen.getByText(/Reconnect your wallet/)).toBeInTheDocument();
  });
  it('labels evm-2 claim rows in shares and older vaults in assets', async () => {
    const { unmount } = render(<EvmActions sdk={sdk} vault={vault} />);
    fireEvent.click(screen.getByText('Claim', { selector: '.tx-tabs button' }));
    expect(await screen.findByText(/25 upUSDC, matured/)).toBeInTheDocument();
    unmount();
    const legacy = { ...vault, version: 'evm-1' } as IVault;
    render(<EvmActions sdk={sdk} vault={legacy} />);
    fireEvent.click(screen.getByText('Claim', { selector: '.tx-tabs button' }));
    expect(await screen.findByText(/25 USDC, matured/)).toBeInTheDocument();
  });

  it('says so and offers a retry when redemptions fail to load', async () => {
    actions.readEvmRedemptions
      .mockRejectedValueOnce(new Error('subgraph down'))
      .mockResolvedValue({ available: [redemption], pending: [] });
    render(<EvmActions sdk={sdk} vault={vault} />);
    fireEvent.click(screen.getByText('Claim', { selector: '.tx-tabs button' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load redemptions.',
    );
    expect(screen.queryByText('Loading redemptions…')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByRole('button', { name: 'Claim 25 upUSDC' }),
    ).toBeInTheDocument();
  });

  it('blocks signing and offers a switch when the wallet is on another chain', async () => {
    wallet.chainId = 137;
    render(<EvmActions sdk={sdk} vault={vault} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your wallet is on chain 137. This vault is on Ethereum.',
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '50' } });
    expect(
      screen.getByRole('button', { name: '1. Approve USDC' }),
    ).toBeDisabled();
    expect(screen.queryByText(/Reconnect your wallet/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Ethereum' }));
    await waitFor(() => expect(wallet.switchChain).toHaveBeenCalledWith(1));
  });

  it('shows why the network switch failed', async () => {
    wallet.chainId = 137;
    wallet.switchChain.mockRejectedValue(
      new Error('User rejected the request.'),
    );
    render(<EvmActions sdk={sdk} vault={vault} />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Ethereum' }));
    expect(
      await screen.findByText('User rejected the request.'),
    ).toBeInTheDocument();
  });

  it('does not offer a form for a vault on a chain the wallet config lacks', () => {
    const polygon = { ...vault, chainId: 137 } as IVault;
    render(<EvmActions sdk={sdk} vault={polygon} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This starter signs on Ethereum mainnet only. This vault is on chain 137.',
    );
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('checks the balance before the wallet opens, for deposit and redeem', async () => {
    render(<EvmActions sdk={sdk} vault={vault} />);
    await screen.findByText('Max');
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '100.5' },
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'more than your balance',
    );
    expect(
      screen.getByRole('button', { name: '1. Approve USDC' }),
    ).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '100' } });
    expect(
      screen.getByRole('button', { name: '1. Approve USDC' }),
    ).toBeEnabled();
    fireEvent.click(screen.getByText('Request withdrawal'));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '40.1' },
    });
    expect(
      screen.getByRole('button', { name: /Request redeem/ }),
    ).toBeDisabled();
  });

  it('rejects exponent notation and excess precision instead of guessing', async () => {
    render(<EvmActions sdk={sdk} vault={vault} />);
    await screen.findByText('Max');
    for (const bad of ['1e-7', '0.0000001']) {
      fireEvent.change(screen.getByRole('textbox'), { target: { value: bad } });
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Enter a plain number with at most 6 decimals.',
      );
      expect(
        screen.getByRole('button', { name: '1. Approve USDC' }),
      ).toBeDisabled();
    }
  });
});
