import type { IVault } from '@upshiftfinance/sdk';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { sdk } from '../integration/starter-sdk';
import { UpshiftVault } from '../snippets/evm/UpshiftVault';
import { UpshiftVault as SolanaWidget } from '../snippets/solana/UpshiftVault';
import { UpshiftVault as StellarWidget } from '../snippets/stellar/UpshiftVault';
import { IntegratePage } from './IntegratePage';

vi.mock('../integration/starter-sdk', () => ({ sdk: { getVault: vi.fn() } }));
vi.mock('../snippets/evm/UpshiftVault', () => ({
  UpshiftVault: vi.fn(() => <p>Live widget</p>),
}));
vi.mock('../snippets/solana/UpshiftVault', () => ({
  UpshiftVault: vi.fn(() => <p>Live Solana widget</p>),
}));
vi.mock('../snippets/stellar/UpshiftVault', () => ({
  UpshiftVault: vi.fn(() => <p>Live Stellar widget</p>),
}));

const STELLAR = {
  name: 'Earn USDC',
  address: 'CCL3WITWFFXIHV2I52ECV5DPIEOFSTU3PBPR53ILPLF2IP5KHECXRUTY',
  chainId: -3,
  apy: { apy: 4 },
  totalAssets: { normalized: '50000' },
  depositAssets: [{ symbol: 'USDC', address: 'CUSDC', decimals: 7 }],
  receipt: { symbol: 'earnUSDC', address: 'CEARN', decimals: 13 },
} as unknown as IVault;

const SOLANA = {
  name: 'Jito SOL',
  address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  programId: 'up12bytoZBmwofqsySf2uqKQ7zpfeKiAWwfvqzJjtRt',
  chainId: -1,
  apy: { apy: 6 },
  totalAssets: { normalized: '207' },
  depositAssets: [{ symbol: 'JitoSOL', address: 'J1to', decimals: 9 }],
  receipt: { symbol: 'sJitoSOL', address: 'sJito', decimals: 9 },
} as unknown as IVault;

const ADDRESS = '0x00000000000000000000000000000000000000C1';
const vault = {
  name: 'Route USDC',
  address: ADDRESS,
  chainId: 1,
  apy: { apy: 5 },
  totalAssets: { normalized: '2000000' },
  depositAssets: [{ symbol: 'USDC', address: '0xa1', decimals: 6 }],
  receipt: { symbol: 'upUSDC', address: '0xb1', decimals: 18 },
} as unknown as IVault;
const getVault = vi.mocked(sdk.getVault);
const codeOf = (label: string) =>
  screen.getByLabelText(label).textContent ?? '';
const writeText = vi.fn(async () => {});

const readBlob = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });

async function renderReady(address = ADDRESS) {
  render(<IntegratePage chain="ethereum" address={address} />);
  await screen.findByRole('heading', {
    level: 1,
    name: 'Integrate Route USDC',
  });
}

