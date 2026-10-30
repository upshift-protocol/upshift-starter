import type { TxPhase } from '../integration/tx-flow';

export function TxStatus({
  phase,
  explorerLink,
}: {
  phase: TxPhase;
  explorerLink: (hash: string) => string;
}) {
  switch (phase.status) {
    case 'idle':
      return null;
    case 'submitting':
      return <p className="tx-status tx-busy">Confirm in your wallet…</p>;
    case 'rejected':
      return <p className="tx-status">Signature declined. Nothing was sent.</p>;
    case 'success':
      return (
        <p className="tx-status tx-success">
          Submitted.{' '}
          <a href={explorerLink(phase.hash)} target="_blank" rel="noreferrer">
            View on explorer
          </a>
        </p>
      );
    case 'unknown':
      return (
        <p className="tx-status" role="status">
          {phase.message}
        </p>
      );
    case 'error':
      return (
        <p className="tx-status tx-error" role="alert">
          {phase.message}
        </p>
      );
  }
}
