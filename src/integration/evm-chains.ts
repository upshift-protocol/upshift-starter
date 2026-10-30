import { mainnet } from 'wagmi/chains';

export const EVM_CHAINS = [mainnet] as const;

export function evmChainOf(chainId: number) {
  return EVM_CHAINS.find((chain) => chain.id === chainId);
}

export function evmExplorerLink(chainId: number, hash: string): string {
  const chain = evmChainOf(chainId);
  if (!chain) throw new Error(`No explorer known for chain ${chainId}.`);
  return `${chain.blockExplorers.default.url}/tx/${hash}`;
}

export function parseAmount(amount: string, decimals: number): bigint | null {
  const match = amount.match(/^(?:(\d+)\.?(\d*)|\.(\d+))$/);
  if (!match) return null;
  const whole = match[1] ?? '0';
  const fraction = match[2] ?? match[3] ?? '';
  if (fraction.length > decimals) return null;
  return BigInt(whole + fraction.padEnd(decimals, '0'));
}
