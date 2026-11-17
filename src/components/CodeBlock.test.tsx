import { render, screen } from '@testing-library/react';
import { CodeBlock, CommandBlock } from './CodeBlock';

const SOURCE = `import { useState } from 'react';

// counts clicks
export function Counter() {
  const [count] = useState(0);
  return <button type="button">{count}</button>;
}
`;

describe('CodeBlock', () => {
  it('renders one numbered line per source line and keeps the text exact', () => {
    render(<CodeBlock source={SOURCE} label="Counter.tsx" />);
    const code = screen.getByLabelText('Counter.tsx');
    expect(code.querySelectorAll('.code-line')).toHaveLength(7);
    expect(code.textContent).toBe(SOURCE);
  });

  it('colours keywords, strings, comments, types and JSX tags', () => {
    render(<CodeBlock source={SOURCE} label="Counter.tsx" />);
    const code = screen.getByLabelText('Counter.tsx');
    const texts = (type: string) =>
      [...code.querySelectorAll(`.code-${type}`)].map((el) => el.textContent);
    expect(texts('keyword')).toEqual(
      expect.arrayContaining([
        'import',
        'from',
        'export',
        'function',
        'return',
      ]),
    );
    expect(texts('string').join('')).toContain('react');
    expect(texts('comment').join('')).toContain('counts clicks');
    expect(texts('entity')).toContain('button');
  });

  it('keeps an empty line as an empty numbered line', () => {
    render(<CodeBlock source={'a;\n\nb;'} label="gap.ts" />);
    const lines = screen
      .getByLabelText('gap.ts')
      .querySelectorAll('.code-line');
    expect([...lines].map((line) => line.textContent)).toEqual([
      'a;\n',
      '\n',
      'b;\n',
    ]);
  });
});

describe('CommandBlock', () => {
  it('shows the tool and verb apart from the packages', () => {
    render(<CommandBlock command="pnpm add @upshiftfinance/sdk viem" />);
    const block = screen.getByLabelText('Install command');
    expect(block.textContent).toBe('pnpm add @upshiftfinance/sdk viem');
    expect(block.querySelector('.code-keyword')).toHaveTextContent('pnpm add');
    expect(block.querySelector('.code-string')).toHaveTextContent(
      '@upshiftfinance/sdk viem',
    );
  });
});
