import { fireEvent, render, screen, within } from '@testing-library/react';
import { Layout } from './Layout';

vi.mock('../integration/wallets', () => {
  const wallet = (family: string) => ({
    family,
    address: null,
    connected: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
  return {
    useWallets: () => ({
      evm: wallet('evm'),
      solana: wallet('solana'),
      stellar: wallet('stellar'),
    }),
  };
});

describe('Layout', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    window.history.replaceState(null, '', '/vaults');
  });

  it('wraps the page in the brand, the main nav and the wallet bar', () => {
    render(
      <Layout current="vaults">
        <p>Page body</p>
      </Layout>,
    );
    expect(screen.getByRole('main')).toHaveTextContent('Page body');
    expect(
      screen.getByRole('link', { name: 'Upshift SDK Example' }),
    ).toHaveAttribute('href', '/');
    expect(screen.getAllByRole('button', { name: 'Connect' })).toHaveLength(3);
  });

  it('marks the current page in the nav and navigates without a reload', () => {
    render(
      <Layout current="vaults">
        <p>Page body</p>
      </Layout>,
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const integrate = within(nav).getByRole('link', { name: 'Integrate' });
    const vaults = within(nav).getByRole('link', { name: 'Vaults' });
    expect(vaults).toHaveAttribute('href', '/vaults');
    expect(vaults).toHaveAttribute('aria-current', 'page');
    expect(integrate).toHaveAttribute('href', '/');
    expect(integrate).not.toHaveAttribute('aria-current');
    fireEvent.click(integrate);
    expect(window.location.pathname).toBe('/');
  });

  it('marks no nav item on the not-found page', () => {
    render(
      <Layout current="not-found">
        <p>Page body</p>
      </Layout>,
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(
      within(nav)
        .getAllByRole('link')
        .filter((link) => link.hasAttribute('aria-current')),
    ).toHaveLength(0);
  });
});
