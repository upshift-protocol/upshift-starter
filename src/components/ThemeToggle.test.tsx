import { fireEvent, render, screen } from '@testing-library/react';
import { followColorScheme } from '../theme';
import { ThemeToggle } from './ThemeToggle';

function systemPrefers(dark: boolean) {
  return {
    matches: dark,
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as MediaQueryList;
}

describe('ThemeToggle', () => {
  let stop: () => void;

  beforeEach(() => {
    stop = followColorScheme(document.documentElement, systemPrefers(true));
  });

  afterEach(() => {
    stop();
    localStorage.clear();
  });

  it('switches between dark and light and remembers the choice', async () => {
    render(<ThemeToggle />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Switch to light theme' }),
    );
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('upshift-starter:theme')).toBe('light');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Switch to dark theme' }),
    );
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(
      await screen.findByRole('button', { name: 'Switch to light theme' }),
    ).toBeInTheDocument();
  });
});
