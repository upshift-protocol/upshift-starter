import { act, fireEvent, render, screen } from '@testing-library/react';
import { Link, matchRoute, navigate, usePathname } from './router';

function Pathname() {
  return <output>{usePathname()}</output>;
}

describe('matchRoute', () => {
  it.each([
    ['/', 'home'],
    ['/vaults', 'vaults'],
    ['/vaults/', 'vaults'],
    ['/vaults//', 'vaults'],
    ['/nope', 'not-found'],
    ['/vaults/ethereum', 'not-found'],
    ['/VAULTS', 'not-found'],
  ])('%s → %s', (pathname, name) => {
    expect(matchRoute(pathname)).toEqual({ name });
  });

  it.each([
    ['ethereum', '0x80E1048eDE66ec4c364b4F22C8768fc657FF6A42', ''],
    ['solana', '2tmMcVv2Ene7wFGebPivhwYhAZyjaJoibMz1GYVaXsB1', '/'],
    ['stellar', 'CCL3WITWFFXIHV2I52ECV5DPIEOFSTU3PBPR53ILPLF2IP5KHECXRUTY', ''],
  ])('matches the %s integrate page and keeps the address case', (chain, address, slash) => {
    expect(matchRoute(`/vaults/${chain}/${address}/integrate${slash}`)).toEqual(
      { name: 'integrate', chain, address },
    );
  });

  it.each([
    ['ethereum', '0x80E1048eDE66ec4c364b4F22C8768fc657FF6A42'],
    ['solana', '2tmMcVv2Ene7wFGebPivhwYhAZyjaJoibMz1GYVaXsB1'],
    ['8453', '0x0000000000000000000000000000000000000Ab1'],
  ])('matches the %s vault overview and keeps the address case', (chain, address) => {
    expect(matchRoute(`/vaults/${chain}/${address}/`)).toEqual({
      name: 'vault',
      chain,
      address,
    });
  });

  it.each([
    '/vaults/base/0xabc/integrate',
    '/vaults/base/0xabc',
    '/vaults/-1/0xabc',
    '/vaults/ethereum//integrate',
    '/vaults/ethereum/0xabc/integrate/more',
  ])('%s → not-found', (pathname) => {
    expect(matchRoute(pathname)).toEqual({ name: 'not-found' });
  });
});

describe('navigation', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  it('pushes a history entry, re-renders subscribers and scrolls to the top', () => {
    render(<Pathname />);
    const length = window.history.length;
    act(() => navigate('/vaults'));
    expect(screen.getByRole('status')).toHaveTextContent('/vaults');
    expect(window.history.length).toBe(length + 1);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('does not stack a duplicate entry for the current location', () => {
    const length = window.history.length;
    navigate('/');
    expect(window.history.length).toBe(length);
  });

  it('treats a change of query or hash as a new location', () => {
    window.history.replaceState(null, '', '/?tab=solana');
    const length = window.history.length;
    navigate('/');
    expect(window.history.length).toBe(length + 1);
    expect(window.location.search).toBe('');
  });

  it('follows the browser back and forward buttons', () => {
    render(<Pathname />);
    act(() => {
      window.history.pushState(null, '', '/vaults');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByRole('status')).toHaveTextContent('/vaults');
  });
});

describe('Link', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  const renderLink = (props: Partial<Parameters<typeof Link>[0]> = {}) =>
    render(
      <>
        <Link to="/vaults" {...props}>
          All vaults
        </Link>
        <Pathname />
      </>,
    );

  const clickLink = (init?: MouseEventInit) => {
    let leftToBrowser = false;
    window.addEventListener(
      'click',
      (event) => {
        leftToBrowser = !event.defaultPrevented;
        event.preventDefault();
      },
      { once: true },
    );
    fireEvent.click(screen.getByRole('link', { name: 'All vaults' }), init);
    return leftToBrowser;
  };

  it('keeps a real href so the link can be copied or opened elsewhere', () => {
    renderLink();
    expect(screen.getByRole('link', { name: 'All vaults' })).toHaveAttribute(
      'href',
      '/vaults',
    );
  });

  it('navigates in place on a plain left click', () => {
    renderLink();
    expect(clickLink()).toBe(false);
    expect(screen.getByRole('status')).toHaveTextContent('/vaults');
  });

  it.each([
    ['meta', { metaKey: true }],
    ['ctrl', { ctrlKey: true }],
    ['shift', { shiftKey: true }],
    ['alt', { altKey: true }],
    ['middle button', { button: 1 }],
  ])('leaves a %s click to the browser', (_, init) => {
    renderLink();
    expect(clickLink(init)).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent(/^\/$/);
  });

  it('leaves a link with a target to the browser', () => {
    renderLink({ target: '_blank' });
    expect(clickLink()).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent(/^\/$/);
  });

  it('navigates in place for target="_self"', () => {
    renderLink({ target: '_self' });
    expect(clickLink()).toBe(false);
    expect(screen.getByRole('status')).toHaveTextContent('/vaults');
  });

  it('leaves a download link to the browser', () => {
    renderLink({ download: true });
    expect(clickLink()).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent(/^\/$/);
  });

  it('runs its own click handler and respects preventDefault from it', () => {
    const onClick = vi.fn((event: { preventDefault: () => void }) =>
      event.preventDefault(),
    );
    renderLink({ onClick });
    expect(clickLink()).toBe(false);
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent(/^\/$/);
  });
});
