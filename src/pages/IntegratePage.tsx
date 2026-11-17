import type { IAddress, IVault } from '@upshiftfinance/sdk';
import { useEffect, useState } from 'react';
import { CodeBlock, CommandBlock } from '../components/CodeBlock';
import { CopyButton } from '../components/CopyButton';
import { VaultViews } from '../components/VaultViews';
import { chainIdOf } from '../integrate/paths';
import { renderSnippet } from '../integrate/render';
import {
  MANAGERS,
  type Manager,
  SNIPPETS,
  type SnippetFile,
  installCommand,
} from '../integrate/snippets';
import { sdk } from '../integration/starter-sdk';
import { type ChainFamily, familyOf } from '../integration/vaults';
import { type ChainSlug, Link } from '../router';
import { UpshiftVault } from '../snippets/evm/UpshiftVault';
import { UpshiftVault as SolanaWidget } from '../snippets/solana/UpshiftVault';
import { UpshiftVault as StellarWidget } from '../snippets/stellar/UpshiftVault';

const CHAIN_NAMES: Record<ChainSlug, string> = {
  ethereum: 'Ethereum',
  solana: 'Solana',
  stellar: 'Stellar',
};
const SOURCE =
  'https://github.com/upshift-protocol/upshift-starter/blob/main/src/integration';
const WALLET_SETUP: Record<ChainFamily, string> = {
  evm: 'The widget calls wagmi hooks, so render it inside a WagmiProvider and a QueryClientProvider set up for Ethereum mainnet with the injected connector, as this starter does in',
  solana:
    'The widget uses the Solana wallet adapter, so render it inside a ConnectionProvider and a WalletProvider with autoConnect. Set RPC_URL to a keyed endpoint: public ones reject the balance reads. This starter does it in',
  stellar:
    'The widget signs with the Freighter browser extension, which each user installs. This starter connects it in',
};
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'missing' }
  | { status: 'ready'; vault: IVault };

const sameAddress = (a: string, b: string, family: ChainFamily) =>
  family === 'evm' ? a.toLowerCase() === b.toLowerCase() : a === b;

function download(name: string, source: string) {
  const url = URL.createObjectURL(new Blob([source], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function Tabs<T extends string>(props: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <fieldset className="tx-tabs" aria-label={props.label}>
      {props.options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === props.value}
          onClick={() => props.onChange(option)}
        >
          {option}
        </button>
      ))}
    </fieldset>
  );
}

const programIdOf = (vault: IVault) => vault.programId || vault.address;

const templateVault = (vault: IVault, family: ChainFamily) => {
  const base = { chainId: vault.chainId, address: vault.address };
  return family === 'solana'
    ? { ...base, programId: programIdOf(vault) }
    : base;
};

function LiveWidget({ vault, family }: { vault: IVault; family: ChainFamily }) {
  const base = { chainId: vault.chainId, address: vault.address };
  switch (family) {
    case 'evm':
      return <UpshiftVault sdk={sdk} vault={base} />;
    case 'solana':
      return (
        <SolanaWidget
          sdk={sdk}
          vault={{ ...base, programId: programIdOf(vault) }}
        />
      );
    case 'stellar':
      return <StellarWidget sdk={sdk} vault={base} />;
  }
}

