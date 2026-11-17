import { SPECIAL_CHAINS } from '@upshiftfinance/sdk';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Root } from './Root';
import { navigate } from './router';

vi.mock('./App', async () => {
  const { useState } = await import('react');
  return {
    App: ({
      target,
    }: {
      target: { chainId: number; address: string } | null;
    }) => {
      const [marked, setMarked] = useState(false);
      return (
        <>
          <h1>Vaults</h1>
          <p>Vault app</p>
          {target ? (
            <p>{`Vault detail ${target.chainId} ${target.address}`}</p>
          ) : null}
          {marked ? (
            <p>Same App</p>
          ) : (
            <button type="button" onClick={() => setMarked(true)}>
              Mark
            </button>
          )}
        </>
      );
    },
  };
});
vi.mock('./pages/IntegrateLanding', () => ({
  IntegrateLanding: () => <p>Integrate landing</p>,
}));
vi.mock('./pages/IntegratePage', () => ({
  IntegratePage: ({ chain, address }: { chain: string; address: string }) => (
    <p>{`Integrate page ${chain} ${address}`}</p>
  ),
}));
vi.mock('./integration/wallets', () => ({
  useWallets: () => {
    const wallet = { address: null, connected: false, connect: vi.fn() };
    return {
      evm: { ...wallet, family: 'evm' },
      solana: { ...wallet, family: 'solana' },
      stellar: { ...wallet, family: 'stellar' },
    };
  },
}));

const robotsNoindex = () =>
  document.head.querySelector('meta[name="robots"][content="noindex"]');

const currentNav = () =>
  within(screen.getByRole('navigation', { name: 'Main' }))
    .getAllByRole('link')
    .find((link) => link.getAttribute('aria-current') === 'page')?.textContent;

describe('Root', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  it('renders the integrate landing at /', () => {
    window.history.replaceState(null, '', '/');
    render(<Root />);
    expect(screen.getByText('Integrate landing')).toBeInTheDocument();
    expect(currentNav()).toBe('Integrate');
  });

  it.each(['/vaults', '/vaults/'])('renders the vault app at %s', (path) => {
    window.history.replaceState(null, '', path);
    render(<Root />);
    expect(screen.getByText('Vault app')).toBeInTheDocument();
    expect(currentNav()).toBe('Vaults');
  });

  it('renders the integrate page for a vault route, address case kept', () => {
    window.history.replaceState(null, '', '/vaults/ethereum/0xAbC1/integrate');
    render(<Root />);
    expect(
      screen.getByText('Integrate page ethereum 0xAbC1'),
    ).toBeInTheDocument();
    expect(document.title).toBe('Integrate a vault · Upshift SDK Example');
    expect(currentNav()).toBe('Vaults');
  });

  it('switches pages from the shared nav', () => {
    window.history.replaceState(null, '', '/');
    render(<Root />);
    fireEvent.click(screen.getByRole('link', { name: 'Vaults' }));
    expect(screen.getByText('Vault app')).toBeInTheDocument();
    expect(screen.queryByText('Integrate landing')).toBeNull();
  });

  it('shows a not-found page with ways back for an unknown path', () => {
    window.history.replaceState(null, '', '/nowhere');
    render(<Root />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
    expect(screen.getByText('/nowhere')).toBeInTheDocument();
    expect(currentNav()).toBeUndefined();
    const back = screen.getByRole('navigation', { name: 'Ways back' });
    expect(within(back).getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      '/',
    );
    fireEvent.click(within(back).getByRole('link', { name: 'All vaults' }));
    expect(window.location.pathname).toBe('/vaults');
    expect(screen.getByText('Vault app')).toBeInTheDocument();
  });

  it('marks the not-found page noindex and titles it', () => {
    window.history.replaceState(null, '', '/nowhere');
    render(<Root />);
    expect(robotsNoindex()).not.toBeNull();
    expect(document.title).toBe('Page not found · Upshift SDK Example');
    fireEvent.click(screen.getByRole('link', { name: 'All vaults' }));
    expect(robotsNoindex()).toBeNull();
    expect(document.title).toBe('Vaults · Upshift SDK Example');
  });

  it('moves focus to the new page heading after a navigation, not on load', () => {
    window.history.replaceState(null, '', '/nowhere');
    render(<Root />);
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveFocus();
    fireEvent.click(screen.getByRole('link', { name: 'All vaults' }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Vaults' }),
    ).toHaveFocus();
  });

  it('opens a vault overview from its URL, slug or numeric chain id', () => {
    window.history.replaceState(null, '', '/vaults/solana/2tmMcVv2');
    const { unmount } = render(<Root />);
    expect(
      screen.getByText(
        `Vault detail ${SPECIAL_CHAINS.solana.chainId} 2tmMcVv2`,
      ),
    ).toBeInTheDocument();
    expect(currentNav()).toBe('Vaults');
    expect(document.title).toBe('Vault · Upshift SDK Example');
    unmount();
    window.history.replaceState(null, '', '/vaults/8453/0xabc');
    render(<Root />);
    expect(screen.getByText('Vault detail 8453 0xabc')).toBeInTheDocument();
  });

  it('keeps one App between the list and a vault, and returns to the list from the Vaults link', () => {
    window.history.replaceState(null, '', '/vaults');
    render(<Root />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark' }));
    act(() => navigate('/vaults/ethereum/0xabc'));
    expect(screen.getByText('Vault detail 1 0xabc')).toBeInTheDocument();
    expect(screen.getByText('Same App')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Vaults' }));
    expect(screen.queryByText(/Vault detail/)).toBeNull();
    expect(screen.getByText('Same App')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/vaults');
  });
});
