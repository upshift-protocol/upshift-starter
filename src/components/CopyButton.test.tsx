import { act, fireEvent, render, screen } from '@testing-library/react';
import { CopyButton } from './CopyButton';

function setClipboard(writeText?: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: writeText ? { writeText } : undefined,
    configurable: true,
  });
}

async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

describe('CopyButton', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('copies the text, says Copied, and resets after 2 s', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(async () => {});
    setClipboard(writeText);
    render(<CopyButton text="npm install x" label="Copy command" />);
    await click('Copy command');
    expect(writeText).toHaveBeenCalledWith('npm install x');
    expect(screen.getByRole('button')).toHaveTextContent('Copied');
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole('button')).toHaveTextContent('Copy command');
  });

  it('asks the user to select the text when the clipboard refuses', async () => {
    setClipboard(vi.fn(async () => Promise.reject(new Error('denied'))));
    render(<CopyButton text="x" label="Copy file" />);
    await click('Copy file');
    expect(screen.getByRole('button')).toHaveTextContent(
      'Copy failed, select the text',
    );
  });

  it('fails the same way without a clipboard API', async () => {
    setClipboard();
    render(<CopyButton text="x" label="Copy file" />);
    await click('Copy file');
    expect(screen.getByRole('button')).toHaveTextContent(
      'Copy failed, select the text',
    );
  });
});
