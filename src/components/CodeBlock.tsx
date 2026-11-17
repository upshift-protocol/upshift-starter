import { parse } from 'sugar-high/core';
import { tokenize } from 'sugar-high/lang/typescript';

interface Line {
  start: number;
  tokens: Array<{ start: number; type: string; value: string }>;
}

function toLines(source: string): Line[] {
  let offset = 0;
  return parse(source.replace(/\n$/, ''), { tokenize }).lines.map((line) => {
    const start = offset;
    const tokens = line.tokens.map((token) => {
      const at = offset;
      offset += token.value.length;
      return { start: at, type: token.type, value: token.value };
    });
    offset += 1;
    return { start, tokens };
  });
}

export function CodeBlock({
  source,
  label,
}: {
  source: string;
  label: string;
}) {
  return (
    <figure className="code-figure" aria-label={label}>
      <pre className="code-block code-lines">
        <code>
          {toLines(source).map((line) => (
            <span key={line.start} className="code-line">
              {line.tokens.map((token) => (
                <span key={token.start} className={`code-${token.type}`}>
                  {token.value}
                </span>
              ))}
              {'\n'}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}

export function CommandBlock({ command }: { command: string }) {
  const [tool, verb, ...packages] = command.split(' ');
  return (
    <figure className="code-figure" aria-label="Install command">
      <pre className="code-block code-terminal">
        <code>
          <span className="code-keyword">{`${tool} ${verb}`}</span>{' '}
          <span className="code-string">{packages.join(' ')}</span>
        </code>
      </pre>
    </figure>
  );
}
