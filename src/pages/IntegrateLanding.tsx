import { useState } from 'react';
import { integratePath } from '../integrate/paths';
import { FEATURED, PACKAGES } from '../integrate/snippets';
import { type ChainFamily, FAMILY_LABELS } from '../integration/vaults';
import { useReducedMotion } from '../reduced-motion';
import { Link } from '../router';

function TryIt({ family }: { family: ChainFamily }) {
  const path = integratePath(FEATURED[family]);
  return path ? (
    <Link to={path} className="cta cta-primary">
      Try it live
    </Link>
  ) : null;
}

const DOCS = 'https://docs.upshift.finance/sdk';
const SOURCE = 'https://github.com/upshift-protocol/upshift-starter';

const STEPS = [
  ['Pick a vault', 'Find it on the Vaults page, then open its Integrate tab.'],
  [
    'Match your wallet library',
    'Each chain uses its standard wallet library. The chain cards below list them.',
  ],
  ['Install the SDK', 'One command, for npm, pnpm, yarn or bun.'],
  [
    'Copy two files',
    'upshift-vault.ts and UpshiftVault.tsx. Point RPC_URL at your own node.',
  ],
  [
    'Ship it',
    'Render <UpshiftVault /> and make a small deposit with a real wallet.',
  ],
] as const;

const WALLETS: Record<ChainFamily, string> = {
  evm: 'wagmi + viem with an injected wallet, on Ethereum mainnet.',
  solana: 'Solana wallet adapter with Phantom, Solflare or Coinbase.',
  stellar: 'The Freighter browser extension.',
};

function StepMedia({ n, title }: { n: number; title: string }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>(
    'loading',
  );
  const still = useReducedMotion();
  const label = `Step ${n}: ${title}`;
  // The placeholder holds the frame until the first video frame is ready, so
  // a slow or stalled clip never shows an empty box.
  const placeholder =
    status === 'ready' ? null : (
      <div
        className="landing-placeholder"
        role="img"
        aria-label={label}
        aria-busy={status === 'loading'}
      >
        <span>{n}</span>
        {title}
      </div>
    );
  if (status === 'failed') return placeholder;
  return (
    <>
      {placeholder}
      <video
        src={`/media/step-${n}.mp4`}
        aria-label={label}
        hidden={status !== 'ready'}
        preload="auto"
        muted
        loop={!still}
        playsInline
        autoPlay={!still}
        controls={still}
        onLoadedData={() => setStatus('ready')}
        onError={() => setStatus('failed')}
      />
    </>
  );
}

export function IntegrateLanding() {
  const [active, setActive] = useState(0);
  const [title] = STEPS[active] ?? STEPS[0];
  const last = active === STEPS.length - 1;
  const move = (by: number) => () => setActive(active + by);
  return (
    <>
      <section className="landing-hero">
        <h1>Ship Upshift vaults in your app</h1>
        <p>
          Choose a vault on EVM, Solana or Stellar. Its page gives you a typed
          SDK module and a React component, set to that vault. The component is
          the same code that runs the page’s live preview.
        </p>
        <div className="landing-ctas">
          <Link to="/vaults" className="cta cta-primary">
            Browse vaults
          </Link>
          <a className="cta" href={`${DOCS}/quick-start`}>
            SDK docs
          </a>
          <a className="cta" href={SOURCE}>
            Source on GitHub
          </a>
        </div>
      </section>
      <section className="landing-guide" aria-labelledby="landing-guide">
        <h2 id="landing-guide">From vault to production in five steps</h2>
        <ol>
          {STEPS.map(([step, body], i) => (
            <li key={step}>
              <button
                type="button"
                aria-current={i === active ? 'step' : undefined}
                onClick={() => setActive(i)}
              >
                <span>{i + 1}</span>
                {step}
              </button>
              {i === active ? <p>{body}</p> : null}
            </li>
          ))}
        </ol>
        <div className="landing-media">
          <StepMedia key={active} n={active + 1} title={title} />
          <div className="landing-pager">
            <span aria-live="polite">
              Step {active + 1} of {STEPS.length}
            </span>
            <button type="button" disabled={!active} onClick={move(-1)}>
              Previous
            </button>
            <button type="button" disabled={last} onClick={move(1)}>
              Next
            </button>
          </div>
        </div>
      </section>
      <section className="landing-chains" aria-labelledby="landing-chains">
        <h2 id="landing-chains">Three chains, one SDK</h2>
        <ul>
          {(Object.keys(WALLETS) as ChainFamily[]).map((family) => (
            <li key={family} className={`chain-card chain-${family}`}>
              <h3>{FAMILY_LABELS[family]}</h3>
              <p>{WALLETS[family]}</p>
              <code>{PACKAGES[family].join(' ')}</code>
              <a href={`${DOCS}/${family}-actions`}>
                {FAMILY_LABELS[family]} docs
              </a>
              <TryIt family={family} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
