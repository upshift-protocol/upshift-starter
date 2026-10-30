import {
  EVM_CHAINS,
  evmChainOf,
  evmExplorerLink,
  parseAmount,
} from './evm-chains';

describe('evmChainOf', () => {
  it('knows the chains the wallet config signs on, and no others', () => {
    expect(EVM_CHAINS.map((chain) => chain.id)).toEqual([1]);
    expect(evmChainOf(1)?.name).toBe('Ethereum');
    expect(evmChainOf(137)).toBeUndefined();
  });
});

describe('evmExplorerLink', () => {
  it('builds the link from the chain explorer', () => {
    expect(evmExplorerLink(1, '0xabc')).toBe('https://etherscan.io/tx/0xabc');
  });

  it('refuses a chain it has no explorer for', () => {
    expect(() => evmExplorerLink(137, '0xabc')).toThrow(/chain 137/);
  });
});

describe('parseAmount', () => {
  it('scales plain decimals to base units without float math', () => {
    expect(parseAmount('1.5', 6)).toBe(1_500_000n);
    expect(parseAmount('.5', 6)).toBe(500_000n);
    expect(parseAmount('5.', 6)).toBe(5_000_000n);
    expect(parseAmount('0.000001', 6)).toBe(1n);
    expect(parseAmount('9007199254740993', 0)).toBe(9007199254740993n);
  });

  it('rejects exponent notation, signs, junk and excess precision', () => {
    for (const bad of ['', '.', '1e-7', '-1', '1,5', 'abc', '1.2.3', ' 1']) {
      expect(parseAmount(bad, 6)).toBeNull();
    }
    expect(parseAmount('0.0000001', 6)).toBeNull();
  });
});
