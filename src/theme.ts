export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'upshift-starter:theme';
const CHOOSE_EVENT = 'starter:theme';

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export function chooseTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {}
  window.dispatchEvent(new CustomEvent<Theme>(CHOOSE_EVENT, { detail: theme }));
}

export function followColorScheme(root: HTMLElement, query: MediaQueryList) {
  let chosen = storedTheme();
  const apply = () => {
    root.dataset.theme = chosen ?? (query.matches ? 'dark' : 'light');
  };
  const choose = (event: Event) => {
    chosen = (event as CustomEvent<Theme>).detail;
    apply();
  };
  apply();
  query.addEventListener('change', apply);
  window.addEventListener(CHOOSE_EVENT, choose);
  return () => {
    query.removeEventListener('change', apply);
    window.removeEventListener(CHOOSE_EVENT, choose);
  };
}
