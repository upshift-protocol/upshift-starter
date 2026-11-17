import { PublicKey } from '@solana/web3.js';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { VaultSdk } from '../snippets/solana/upshift-vault';
import { UpshiftVault } from '../snippets/solana/UpshiftVault';

const OWNER = new PublicKey('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
const ASSET = 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn';
const SHARE_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const QUEUE = new PublicKey('Stake11111111111111111111111111111111111111');
const ROUTE_VAULT = {
  chainId: -1,
  address: '2tmMcVv2Ene7wFGebPivhwYhAZyjaJoibMz1GYVaXsB1',
  programId: 'up12bytoZBmwofqsySf2uqKQ7zpfeKiAWwfvqzJjtRt',
};

type FakeWallet = { readyState: string; adapter: { name: string } };

const wallet = vi.hoisted(() => ({
  publicKey: null as unknown,
  selected: null as unknown,
  wallets: [] as { readyState: string; adapter: { name: string } }[],
  select: vi.fn(),
  connect: vi.fn(async () => {}),
  disconnect: vi.fn(),
  signTransaction: vi.fn(),
}));

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    publicKey: wallet.publicKey,
    wallet: wallet.selected,
    wallets: wallet.wallets,
    select: wallet.select,
    connect: wallet.connect,
    disconnect: wallet.disconnect,
    signTransaction: wallet.publicKey ? wallet.signTransaction : undefined,
  }),
}));

const tokenAccount = (amount: string, decimals: number) => ({
  account: {
    data: { parsed: { info: { tokenAmount: { amount, decimals } } } },
  },
});

function fakeSdk({
  queue = null as PublicKey | null,
  depositMintDecimals = 9,
} = {}) {
  const solana = {
    connection: {
      getParsedTokenAccountsByOwner: vi.fn(
        async (_owner: PublicKey, { mint }: { mint: PublicKey }) => ({
          value:
            mint.toBase58() === ASSET
              ? [tokenAccount('2500000000', 9)]
              : [tokenAccount('1000000', 6)],
        }),
      ),
    },
    getVaultStateReadOnly: vi.fn(async () => ({
      vaultState: { shareMint: SHARE_MINT, withdrawalQueueAuthority: queue },
      depositMintDecimals,
    })),
    setWalletProvider: vi.fn(),
    vaultDeposit: vi.fn(async () => 'depositSig'),
    vaultRedeem: vi.fn(async () => 'redeemSig'),
    vaultRequestRedeem: vi.fn(async () => ({
      signature: 'requestSig',
      request: 'req',
      requestId: '1',
    })),
  };
  const getVault = vi.fn(async () => ({
    name: 'Jito SOL',
    address: ROUTE_VAULT.address,
    programId: ROUTE_VAULT.programId,
    chainId: -1,
    apy: { apy: 6 },
    totalAssets: { normalized: '207' },
    depositAssets: [{ address: ASSET, decimals: 9, symbol: 'JitoSOL' }],
    receipt: { address: ROUTE_VAULT.address, decimals: 9, symbol: 'sJitoSOL' },
  }));
  return { sdk: { solana, getVault } as unknown as VaultSdk, solana, getVault };
}

async function typeAndSubmit(
  label: RegExp | string,
  value: string,
  button: string,
) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: button }));
}