function VaultIntegration(props: {
  vault: IVault;
  chain: ChainSlug;
  family: ChainFamily;
  files: SnippetFile[];
}) {
  const { vault, family } = props;
  const [manager, setManager] = useState<Manager>('npm');
  const files = props.files.map((file) => ({
    ...file,
    source:
      file.name === 'upshift-vault.ts'
        ? renderSnippet(file.source, templateVault(vault, family))
        : file.source,
  }));
  const [fileName, setFileName] = useState(files[0]?.name ?? '');
  const file = files.find((f) => f.name === fileName) ?? files[0];
  const command = installCommand(manager, family);
  const asset = vault.depositAssets[0];
  const apy = vault.apy?.apy;
  const stats = [
    ['Chain', CHAIN_NAMES[props.chain]],
    ['Deposit token', asset?.symbol ?? 'n/a'],
    ['APY', typeof apy === 'number' ? `${apy.toFixed(2)}%` : 'n/a'],
    [
      'TVL',
      `${number.format(Number(vault.totalAssets?.normalized ?? 0))} ${asset?.symbol ?? ''}`.trim(),
    ],
  ];
  return (
    <>
      <dl className="vault-stats integrate-stats">
        <div className="vault-stat">
          <dt>Vault address</dt>
          <dd>
            <code>{vault.address}</code>
          </dd>
          <CopyButton text={vault.address} label="Copy address" />
        </div>
        {stats.map(([label, value]) => (
          <div key={label} className="vault-stat">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="integrate-columns">
        <ol className="integrate-steps">
          <li>
            <h2>Install the SDK</h2>
            <Tabs
              label="Package manager"
              options={MANAGERS}
              value={manager}
              onChange={setManager}
            />
            <CommandBlock command={command} />
            <CopyButton text={command} label="Copy command" />
          </li>
          <li>
            <h2>Copy two files</h2>
            <div className="code-editor">
              <div className="code-editor-bar">
                <Tabs
                  label="File"
                  options={files.map((f) => f.name)}
                  value={file?.name ?? ''}
                  onChange={setFileName}
                />
                <div className="code-actions">
                  <CopyButton text={file?.source ?? ''} label="Copy file" />
                  {file ? (
                    <button
                      type="button"
                      onClick={() => download(file.name, file.source)}
                    >
                      Download {file.name}
                    </button>
                  ) : null}
                </div>
              </div>
              {file ? (
                <CodeBlock source={file.source} label={file.name} />
              ) : null}
            </div>
          </li>
          <li>
            <h2>Connect wallets</h2>
            <p>
              {WALLET_SETUP[family]}{' '}
              <a href={`${SOURCE}/${family}/wallet.tsx`}>{family}/wallet.tsx</a>
              .
            </p>
          </li>
          <li>
            <h2>Ship it</h2>
            <p>
              Set <code>appName</code> and <code>RPC_URL</code> in{' '}
              <code>upshift-vault.ts</code>, render{' '}
              <code>{'<UpshiftVault />'}</code>, and make a small deposit with a
              real wallet.
            </p>
          </li>
        </ol>
        <aside className="integrate-preview" aria-labelledby="live-preview">
          <h2 id="live-preview">Try it here</h2>
          <p className="app-banner">
            Mainnet. Real funds. This is the same component, running on this
            starter’s SDK.
          </p>
          <LiveWidget vault={vault} family={family} />
        </aside>
      </div>
    </>
  );
}

export function IntegratePage({
  chain,
  address,
}: {
  chain: ChainSlug;
  address: string;
}) {
  const chainId = chainIdOf(chain);
  const family = familyOf(chainId);
  const [load, setLoad] = useState<Load>({ status: 'loading' });

  useEffect(() => {
    let live = true;
    sdk.getVault({ vault: address as IAddress, chainId }).then(
      (vault) =>
        live &&
        setLoad(
          sameAddress(vault.address, address, family)
            ? { status: 'ready', vault }
            : { status: 'missing' },
        ),
      (error: unknown) =>
        live &&
        setLoad({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        }),
    );
    return () => {
      live = false;
    };
  }, [address, chainId, family]);

  const vault = load.status === 'ready' ? load.vault : null;
  return (
    <>
      <Link to="/vaults" className="link-button">
        ← All vaults
      </Link>
      <h1>Integrate {vault?.name ?? 'vault'}</h1>
      <VaultViews
        vault={{ chainId, address: vault?.address ?? address }}
        current="integrate"
      />
      {load.status === 'loading' ? <p>Loading vault…</p> : null}
      {load.status === 'error' ? <p role="alert">{load.message}</p> : null}
      {load.status === 'missing' ? (
        <p>
          No {CHAIN_NAMES[chain]} vault at <code>{address}</code>.
        </p>
      ) : null}
      {vault ? (
        <VaultIntegration
          vault={vault}
          chain={chain}
          family={family}
          files={SNIPPETS[family]}
        />
      ) : null}
    </>
  );
}
