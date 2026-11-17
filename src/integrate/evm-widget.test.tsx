import { act, fireEvent, render, screen } from '@testing-library/react';
import type { VaultSdk } from '../snippets/evm/upshift-vault';
import { UpshiftVault } from '../snippets/evm/UpshiftVault';

const wallet = vi.hoisted(() => ({
  address: undefined as string | undefined,
  chainId: 1,
  connectors: [{ id: 'injected' }] as unknown[],
  connectAsync: vi.fn(),
  disconnect: vi.fn(),
  switchChainAsync: vi.fn(),
  client: { name: 'walletClient' },
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: wallet.address,
    chainId: wallet.chainId,
    isConnected: Boolean(wallet.address),
  }),
  useConnectors: () => wallet.connectors,
  useConnect: () => ({ connectAsync: wallet.connectAsync }),
  useDisconnect: () => ({ disconnect: wallet.disconnect }),
  useSwitchChain: () => ({ switchChainAsync: wallet.switchChainAsync }),
  useWalletClient: () => ({
    data: wallet.address ? wallet.client : undefined,
  }),
}));

const OWNER = '0x00000000000000000000000000000000000000aa';
const ROUTE_VAULT = {
  chainId: 1,
  address: '0x00000000000000000000000000000000000000c1',
};
const ASSET = '0x00000000000000000000000000000000000000a1';
const SHARE = '0x00000000000000000000000000000000000000b1';

function fakeSdk() {
  const evm = {
    setSigner: vi.fn(),
    balanceOf: vi.fn(async ({ asset }: { asset: string }) =>
      asset === ASSET ? 2_500_000n : 10n ** 18n,
    ),
    approve: vi.fn(async () => ({ kind: 'sent', hash: '0xapprove' })),
    vaultDeposit: vi.fn(async () => '0xdeposit'),
    vaultRequestRedeem: vi.fn(async () => '0xredeem'),
  };
  const getVault = vi.fn(async () => ({
    name: 'Route USDC',
    address: ROUTE_VAULT.address,
    chainId: 1,
    apy: { apy: 7.512 },
    totalAssets: { normalized: '1234567.89' },
    depositAssets: [{ address: ASSET, decimals: 6, symbol: 'USDC' }],
    receipt: { address: SHARE, decimals: 18, symbol: 'upUSDC' },
  }));
  return { sdk: { evm, getVault } as unknown as VaultSdk, evm, getVault };
}

const write = {
  target: ROUTE_VAULT.address,
  wallet: OWNER,
  chainId: 1,
  wait: true,
};

