import indexHtml from '../index.html?raw';
import { chooseTheme, followColorScheme } from './theme';

afterEach(() => localStorage.clear());

function fakeQuery(matches: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches,
    addEventListener: (_: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) =>
      listeners.delete(listener),
  };
  return {
    query: query as unknown as MediaQueryList,
    flip: (next: boolean) => {
      query.matches = next;
      for (const listener of listeners) listener();
    },
    listeners,
  };
}

describe('followColorScheme', () => {
  it('sets data-theme from the system preference', () => {
    const root = document.createElement('html');
    followColorScheme(root, fakeQuery(true).query);
    expect(root.dataset.theme).toBe('dark');
    followColorScheme(root, fakeQuery(false).query);
    expect(root.dataset.theme).toBe('light');
  });

  it('follows the preference when it changes', () => {
    const root = document.createElement('html');
    const { query, flip } = fakeQuery(false);
    followColorScheme(root, query);
    flip(true);
    expect(root.dataset.theme).toBe('dark');
  });

  it('stops following once cleaned up', () => {
    const root = document.createElement('html');
    const { query, flip, listeners } = fakeQuery(false);
    followColorScheme(root, query)();
    expect(listeners.size).toBe(0);
    flip(true);
    expect(root.dataset.theme).toBe('light');
    chooseTheme('dark');
    expect(root.dataset.theme).toBe('light');
  });

  it('applies a chosen theme, keeps it over the system preference and stores it', () => {
    const root = document.createElement('html');
    const { query, flip } = fakeQuery(true);
    const stop = followColorScheme(root, query);
    chooseTheme('light');
    expect(root.dataset.theme).toBe('light');
    flip(false);
    flip(true);
    expect(root.dataset.theme).toBe('light');
    stop();
    followColorScheme(root, fakeQuery(true).query)();
    expect(root.dataset.theme).toBe('light');
  });

  it('sets the stored theme in index.html before the app script loads', () => {
    const head = indexHtml.slice(0, indexHtml.indexOf('<link'));
    expect(head).toContain("localStorage.getItem('upshift-starter:theme')");
    expect(head).toContain("matchMedia('(prefers-color-scheme: dark)')");
  });

  it('ignores a stored value that is not a theme', () => {
    localStorage.setItem('upshift-starter:theme', 'sepia');
    const root = document.createElement('html');
    followColorScheme(root, fakeQuery(true).query)();
    expect(root.dataset.theme).toBe('dark');
  });

  it('still switches when storage is unavailable', () => {
    const blocked = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    const root = document.createElement('html');
    const stop = followColorScheme(root, fakeQuery(false).query);
    expect(root.dataset.theme).toBe('light');
    chooseTheme('dark');
    expect(root.dataset.theme).toBe('dark');
    stop();
    vi.restoreAllMocks();
  });
});
