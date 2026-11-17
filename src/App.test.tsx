import { type IVault, SPECIAL_CHAINS } from '@upshiftfinance/sdk';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { App, clearVaultCache } from './App';
import { vaultTarget } from './integrate/paths';
import { loadVaultDetail } from './integration/vault-detail';
import { readPositions } from './integration/positions';
import { listVaultsByFamily } from './integration/vaults';
import { matchRoute, navigate, usePathname } from './router';

vi.mock('./integration/sdk', () => ({ createSdk: () => ({}) }));
vi.mock('./components/EvmActions', () => ({ EvmActions: () => null }));
vi.mock('./components/SolanaActions', () => ({ SolanaActions: () => null }));
vi.mock('./integration/vaults', async (importActual) => ({
  ...(await importActual<typeof import('./integration/vaults')>()),
  listVaultsByFamily: vi.fn(),
}));
vi.mock('./integration/vault-detail', () => ({ loadVaultDetail: vi.fn() }));
vi.mock('./integration/positions', () => ({ readPositions: vi.fn() }));
const walletState = vi.hoisted(() => ({ evm: null as string | null }));
vi.mock('./integration/wallets', () => {
  const wallet = (family: string, address: string | null) => ({
    family,
    address,
    connected: address !== null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
  return {
    useWallets: () => ({
      evm: wallet('evm', walletState.evm),
      solana: wallet('solana', null),
      stellar: wallet('stellar', null),
    }),
  };
});

const vault = {
  address: '0xabc',
  chainId: 1,
  name: 'Upshift USDC',
  version: 'evm-2',
  apy: { apy: 5 },
  totalAssets: { normalized: '10', raw: '0' },
  depositAssets: [{ symbol: 'USDC' }],
} as unknown as IVault;

function Routed() {
  return <App target={vaultTarget(matchRoute(usePathname()))} />;
}

const row = () => screen.findByRole('button', { name: /Upshift USDC/ });
const back = () => screen.findByRole('button', { name: /All vaults/ });
const detailOf = (shown: IVault) =>
  vi.mocked(loadVaultDetail).mockResolvedValue({
    vault: shown,
    history: [],
    historyError: null,
  });

describe('App', () => {
  beforeEach(() => {
    clearVaultCache();
    walletState.evm = null;
    window.history.replaceState(null, '', '/vaults');
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.mocked(listVaultsByFamily).mockResolvedValue({
      evm: [vault],
      solana: [],
      stellar: [],
    });
  });

  it('titles the page and leaves the header to the shared layout', async () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Vaults' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
    await row();
  });

  it('returns to the chain tab of the vault that was open', async () => {
    const solana = {
      ...vault,
      address: 'sol',
      chainId: SPECIAL_CHAINS.solana.chainId,
      name: 'jitoSOL',
    } as IVault;
    vi.mocked(listVaultsByFamily).mockResolvedValue({
      evm: [vault],
      solana: [solana],
      stellar: [],
    });
    detailOf(solana);
    render(<Routed />);
    fireEvent.click(await screen.findByRole('tab', { name: /Solana/ }));
    fireEvent.click(screen.getByRole('button', { name: /jitoSOL/ }));
    await screen.findByText('Version');
    expect(window.location.pathname).toBe('/vaults/solana/sol');
    fireEvent.click(await back());
    expect(await screen.findByRole('tab', { name: /Solana/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('button', { name: /jitoSOL/ })).toBeInTheDocument();
  });

  it('keeps the vault list across an unmount, without a refetch or a loading flash', async () => {
    vi.mocked(listVaultsByFamily).mockClear();
    const { unmount } = render(<App />);
    await row();
    unmount();
    render(<App />);
    expect(
      screen.getByRole('button', { name: /Upshift USDC/ }),
    ).toBeInTheDocument();
    expect(listVaultsByFamily).toHaveBeenCalledOnce();
  });

  it('opens a vault at its own URL with an Overview | Integrate switch, and returns to the list', async () => {
    detailOf(vault);
    render(<Routed />);
    fireEvent.click(await row());
    await screen.findByText('Version');
    expect(window.location.pathname).toBe('/vaults/ethereum/0xabc');
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Integrate' })).toHaveAttribute(
      'href',
      '/vaults/ethereum/0xabc/integrate',
    );
    fireEvent.click(await back());
    expect(window.location.pathname).toBe('/vaults');
    expect(await row()).toBeInTheDocument();
  });

  it('opens a vault from a deep link, matching an EVM address by case', async () => {
    detailOf(vault);
    window.history.replaceState(null, '', '/vaults/ethereum/0xABC');
    render(<Routed />);
    expect(await screen.findByText('Version')).toBeInTheDocument();
    expect(loadVaultDetail).toHaveBeenCalledWith(expect.anything(), vault);
  });

  it('gives a vault on another EVM chain a numeric URL and no Integrate view', async () => {
    const base = { ...vault, chainId: 8453, name: 'Base USDC' } as IVault;
    vi.mocked(listVaultsByFamily).mockResolvedValue({
      evm: [base],
      solana: [],
      stellar: [],
    });
    detailOf(base);
    render(<Routed />);
    fireEvent.click(await screen.findByRole('button', { name: /Base USDC/ }));
    await screen.findByText('Version');
    expect(window.location.pathname).toBe('/vaults/8453/0xabc');
    expect(screen.queryByRole('link', { name: 'Integrate' })).toBeNull();
  });

  it('says so when the URL names a vault that is not in the list', async () => {
    window.history.replaceState(null, '', '/vaults/ethereum/0xdead');
    render(<Routed />);
    expect(await screen.findByText(/No vault at/)).toHaveTextContent('0xdead');
    fireEvent.click(await back());
    expect(await row()).toBeInTheDocument();
  });

  it('keeps the vault stats when only the history failed', async () => {
    vi.mocked(loadVaultDetail).mockResolvedValue({
      vault,
      history: [],
      historyError: 'history down',
    });
    render(<Routed />);
    fireEvent.click(await row());
    expect(await screen.findByText('Version')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('history down');
  });

  it('shows why the vault list failed', async () => {
    vi.mocked(listVaultsByFamily).mockRejectedValue(new Error('catalog down'));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('catalog down');
  });

  it('keeps a way back while the detail loads', async () => {
    vi.mocked(loadVaultDetail).mockReturnValue(new Promise(() => {}));
    render(<Routed />);
    fireEvent.click(await row());
    expect(
      await screen.findByText('Loading Upshift USDC…'),
    ).toBeInTheDocument();
    fireEvent.click(await back());
    expect(await row()).toBeInTheDocument();
  });

  it('keeps a way back when the detail fails', async () => {
    vi.mocked(loadVaultDetail).mockRejectedValue(new Error('history down'));
    render(<Routed />);
    fireEvent.click(await row());
    expect(await screen.findByRole('alert')).toHaveTextContent('history down');
    fireEvent.click(await back());
    expect(await row()).toBeInTheDocument();
  });

  it('never shows the previous vault’s detail under the next one', async () => {
    const other = { ...vault, address: '0xdef', name: 'Other USDC' } as IVault;
    vi.mocked(listVaultsByFamily).mockResolvedValue({
      evm: [vault, other],
      solana: [],
      stellar: [],
    });
    detailOf(vault);
    render(<Routed />);
    fireEvent.click(await row());
    await screen.findByRole('heading', { level: 2, name: 'Upshift USDC' });
    vi.mocked(loadVaultDetail).mockReturnValue(new Promise(() => {}));
    act(() => navigate('/vaults/ethereum/0xdef'));
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Upshift USDC' }),
    ).toBeNull();
    expect(screen.getByText('Loading Other USDC…')).toBeInTheDocument();
  });

  it('opens the vault behind a position row, matching EVM addresses by case', async () => {
    walletState.evm = '0x1';
    vi.mocked(readPositions).mockResolvedValue({
      rows: [
        {
          family: 'evm',
          position: {
            vault: '0xABC',
            status: 'STAKED',
            walletBalance: { normalized: '3' },
            redeemable: { normalized: '0' },
          },
        },
        {
          family: 'evm',
          position: {
            vault: '0xOTHER',
            status: 'STAKED',
            walletBalance: { normalized: '4' },
            redeemable: { normalized: '0' },
          },
        },
      ],
      failed: [],
    } as unknown as Awaited<ReturnType<typeof readPositions>>);
    detailOf(vault);
    render(<Routed />);
    const [openable, missing] = (await screen.findAllByRole('button', {
      name: /shares/,
    })) as [HTMLElement, HTMLElement];
    await row();
    expect(missing).toBeDisabled();
    fireEvent.click(openable);
    expect(await screen.findByText('Version')).toBeInTheDocument();
    expect(loadVaultDetail).toHaveBeenCalledWith(expect.anything(), vault);
  });
});