describe('IntegratePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getVault.mockResolvedValue(vault);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
  });

  it('switches back to the vault overview, with Integrate marked current', async () => {
    await renderReady(ADDRESS.toLowerCase());
    expect(screen.getByRole('link', { name: 'Integrate' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'href',
      `/vaults/ethereum/${ADDRESS}`,
    );
  });

  it('shows the generated file as numbered, highlighted code', async () => {
    await renderReady();
    const code = screen.getByLabelText('upshift-vault.ts');
    expect(code.querySelectorAll('.code-line').length).toBe(
      codeOf('upshift-vault.ts').split('\n').length - 1,
    );
    expect(code.querySelector('.code-keyword')).toHaveTextContent('import');
  });

  it('loads the route vault through the starter SDK and shows its stats', async () => {
    render(<IntegratePage chain="ethereum" address={ADDRESS} />);
    expect(screen.getByText('Loading vault…')).toBeInTheDocument();
    await screen.findByRole('heading', {
      level: 1,
      name: 'Integrate Route USDC',
    });
    expect(getVault).toHaveBeenCalledWith({
      vault: ADDRESS,
      chainId: 1,
      options: { loans: false, allocations: false },
    });
    for (const text of [
      'Ethereum',
      'USDC',
      '5.00%',
      '2,000,000 USDC',
      ADDRESS,
    ]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole('link', { name: '← All vaults' })).toHaveAttribute(
      'href',
      '/vaults',
    );
  });

  it('matches an EVM address whatever its case', async () => {
    await renderReady(ADDRESS.toLowerCase());
    expect(getVault).toHaveBeenCalledWith({
      vault: ADDRESS.toLowerCase(),
      chainId: 1,
      options: { loans: false, allocations: false },
    });
  });

  it('says not found when the SDK answers with another vault', async () => {
    render(
      <IntegratePage
        chain="ethereum"
        address="0x0000000000000000000000000000000000000001"
      />,
    );
    expect(await screen.findByText(/No Ethereum vault at/)).toBeInTheDocument();
  });

  it('shows why the vault failed to load', async () => {
    getVault.mockRejectedValueOnce(new Error('backend 500'));
    render(<IntegratePage chain="ethereum" address={ADDRESS} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('backend 500');
  });

  it('fills in the contract and runs the Stellar widget for a Stellar vault', async () => {
    getVault.mockResolvedValue(STELLAR);
    render(<IntegratePage chain="stellar" address={STELLAR.address} />);
    await screen.findByRole('heading', {
      level: 1,
      name: 'Integrate Earn USDC',
    });
    expect(getVault).toHaveBeenCalledWith({
      vault: STELLAR.address,
      chainId: -3,
      options: { loans: false, allocations: false },
    });
    expect(codeOf('upshift-vault.ts')).toContain(
      `address: '${STELLAR.address}'`,
    );
    expect(codeOf('Install command')).toBe(
      'npm install @upshiftfinance/sdk @stellar/freighter-api',
    );
    expect(vi.mocked(StellarWidget).mock.lastCall?.[0]).toEqual({
      sdk,
      vault: { chainId: -3, address: STELLAR.address },
    });
    expect(UpshiftVault).not.toHaveBeenCalled();
    expect(SolanaWidget).not.toHaveBeenCalled();
  });

  it('fills in the program id and runs the Solana widget for a Solana vault', async () => {
    getVault.mockResolvedValue(SOLANA);
    render(<IntegratePage chain="solana" address={SOLANA.address} />);
    await screen.findByRole('heading', {
      level: 1,
      name: 'Integrate Jito SOL',
    });
    expect(codeOf('upshift-vault.ts')).toContain(
      `programId: '${SOLANA.programId}'`,
    );
    expect(codeOf('Install command')).toBe(
      'npm install @upshiftfinance/sdk @solana/web3.js @solana/wallet-adapter-react',
    );
    expect(screen.getByText('Live Solana widget')).toBeInTheDocument();
    expect(vi.mocked(SolanaWidget).mock.lastCall?.[0]).toEqual({
      sdk,
      vault: {
        chainId: -1,
        address: SOLANA.address,
        programId: SOLANA.programId,
      },
    });
    expect(UpshiftVault).not.toHaveBeenCalled();
  });

  it('does not match a Solana address in another case', async () => {
    getVault.mockResolvedValue(SOLANA);
    render(
      <IntegratePage chain="solana" address={SOLANA.address.toLowerCase()} />,
    );
    expect(await screen.findByText(/No Solana vault at/)).toBeInTheDocument();
  });

  it('switches the install command per package manager and copies it', async () => {
    await renderReady();
    expect(codeOf('Install command')).toBe(
      'npm install @upshiftfinance/sdk wagmi viem @tanstack/react-query',
    );
    fireEvent.click(screen.getByRole('button', { name: 'pnpm' }));
    const pnpm =
      'pnpm add @upshiftfinance/sdk wagmi viem @tanstack/react-query';
    expect(codeOf('Install command')).toBe(pnpm);
    expect(screen.getByRole('button', { name: 'pnpm' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy command' }));
    });
    expect(writeText).toHaveBeenCalledWith(pnpm);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('tells the user to select the text when copying fails', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    await renderReady();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy file' }));
    });
    expect(
      screen.getByRole('button', { name: 'Copy failed, select the text' }),
    ).toBeInTheDocument();
  });

  it('shows the generated files with the route vault filled in', async () => {
    await renderReady(ADDRESS.toLowerCase());
    expect(codeOf('upshift-vault.ts')).toContain(`address: '${ADDRESS}'`);
    fireEvent.click(screen.getByRole('button', { name: 'UpshiftVault.tsx' }));
    expect(codeOf('UpshiftVault.tsx')).toContain(
      'export function UpshiftVault',
    );
  });

  it('downloads the selected file', async () => {
    const createObjectURL = vi.fn((_: Blob) => 'blob:file');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('upshift-vault.ts');
        expect(this.href).toBe('blob:file');
      });
    await renderReady();
    fireEvent.click(
      screen.getByRole('button', { name: 'Download upshift-vault.ts' }),
    );
    expect(click).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(await readBlob(blob)).toMatch(`address: '${ADDRESS}'`);
  });

  it('renders the live widget with the starter SDK and the route vault', async () => {
    await renderReady(ADDRESS.toLowerCase());
    expect(screen.getByText('Live widget')).toBeInTheDocument();
    expect(vi.mocked(UpshiftVault).mock.lastCall?.[0]).toEqual({
      sdk,
      vault: { chainId: 1, address: ADDRESS },
    });
  });
});