describe('Solana UpshiftVault template', () => {
  beforeEach(() => {
    wallet.publicKey = null;
    wallet.selected = null;
    wallet.wallets = [
      { readyState: 'NotDetected', adapter: { name: 'Phantom' } },
      { readyState: 'Installed', adapter: { name: 'Solflare' } },
    ];
    vi.clearAllMocks();
  });

  it('shows the vault it is given, read with the SDK it is given', async () => {
    const { sdk, getVault } = fakeSdk();
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    expect(
      await screen.findByRole('heading', { name: 'Jito SOL' }),
    ).toBeInTheDocument();
    expect(screen.getByText('6.00%')).toBeInTheDocument();
    expect(screen.getByText('207 JitoSOL')).toBeInTheDocument();
    expect(getVault).toHaveBeenCalledWith({
      vault: ROUTE_VAULT.address,
      chainId: -1,
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

  it('selects the first installed wallet and connects once it is selected', async () => {
    const { sdk } = fakeSdk();
    const { rerender } = render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }));
    await act(async () => {});
    expect(wallet.select).toHaveBeenCalledWith('Solflare');
    expect(wallet.connect).not.toHaveBeenCalled();
    wallet.selected = wallet.wallets[1];
    await act(async () => {
      rerender(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    });
    expect(wallet.connect).toHaveBeenCalledOnce();
  });

  it('connects a selected installed wallet straight away', async () => {
    wallet.selected = wallet.wallets[1];
    const { sdk } = fakeSdk();
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }));
    });
    expect(wallet.connect).toHaveBeenCalledOnce();
    expect(wallet.select).not.toHaveBeenCalled();
  });

  it('moves past a remembered wallet that is no longer installed', async () => {
    wallet.selected = wallet.wallets[0] as FakeWallet;
    const { sdk } = fakeSdk();
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }));
    });
    expect(wallet.select).toHaveBeenCalledWith('Solflare');
    expect(wallet.connect).not.toHaveBeenCalled();
  });

  it('asks for a Solana wallet when none is installed', async () => {
    wallet.wallets = [];
    const { sdk } = fakeSdk();
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }));
    expect(
      await screen.findByText('Install a Solana wallet to connect.'),
    ).toBeInTheDocument();
  });

  it('reads the balance and the shares of the vault’s share mint, and disconnects', async () => {
    wallet.publicKey = OWNER;
    const { sdk, solana } = fakeSdk();
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    expect(await screen.findByText('2.5 JitoSOL')).toBeInTheDocument();
    expect(screen.getByText('1 sJitoSOL')).toBeInTheDocument();
    expect(solana.getVaultStateReadOnly).toHaveBeenCalledWith(
      ROUTE_VAULT.programId,
      undefined,
      ROUTE_VAULT.address,
    );
    expect(screen.getByText(OWNER.toBase58())).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(wallet.disconnect).toHaveBeenCalled();
  });

  it('shows the real reason a balance read failed and blocks withdrawals', async () => {
    wallet.publicKey = OWNER;
    const { sdk, solana } = fakeSdk();
    solana.connection.getParsedTokenAccountsByOwner.mockRejectedValue(
      new Error('Indexed requests require a personal token'),
    );
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    expect(
      await screen.findByText(
        'Balance unavailable: Indexed requests require a personal token',
      ),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Shares to withdraw (sJitoSOL)'), {
      target: { value: '1' },
    });
    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeDisabled();
  });

  it('scales a deposit by the deposit mint’s on-chain decimals', async () => {
    wallet.publicKey = OWNER;
    const { sdk, solana } = fakeSdk({ depositMintDecimals: 6 });
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    await screen.findByText('2.5 JitoSOL');
    await typeAndSubmit('Deposit amount (JitoSOL)', '1.5', 'Deposit');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Deposit confirmed: depositSig',
    );
    expect(solana.setWalletProvider).toHaveBeenCalledWith(
      OWNER,
      wallet.signTransaction,
    );
    expect(solana.vaultDeposit).toHaveBeenCalledWith(
      ROUTE_VAULT.programId,
      undefined,
      OWNER,
      1_500_000n,
      undefined,
      ROUTE_VAULT.address,
    );
  });

  it('sends one deposit while the first is still waiting on the wallet', async () => {
    wallet.publicKey = OWNER;
    const { sdk, solana } = fakeSdk();
    let finish = (_: string) => {};
    solana.vaultDeposit.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    await screen.findByText('2.5 JitoSOL');
    await typeAndSubmit('Deposit amount (JitoSOL)', '1', 'Deposit');
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Deposit' })).toBeDisabled();
    fireEvent.submit(screen.getByRole('button', { name: 'Deposit' }));
    await act(async () => {
      finish('onlySig');
    });
    expect(solana.vaultDeposit).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Deposit confirmed: onlySig',
    );
  });

  it('redeems shares scaled by the share mint’s on-chain decimals', async () => {
    wallet.publicKey = OWNER;
    const { sdk, solana } = fakeSdk();
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    await screen.findByText('1 sJitoSOL');
    await typeAndSubmit('Shares to withdraw (sJitoSOL)', '0.5', 'Withdraw');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Withdrawal confirmed: redeemSig',
    );
    expect(solana.vaultRedeem).toHaveBeenCalledWith(
      ROUTE_VAULT.programId,
      undefined,
      OWNER,
      500_000n,
      undefined,
      ROUTE_VAULT.address,
    );
    expect(solana.vaultRequestRedeem).not.toHaveBeenCalled();
  });

  it('requests a withdrawal through the queue when the vault has one', async () => {
    wallet.publicKey = OWNER;
    const { sdk, solana } = fakeSdk({ queue: QUEUE });
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    await screen.findByText('1 sJitoSOL');
    await typeAndSubmit('Shares to withdraw (sJitoSOL)', '0.5', 'Withdraw');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Withdrawal requested: requestSig. Claim it once the cooldown ends.',
    );
    expect(solana.vaultRequestRedeem).toHaveBeenCalledWith({
      vault: ROUTE_VAULT.address,
      wallet: OWNER,
      amount: 500_000n,
    });
    expect(solana.vaultRedeem).not.toHaveBeenCalled();
  });

  it('treats the default public key as no queue', async () => {
    wallet.publicKey = OWNER;
    const { sdk, solana } = fakeSdk({ queue: PublicKey.default });
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    await screen.findByText('1 sJitoSOL');
    await typeAndSubmit('Shares to withdraw (sJitoSOL)', '1', 'Withdraw');
    await screen.findByText(/Withdrawal confirmed/);
    expect(solana.vaultRedeem).toHaveBeenCalledOnce();
  });

  it.each([
    '0',
    '1.0000000001',
    'abc',
  ])('refuses the amount %s before asking the wallet', async (typed) => {
    wallet.publicKey = OWNER;
    const { sdk, solana } = fakeSdk();
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    await screen.findByText('2.5 JitoSOL');
    await typeAndSubmit('Deposit amount (JitoSOL)', typed, 'Deposit');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Deposit failed: Enter an amount above 0 with at most 9 decimals.',
    );
    expect(solana.vaultDeposit).not.toHaveBeenCalled();
  });

  it('accepts trailing zeros past the token’s decimals', async () => {
    wallet.publicKey = OWNER;
    const { sdk, solana } = fakeSdk();
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    await screen.findByText('2.5 JitoSOL');
    await typeAndSubmit('Deposit amount (JitoSOL)', '1.50000000000', 'Deposit');
    await screen.findByText(/Deposit confirmed/);
    expect((solana.vaultDeposit.mock.calls[0] as unknown[])[3]).toBe(
      1_500_000_000n,
    );
  });

  it('passes no vault account when the vault is its own program', async () => {
    wallet.publicKey = OWNER;
    const { sdk, solana, getVault } = fakeSdk();
    const single = { ...ROUTE_VAULT, address: ROUTE_VAULT.programId };
    getVault.mockResolvedValue({
      ...(await getVault()),
      address: single.programId,
    });
    render(<UpshiftVault sdk={sdk} vault={single} />);
    await screen.findByText('1 sJitoSOL');
    expect(solana.getVaultStateReadOnly).toHaveBeenCalledWith(
      single.programId,
      undefined,
      undefined,
    );
  });

  it('forgets the old vault’s data when it is given another vault', async () => {
    wallet.publicKey = OWNER;
    const { sdk, getVault } = fakeSdk();
    const { rerender } = render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    await screen.findByText('1 sJitoSOL');
    getVault.mockImplementationOnce(() => new Promise(() => {}));
    rerender(
      <UpshiftVault
        sdk={sdk}
        vault={{
          ...ROUTE_VAULT,
          address: 'HegTiqVxQV1kRhCTwL2YsdNBfRtGcDRbXGqbTUeUrAoq',
        }}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Loading vault…' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('1 sJitoSOL')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deposit' })).toBeDisabled();
  });
});
