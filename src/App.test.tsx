import type { IVault } from '@augustdigital/sdk';
import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';
import { loadVaultDetail } from './integration/vault-detail';
import { readPositions } from './integration/positions';
import { listVaultsByFamily } from './integration/vaults';

vi.mock('./integration/sdk', () => ({ createSdk: () => ({}) }));
vi.mock('./components/EvmActions', () => ({ EvmActions: () => null }));
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

const row = () => screen.findByRole('button', { name: /Upshift USDC/ });
const back = () => screen.findByRole('button', { name: /All vaults/ });

describe('App', () => {
  beforeEach(() => {
    walletState.evm = null;
    vi.mocked(listVaultsByFamily).mockResolvedValue({
      evm: [vault],
      solana: [],
      stellar: [],
    });
  });

  it('opens a vault and returns to the list', async () => {
    vi.mocked(loadVaultDetail).mockResolvedValue({
      vault,
      history: [],
      historyError: null,
    });
    render(<App />);
    fireEvent.click(await row());
    await screen.findByText('Version');
    fireEvent.click(await back());
    expect(await row()).toBeInTheDocument();
  });

  it('keeps the vault stats when only the history failed', async () => {
    vi.mocked(loadVaultDetail).mockResolvedValue({
      vault,
      history: [],
      historyError: 'history down',
    });
    render(<App />);
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
    render(<App />);
    fireEvent.click(await row());
    expect(screen.getByText('Loading Upshift USDC…')).toBeInTheDocument();
    fireEvent.click(await back());
    expect(await row()).toBeInTheDocument();
  });

  it('keeps a way back when the detail fails', async () => {
    vi.mocked(loadVaultDetail).mockRejectedValue(new Error('history down'));
    render(<App />);
    fireEvent.click(await row());
    expect(await screen.findByRole('alert')).toHaveTextContent('history down');
    fireEvent.click(await back());
    expect(await row()).toBeInTheDocument();
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
    vi.mocked(loadVaultDetail).mockResolvedValue({
      vault,
      history: [],
      historyError: null,
    });
    render(<App />);
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
