export function followColorScheme(root: HTMLElement, query: MediaQueryList) {
  const apply = () => {
    root.dataset.theme = query.matches ? 'dark' : 'light';
  };
  apply();
  query.addEventListener('change', apply);
  return () => query.removeEventListener('change', apply);
}
