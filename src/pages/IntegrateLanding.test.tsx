import { act, fireEvent, render, screen } from '@testing-library/react';
import { IntegrateLanding } from './IntegrateLanding';

function preferReducedMotion(reduce: boolean) {
  const listeners = new Set<() => void>();
  const list = {
    matches: reduce,
    addEventListener: (_: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) =>
      listeners.delete(listener),
  };
  window.matchMedia = vi.fn().mockReturnValue(list);
  return (next: boolean) => {
    list.matches = next;
    for (const listener of listeners) listener();
  };
}

const video = () => document.querySelector('video');
const stepButton = (name: RegExp) => screen.getByRole('button', { name });

describe('IntegrateLanding', () => {
  beforeEach(() => {
    preferReducedMotion(false);
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    window.history.replaceState(null, '', '/');
  });

  it('leads with the integrate pitch and its three calls to action', () => {
    render(<IntegrateLanding />);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Integrate Upshift vaults in your app',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'SDK docs' })).toHaveAttribute(
      'href',
      'https://docs.upshift.finance/sdk/quick-start',
    );
    expect(
      screen.getByRole('link', { name: 'Source on GitHub' }),
    ).toHaveAttribute(
      'href',
      'https://github.com/upshift-protocol/upshift-starter',
    );
    fireEvent.click(screen.getByRole('link', { name: 'Browse vaults' }));
    expect(window.location.pathname).toBe('/vaults');
  });

  it('walks the five steps with Previous and Next inside their bounds', () => {
    render(<IntegrateLanding />);
    const previous = screen.getByRole('button', { name: 'Previous' });
    const next = screen.getByRole('button', { name: 'Next' });
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    expect(stepButton(/Pick a vault/)).toHaveAttribute('aria-current', 'step');
    expect(previous).toBeDisabled();

    fireEvent.click(next);
    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
    expect(stepButton(/Match your wallet library/)).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(stepButton(/Pick a vault/)).not.toHaveAttribute('aria-current');

    fireEvent.click(stepButton(/Ship it/));
    expect(screen.getByText('Step 5 of 5')).toBeInTheDocument();
    expect(screen.getByText(/Render <UpshiftVault \/>/)).toBeInTheDocument();
    expect(next).toBeDisabled();

    fireEvent.click(previous);
    expect(screen.getByText('Step 4 of 5')).toBeInTheDocument();
    expect(
      screen.getByText(/Point RPC_URL at your own node/),
    ).toBeInTheDocument();
    expect(next).toBeEnabled();
  });

  it('plays the step clip muted and looped when motion is allowed', () => {
    render(<IntegrateLanding />);
    const clip = video() as HTMLVideoElement;
    expect(clip).toHaveAttribute('src', '/media/step-1.mp4');
    expect(clip).toHaveAttribute('autoplay');
    expect(clip).toHaveAttribute('loop');
    expect(clip).toHaveAttribute('playsinline');
    expect(clip.muted).toBe(true);
    expect(clip).not.toHaveAttribute('controls');
  });

  it('never autoplays under prefers-reduced-motion and offers controls instead', () => {
    preferReducedMotion(true);
    render(<IntegrateLanding />);
    expect(video()).not.toHaveAttribute('autoplay');
    expect(video()).not.toHaveAttribute('loop');
    expect(video()).toHaveAttribute('controls');
  });

  it('holds the placeholder until the first frame loads', () => {
    render(<IntegrateLanding />);
    const placeholder = screen.getByRole('img', {
      name: 'Step 1: Pick a vault',
    });
    expect(placeholder).toHaveAttribute('aria-busy', 'true');
    expect(video()).not.toBeVisible();
    expect(video()).toHaveAttribute('preload', 'auto');

    fireEvent.stalled(video() as HTMLVideoElement);
    expect(placeholder).toBeInTheDocument();

    fireEvent.loadedData(video() as HTMLVideoElement);
    expect(screen.queryByRole('img')).toBeNull();
    expect(video()).toBeVisible();
  });

  it('follows a reduced-motion change without a remount', () => {
    const setReduce = preferReducedMotion(false);
    render(<IntegrateLanding />);
    expect(video()).toHaveAttribute('autoplay');
    act(() => setReduce(true));
    expect(video()).not.toHaveAttribute('autoplay');
    expect(video()).toHaveAttribute('controls');
  });

  it('renders without matchMedia', () => {
    // @ts-expect-error simulate an environment without matchMedia
    window.matchMedia = undefined;
    render(<IntegrateLanding />);
    expect(video()).toHaveAttribute('autoplay');
  });

  it('falls back to a placeholder when the clip is missing, then tries the next step clip', () => {
    render(<IntegrateLanding />);
    fireEvent.error(video() as HTMLVideoElement);
    expect(video()).toBeNull();
    expect(
      screen.getByRole('img', { name: 'Step 1: Pick a vault' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(video()).toHaveAttribute('src', '/media/step-2.mp4');
  });

  it('shows one card per chain with its wallet stack, packages and docs', () => {
    render(<IntegrateLanding />);
    for (const [label, slug, pkg] of [
      ['EVM', 'evm', 'wagmi'],
      ['Solana', 'solana', '@solana/wallet-adapter-react'],
      ['Stellar', 'stellar', '@stellar/freighter-api'],
    ] as const) {
      const card = screen
        .getByRole('heading', { level: 3, name: label })
        .closest('li') as HTMLElement;
      expect(card).toHaveTextContent('@upshiftfinance/sdk');
      expect(card).toHaveTextContent(pkg);
      expect(
        screen.getByRole('link', { name: `${label} docs` }),
      ).toHaveAttribute(
        'href',
        `https://docs.upshift.finance/sdk/${slug}-actions`,
      );
    }
  });

  it('sends each chain card to its featured vault’s live integrate page', () => {
    render(<IntegrateLanding />);
    const tryIt = screen.getAllByRole('link', { name: 'Try it live' });
    expect(tryIt.map((link) => link.getAttribute('href'))).toEqual([
      '/vaults/ethereum/0x80E1048eDE66ec4c364b4F22C8768fc657FF6A42/integrate',
      '/vaults/solana/2tmMcVv2Ene7wFGebPivhwYhAZyjaJoibMz1GYVaXsB1/integrate',
      '/vaults/stellar/CCL3WITWFFXIHV2I52ECV5DPIEOFSTU3PBPR53ILPLF2IP5KHECXRUTY/integrate',
    ]);
    fireEvent.click(tryIt[0] as HTMLElement);
    expect(window.location.pathname).toBe(
      '/vaults/ethereum/0x80E1048eDE66ec4c364b4F22C8768fc657FF6A42/integrate',
    );
  });
});
