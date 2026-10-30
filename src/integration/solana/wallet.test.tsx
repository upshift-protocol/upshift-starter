import { WalletNotSelectedError } from '@solana/wallet-adapter-react';
import { act, renderHook } from '@testing-library/react';
import { useSolanaWallet } from './wallet';

const adapter = vi.hoisted(() => ({ useWallet: vi.fn() }));

vi.mock('@solana/wallet-adapter-react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@solana/wallet-adapter-react')>()),
  useWallet: adapter.useWallet,
}));

const installed = { readyState: 'Installed', adapter: { name: 'Phantom' } };

function walletState(overrides: Record<string, unknown> = {}) {
  return {
    publicKey: null,
    connected: false,
    signTransaction: vi.fn(),
    wallets: [installed, { readyState: 'NotDetected', adapter: { name: 'X' } }],
    select: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    ...overrides,
  };
}

describe('useSolanaWallet', () => {
  it('lists only installed wallets and selects the first on connect', async () => {
    const state = walletState();
    adapter.useWallet.mockReturnValue(state);
    const { result } = renderHook(() => useSolanaWallet());
    expect(result.current.wallets).toEqual(['Phantom']);
    await act(() => result.current.connect());
    expect(state.select).toHaveBeenCalledWith('Phantom');
    expect(state.connect).toHaveBeenCalledTimes(1);
  });

  it('surfaces a rejected connection instead of swallowing it', async () => {
    adapter.useWallet.mockReturnValue(
      walletState({
        connect: vi.fn().mockRejectedValue(new Error('User rejected')),
      }),
    );
    const { result } = renderHook(() => useSolanaWallet());
    await act(async () => {
      await expect(result.current.connect()).rejects.toThrow('User rejected');
    });
  });

  it('lets autoConnect finish when the selection has not propagated yet', async () => {
    adapter.useWallet.mockReturnValue(
      walletState({
        connect: vi.fn().mockRejectedValue(new WalletNotSelectedError()),
      }),
    );
    const { result } = renderHook(() => useSolanaWallet());
    await act(async () => {
      await expect(result.current.connect()).resolves.toBeUndefined();
    });
  });

  it('refuses to connect when no wallet is installed', async () => {
    adapter.useWallet.mockReturnValue(walletState({ wallets: [] }));
    const { result } = renderHook(() => useSolanaWallet());
    await act(async () => {
      await expect(result.current.connect()).rejects.toThrow(
        'No Solana wallet is installed.',
      );
    });
  });

  it('reports the connected address in base58', () => {
    adapter.useWallet.mockReturnValue(
      walletState({
        connected: true,
        publicKey: { toBase58: () => 'So1anaAddr' },
      }),
    );
    const { result } = renderHook(() => useSolanaWallet());
    expect(result.current.address).toBe('So1anaAddr');
    expect(result.current.connected).toBe(true);
  });
});
