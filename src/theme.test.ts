import { followColorScheme } from './theme';

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
  });
});