describe('EVM UpshiftVault template', () => {
  beforeEach(() => {
    wallet.address = undefined;
    wallet.chainId = 1;
    wallet.connectors = [{ id: 'injected' }];
    vi.clearAllMocks();
  });

  it('shows the name, APY and TVL of the vault it is given, read with the SDK it is given', async () => {
    const { sdk, getVault } = fakeSdk();
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    expect(
      await screen.findByRole('heading', { name: 'Route USDC' }),
    ).toBeInTheDocument();
    expect(screen.getByText('7.51%')).toBeInTheDocument();
    expect(screen.getByText('1,234,567.89 USDC')).toBeInTheDocument();
    expect(getVault).toHaveBeenCalledWith({
      vault: ROUTE_VAULT.address,
      chainId: 1,
      options: { loans: false, allocations: false },
    });
  });

  it('shows why the vault could not load', async () => {
    const { sdk, getVault } = fakeSdk();
    getVault.mockRejectedValueOnce(new Error('Vault not found'));
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Vault not found',
    );
  });

  it('connects with the first injected wallet', async () => {
    const { sdk } = fakeSdk();
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }));
    expect(wallet.connectAsync).toHaveBeenCalledWith({
      connector: wallet.connectors[0],
    });
  });

  it('asks for a browser wallet when none is installed', async () => {
    wallet.connectors = [];
    const { sdk } = fakeSdk();
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Install a browser wallet',
    );
  });

  it('shows the wallet balance and shares, and disconnects', async () => {
    wallet.address = OWNER;
    const { sdk } = fakeSdk();
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    expect(await screen.findByText('2.5 USDC')).toBeInTheDocument();
    expect(screen.getByText('1 upUSDC')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(wallet.disconnect).toHaveBeenCalled();
  });

  it('approves, then deposits the typed amount for the connected wallet', async () => {
    wallet.address = OWNER;
    const { sdk, evm } = fakeSdk();
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    await screen.findByText('2.5 USDC');
    fireEvent.change(screen.getByLabelText('Deposit amount (USDC)'), {
      target: { value: '10' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Deposit' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Deposit confirmed: 0xdeposit',
    );
    expect(evm.setSigner).toHaveBeenCalledWith(wallet.client);
    expect(evm.approve).toHaveBeenCalledWith({ ...write, amount: '10' });
    expect(evm.vaultDeposit).toHaveBeenCalledWith({ ...write, amount: '10' });
    expect(evm.approve.mock.invocationCallOrder[0]).toBeLessThan(
      evm.vaultDeposit.mock.invocationCallOrder[0] as number,
    );
  });

  it('requests a withdrawal of the typed shares', async () => {
    wallet.address = OWNER;
    const { sdk, evm } = fakeSdk();
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    await screen.findByText('1 upUSDC');
    fireEvent.change(screen.getByLabelText('Shares to withdraw (upUSDC)'), {
      target: { value: '0.5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Request withdrawal' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Withdrawal request confirmed: 0xredeem',
    );
    expect(evm.vaultRequestRedeem).toHaveBeenCalledWith({
      ...write,
      amount: '0.5',
    });
  });

  it('shows the wallet error when a deposit fails', async () => {
    wallet.address = OWNER;
    const { sdk, evm } = fakeSdk();
    evm.vaultDeposit.mockRejectedValueOnce(
      new Error('User rejected the request.'),
    );
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    await screen.findByText('2.5 USDC');
    fireEvent.change(screen.getByLabelText('Deposit amount (USDC)'), {
      target: { value: '10' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Deposit' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Deposit failed: User rejected the request.',
    );
  });

  it('blocks writes and offers a network switch on the wrong chain', async () => {
    wallet.address = OWNER;
    wallet.chainId = 8453;
    const { sdk } = fakeSdk();
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    await screen.findByText('2.5 USDC');
    fireEvent.change(screen.getByLabelText('Deposit amount (USDC)'), {
      target: { value: '10' },
    });
    expect(screen.getByRole('button', { name: 'Deposit' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Switch network' }));
    expect(wallet.switchChainAsync).toHaveBeenCalledWith({ chainId: 1 });
  });

  it('sends one deposit while the first is still waiting on the wallet', async () => {
    wallet.address = OWNER;
    const { sdk, evm } = fakeSdk();
    let finish = (_: string) => {};
    evm.vaultDeposit.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    await screen.findByText('2.5 USDC');
    fireEvent.change(screen.getByLabelText('Deposit amount (USDC)'), {
      target: { value: '10' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Deposit' }));
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Deposit' })).toBeDisabled();
    fireEvent.submit(screen.getByRole('button', { name: 'Deposit' }));
    await act(async () => {
      finish('0xonly');
    });
    expect(evm.vaultDeposit).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Deposit confirmed: 0xonly',
    );
  });

  it('forgets the old vault’s data when it is given another vault', async () => {
    wallet.address = OWNER;
    const { sdk, getVault } = fakeSdk();
    const { rerender } = render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    await screen.findByText('1 upUSDC');
    getVault.mockImplementationOnce(() => new Promise(() => {}));
    rerender(
      <UpshiftVault
        sdk={sdk}
        vault={{
          chainId: 1,
          address: '0x00000000000000000000000000000000000000c2',
        }}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Loading vault…' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('1 upUSDC')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deposit' })).toBeDisabled();
  });
});
