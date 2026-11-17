const VAULT_BLOCK = /export const VAULT: Vault = \{\n([\s\S]*?)\n\};/g;

export type VaultValues = Record<string, string | number>;

const literal = (value: string | number | undefined) =>
  typeof value === 'number' ? String(value) : `'${value}'`;

export function renderSnippet(source: string, vault: VaultValues): string {
  const blocks = [...source.matchAll(VAULT_BLOCK)];
  const [block] = blocks;
  if (blocks.length !== 1 || !block) {
    throw new Error(`Expected one VAULT block, found ${blocks.length}.`);
  }
  const keys = [...(block[1] ?? '').matchAll(/^ {2}(\w+):/gm)].map(
    (match) => match[1] as string,
  );
  const given = Object.keys(vault);
  if ([...keys].sort().join() !== [...given].sort().join()) {
    throw new Error(
      `VAULT keys ${keys.join(', ')} do not match ${given.join(', ')}.`,
    );
  }
  const body = keys.map((key) => `  ${key}: ${literal(vault[key])},`);
  return source.replace(
    block[0],
    () => `export const VAULT: Vault = {\n${body.join('\n')}\n};`,
  );
}
