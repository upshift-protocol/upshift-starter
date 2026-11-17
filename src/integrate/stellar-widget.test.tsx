import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  NETWORK_PASSPHRASE,
  type VaultSdk,
} from '../snippets/stellar/upshift-vault';
import { UpshiftVault } from '../snippets/stellar/UpshiftVault';

const OWNER = 'GAHBXQUD5ALLP33GEE3ZUTGTPMC74CZVBQHKNGP2UOR763AR4W3V3Y7I';
const ASSET = 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75';
const STORAGE_KEY = 'upshift-vault-stellar-address';
const ROUTE_VAULT = {
  chainId: -3,
  address: 'CCL3WITWFFXIHV2I52ECV5DPIEOFSTU3PBPR53ILPLF2IP5KHECXRUTY',
};

const freighter = vi.hoisted(() => ({
  isConnected: vi.fn(),
  isAllowed: vi.fn(),
  getAddress: vi.fn(),
  requestAccess: vi.fn(),
  signTransaction: vi.fn(),
}));

vi.mock('@stellar/freighter-api', () => freighter);

const position = (shares: string, decimals: number, fallback = false) => ({
  shares,
  decimals,
  decimalsFromFallback: fallback,
});

function fakeSdk() {
  const stellar = {
    getUserPosition: vi.fn(async (contract: string) =>
      contract === ASSET
        ? position('25000000', 7)
        : position('10000000000000', 13),
    ),
    vaultDeposit: vi.fn(async () => 'deposit-xdr'),
    vaultRedeem: vi.fn(async () => 'redeem-xdr'),
    submitTransaction: vi.fn(async () => 'txhash'),
  };
  const getVault = vi.fn(async () => ({
    name: 'Earn USDC',
    address: ROUTE_VAULT.address,
    chainId: -3,
    apy: { apy: 4.2 },
    totalAssets: { normalized: '50000' },
    depositAssets: [{ address: ASSET, decimals: 6, symbol: 'USDC' }],
    receipt: { address: ROUTE_VAULT.address, decimals: 7, symbol: 'earnUSDC' },
  }));
  return {
    sdk: { stellar, getVault } as unknown as VaultSdk,
    stellar,
    getVault,
  };
}

async function connected() {
  localStorage.setItem(STORAGE_KEY, OWNER);
  const fake = fakeSdk();
  render(<UpshiftVault sdk={fake.sdk} vault={ROUTE_VAULT} />);
  await screen.findByText('1 earnUSDC');
  return fake;
}

function submit(label: string, value: string, button: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: button }));
}

