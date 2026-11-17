import { useEffect, useState } from 'react';

type CopyState = 'idle' | 'copied' | 'failed';

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<CopyState>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [state]);
  const copy = () =>
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(text))
      .then(
        () => setState('copied'),
        () => setState('failed'),
      );
  const shown = {
    idle: label,
    copied: 'Copied',
    failed: 'Copy failed, select the text',
  };
  return (
    <button type="button" onClick={copy}>
      {shown[state]}
    </button>
  );
}
