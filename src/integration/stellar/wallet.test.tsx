import { act, render, screen, waitFor } from '@testing-library/react';
import {
  STELLAR_MAINNET_PASSPHRASE,
  STELLAR_STORAGE_KEY,
  StellarWalletProvider,
  useStellarWallet,
} from './wallet';

const freighter = vi.hoisted(() => ({
  requestAccess: vi.fn(),
  getAddress: vi.fn(),
  isAllowed: vi.fn(),
  isConnected: vi.fn(),
  signTransaction: vi.fn(),
}));
vi.mock('@stellar/freighter-api', () => freighter);

let wallet: ReturnType<typeof useStellarWallet>;
function Probe() {
  wallet = useStellarWallet();
  return <span>{wallet.address ?? 'disconnected'}</span>;
}

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  freighter.isConnected.mockResolvedValue({ isConnected: true });
  freighter.isAllowed.mockResolvedValue({ isAllowed: true });
  freighter.getAddress.mockResolvedValue({ address: 'GLIVE' });
});

describe('StellarWalletProvider', () => {
  it('never calls requestAccess on mount and starts disconnected', async () => {
    render(
      <StellarWalletProvider>
        <Probe />
      </StellarWalletProvider>,
    );
    await waitFor(() => expect(freighter.isConnected).not.toHaveBeenCalled());
    expect(screen.getByText('disconnected')).toBeInTheDocument();
    expect(freighter.requestAccess).not.toHaveBeenCalled();
  });

  it('restores a stored session in an effect, refreshed from Freighter', async () => {
    localStorage.setItem(STELLAR_STORAGE_KEY, 'GSTORED');
    render(
      <StellarWalletProvider>
        <Probe />
      </StellarWalletProvider>,
    );
    expect(screen.getByText('disconnected')).toBeInTheDocument();
    await screen.findByText('GLIVE');
    expect(freighter.requestAccess).not.toHaveBeenCalled();
  });

  it('drops the stored session when Freighter access was revoked', async () => {
    localStorage.setItem(STELLAR_STORAGE_KEY, 'GSTORED');
    freighter.isAllowed.mockResolvedValue({ isAllowed: false });
    render(
      <StellarWalletProvider>
        <Probe />
      </StellarWalletProvider>,
    );
    await waitFor(() => expect(freighter.isAllowed).toHaveBeenCalled());
    expect(screen.getByText('disconnected')).toBeInTheDocument();
    expect(localStorage.getItem(STELLAR_STORAGE_KEY)).toBeNull();
  });

  it('stays disconnected but keeps the stored session while Freighter is unreachable', async () => {
    localStorage.setItem(STELLAR_STORAGE_KEY, 'GSTORED');
    freighter.isConnected.mockResolvedValue({ isConnected: false });
    render(
      <StellarWalletProvider>
        <Probe />
      </StellarWalletProvider>,
    );
    await waitFor(() => expect(freighter.isConnected).toHaveBeenCalled());
    expect(screen.getByText('disconnected')).toBeInTheDocument();
    expect(localStorage.getItem(STELLAR_STORAGE_KEY)).toBe('GSTORED');
  });

  it('connects through requestAccess, persists, and signs on mainnet', async () => {
    freighter.requestAccess.mockResolvedValue({ address: 'GNEW' });
    freighter.signTransaction.mockResolvedValue({ signedTxXdr: 'SIGNED' });
    render(
      <StellarWalletProvider>
        <Probe />
      </StellarWalletProvider>,
    );
    await act(() => wallet.connect());
    expect(localStorage.getItem(STELLAR_STORAGE_KEY)).toBe('GNEW');
    expect(await wallet.signTransaction('XDR')).toBe('SIGNED');
    expect(freighter.signTransaction).toHaveBeenCalledWith('XDR', {
      networkPassphrase: STELLAR_MAINNET_PASSPHRASE,
      address: 'GNEW',
    });
    act(() => wallet.disconnect());
    expect(localStorage.getItem(STELLAR_STORAGE_KEY)).toBeNull();
  });

  it('surfaces a Freighter error instead of a silent no-op', async () => {
    freighter.requestAccess.mockResolvedValue({
      address: '',
      error: { message: 'User declined access' },
    });
    render(
      <StellarWalletProvider>
        <Probe />
      </StellarWalletProvider>,
    );
    await expect(wallet.connect()).rejects.toThrow('User declined access');
  });
});
