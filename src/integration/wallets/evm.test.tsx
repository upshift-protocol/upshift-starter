import { act, renderHook, render } from '@testing-library/react';
import { useConfig } from 'wagmi';
import { EvmWalletProvider, useEvmWallet } from './evm';

describe('EvmWalletProvider', () => {
  it('creates the wagmi config once per mount', () => {
    const seen: unknown[] = [];
    function Probe() {
      seen.push(useConfig());
      return null;
    }
    const { rerender } = render(
      <EvmWalletProvider rpcUrl="https://rpc-a.example">
        <Probe />
      </EvmWalletProvider>,
    );
    rerender(
      <EvmWalletProvider rpcUrl="https://rpc-b.example">
        <Probe />
      </EvmWalletProvider>,
    );
    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
  });
});

describe('useEvmWallet', () => {
  it('starts disconnected and rejects connect when no injected wallet exists', async () => {
    const { result } = renderHook(() => useEvmWallet(), {
      wrapper: EvmWalletProvider,
    });
    expect(result.current.connected).toBe(false);
    expect(result.current.address).toBeNull();
    await act(async () => {
      await expect(result.current.connect()).rejects.toThrow();
    });
  });
});