describe('Stellar UpshiftVault template', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    freighter.isConnected.mockResolvedValue({ isConnected: true });
    freighter.isAllowed.mockResolvedValue({ isAllowed: true });
    freighter.getAddress.mockResolvedValue({ address: OWNER });
    freighter.signTransaction.mockResolvedValue({ signedTxXdr: 'signed-xdr' });
  });

  it('shows the vault it is given, read with the SDK it is given', async () => {
    const { sdk, getVault } = fakeSdk();
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    expect(
      await screen.findByRole('heading', { name: 'Earn USDC' }),
    ).toBeInTheDocument();
    expect(screen.getByText('4.20%')).toBeInTheDocument();
    expect(screen.getByText('50,000 USDC')).toBeInTheDocument();
    expect(getVault).toHaveBeenCalledWith({
      vault: ROUTE_VAULT.address,
      chainId: -3,
      options: { loans: false, allocations: false },
    });
  });

  it('restores the address this widget connected before', async () => {
    await connected();
    expect(screen.getByText('2.5 USDC')).toBeInTheDocument();
    expect(screen.getByText(OWNER)).toBeInTheDocument();
  });

  it('stays disconnected after Disconnect, even though Freighter still allows the site', async () => {
    await connected();
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    const { sdk } = fakeSdk();
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    await act(async () => {});
    expect(
      screen.getAllByRole('button', { name: 'Connect Freighter' }),
    ).toHaveLength(2);
  });

  it('connects through Freighter, remembers the address and clears an old error', async () => {
    freighter.requestAccess
      .mockResolvedValueOnce({
        address: '',
        error: { message: 'User declined' },
      })
      .mockResolvedValueOnce({ address: OWNER });
    const { sdk } = fakeSdk();
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect Freighter' }));
    expect(await screen.findByText('User declined')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Connect Freighter' }));
    expect(await screen.findByText(OWNER)).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(OWNER);
  });

  it('asks for Freighter instead of waiting forever when it is not installed', async () => {
    freighter.isConnected.mockResolvedValue({ isConnected: false });
    const { sdk } = fakeSdk();
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect Freighter' }));
    expect(
      await screen.findByText('Install the Freighter extension to connect.'),
    ).toBeInTheDocument();
    expect(freighter.requestAccess).not.toHaveBeenCalled();
  });

  it('shows unavailable, not 0, when a balance read fails', async () => {
    localStorage.setItem(STORAGE_KEY, OWNER);
    const { sdk, stellar } = fakeSdk();
    stellar.getUserPosition.mockResolvedValue(null as never);
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    expect(await screen.findAllByText('unavailable')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Shares to withdraw (earnUSDC)'), {
      target: { value: '1' },
    });
    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeDisabled();
  });

  it('scales a deposit by the token’s on-chain decimals, signs on mainnet and submits', async () => {
    const { stellar } = await connected();
    submit('Deposit amount (USDC)', '1.5', 'Deposit');
    expect(
      await screen.findByText('Deposit confirmed: txhash'),
    ).toBeInTheDocument();
    expect(stellar.vaultDeposit).toHaveBeenCalledWith({
      contractId: ROUTE_VAULT.address,
      amount: '15000000',
      senderAddress: OWNER,
    });
    expect(freighter.signTransaction).toHaveBeenCalledWith('deposit-xdr', {
      networkPassphrase: NETWORK_PASSPHRASE,
      address: OWNER,
    });
    expect(stellar.submitTransaction).toHaveBeenCalledWith('signed-xdr');
  });

  it('refuses a deposit when the token decimals cannot be read on chain', async () => {
    const { stellar } = await connected();
    stellar.getUserPosition.mockResolvedValue(position('0', 7, true));
    submit('Deposit amount (USDC)', '1', 'Deposit');
    expect(
      await screen.findByText(
        'Deposit failed: Could not read USDC decimals on chain.',
      ),
    ).toBeInTheDocument();
    expect(stellar.vaultDeposit).not.toHaveBeenCalled();
  });

  it('withdraws shares scaled by the on-chain share decimals', async () => {
    const { stellar } = await connected();
    submit('Shares to withdraw (earnUSDC)', '0.25', 'Withdraw');
    expect(
      await screen.findByText('Withdrawal confirmed: txhash'),
    ).toBeInTheDocument();
    expect(stellar.vaultRedeem).toHaveBeenCalledWith({
      contractId: ROUTE_VAULT.address,
      shares: '2500000000000',
      receiverAddress: OWNER,
    });
  });

  it('blocks a withdrawal when the share decimals are only the fallback', async () => {
    localStorage.setItem(STORAGE_KEY, OWNER);
    const { sdk, stellar } = fakeSdk();
    stellar.getUserPosition.mockResolvedValue(position('10000000', 7, true));
    render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    await screen.findByText('1 earnUSDC');
    fireEvent.change(screen.getByLabelText('Shares to withdraw (earnUSDC)'), {
      target: { value: '1' },
    });
    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeDisabled();
  });

  it('says a timed-out transaction is unconfirmed, not failed', async () => {
    const { stellar } = await connected();
    stellar.submitTransaction.mockRejectedValueOnce(
      Object.assign(new Error('Transaction abc not confirmed after 30 polls'), {
        code: 'TIMEOUT',
        context: { hash: 'abc123' },
      }),
    );
    submit('Deposit amount (USDC)', '1', 'Deposit');
    expect(
      await screen.findByText(
        'Deposit sent but not confirmed yet: abc123. Check it on stellar.expert before you try again.',
      ),
    ).toBeInTheDocument();
  });

  it('rebuilds and resubmits once on a stale sequence number', async () => {
    const { stellar } = await connected();
    stellar.submitTransaction.mockRejectedValueOnce(
      Object.assign(new Error('txBadSeq'), {
        code: 'UNKNOWN',
        context: { resultCode: 'txBadSeq' },
      }),
    );
    submit('Shares to withdraw (earnUSDC)', '1', 'Withdraw');
    expect(
      await screen.findByText('Withdrawal confirmed: txhash'),
    ).toBeInTheDocument();
    expect(stellar.vaultRedeem).toHaveBeenCalledTimes(2);
    expect(freighter.signTransaction).toHaveBeenCalledTimes(2);
  });

  it('sends one deposit while the first is still waiting on Freighter', async () => {
    const { stellar } = await connected();
    let finish = (_: string) => {};
    stellar.submitTransaction.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    submit('Deposit amount (USDC)', '1', 'Deposit');
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Deposit' })).toBeDisabled();
    fireEvent.submit(screen.getByRole('button', { name: 'Deposit' }));
    await act(async () => {
      finish('onlyhash');
    });
    expect(stellar.vaultDeposit).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Deposit confirmed: onlyhash',
    );
  });

  it('submits nothing when Freighter refuses to sign', async () => {
    const { stellar } = await connected();
    freighter.signTransaction.mockResolvedValueOnce({
      signedTxXdr: '',
      error: { message: 'User declined' },
    });
    submit('Deposit amount (USDC)', '1', 'Deposit');
    expect(
      await screen.findByText('Deposit failed: User declined'),
    ).toBeInTheDocument();
    expect(stellar.submitTransaction).not.toHaveBeenCalled();
  });

  it('refuses an amount with more decimals than the token has', async () => {
    const { stellar } = await connected();
    submit('Deposit amount (USDC)', '0.00000001', 'Deposit');
    expect(
      await screen.findByText(
        'Deposit failed: Enter an amount above 0 with at most 7 decimals.',
      ),
    ).toBeInTheDocument();
    expect(stellar.vaultDeposit).not.toHaveBeenCalled();
  });

  it('forgets the old vault’s data when it is given another vault', async () => {
    localStorage.setItem(STORAGE_KEY, OWNER);
    const { sdk, getVault } = fakeSdk();
    const { rerender } = render(<UpshiftVault sdk={sdk} vault={ROUTE_VAULT} />);
    await screen.findByText('1 earnUSDC');
    getVault.mockImplementationOnce(() => new Promise(() => {}));
    rerender(
      <UpshiftVault
        sdk={sdk}
        vault={{
          ...ROUTE_VAULT,
          address: 'CC6TRAPQD3NK7THUKWPV5SL2JHKQGNXZVB6S6MVYFSLRWAKEFUWZKZ7J',
        }}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Loading vault…' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('1 earnUSDC')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deposit' })).toBeDisabled();
  });
});
