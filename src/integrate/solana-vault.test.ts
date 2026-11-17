// @vitest-environment node
import { PublicKey } from '@solana/web3.js';
import { type VaultSdk, withdraw } from '../snippets/solana/upshift-vault';

const PROGRAM = 'up12bytoZBmwofqsySf2uqKQ7zpfeKiAWwfvqzJjtRt';
const SIGNER = {
  publicKey: new PublicKey('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'),
  signTransaction: vi.fn(),
};

describe('Solana upshift-vault.ts withdraw', () => {
  it('requests through the queue against the derived vault state of a single-vault program', async () => {
    const vaultRequestRedeem = vi.fn(async () => ({
      signature: 'requestSig',
      request: 'req',
      requestId: '1',
    }));
    const sdk = {
      solana: {
        getVaultStateReadOnly: vi.fn(async () => ({
          vaultState: {
            shareMint: PublicKey.default,
            withdrawalQueueAuthority: new PublicKey(
              'Stake11111111111111111111111111111111111111',
            ),
          },
          depositMintDecimals: 9,
        })),
        setWalletProvider: vi.fn(),
        vaultRequestRedeem,
      },
    } as unknown as VaultSdk;
    const single = { chainId: -1, address: PROGRAM, programId: PROGRAM };
    await expect(withdraw(sdk, SIGNER, '2', 6, single)).resolves.toEqual({
      signature: 'requestSig',
      queued: true,
    });
    const [params] = vaultRequestRedeem.mock.calls[0] as unknown as [
      { vault: PublicKey; amount: bigint },
    ];
    expect(params.vault.toBase58()).toBe(
      '3bzNbcgzqwv54oH3njfC8u36RzpMuXsE17tT46fCPJSJ',
    );
    expect(params.amount).toBe(2_000_000n);
  });
});
