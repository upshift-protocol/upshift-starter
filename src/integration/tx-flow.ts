import { useState } from 'react';

export type TxPhase =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; hash: string }
  | { status: 'rejected' }
  | { status: 'error'; message: string }
  | { status: 'unknown'; message: string };

export interface ClassifiedError {
  kind: 'rejected' | 'unknown' | 'error';
  message: string;
}

const REJECTION =
  /user (rejected|denied|declined|cancell?ed)|rejected the request|request rejected/i;

export function classifyError(error: unknown): ClassifiedError {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  if (
    name === 'WalletSignTransactionError' ||
    name === 'WalletSendTransactionError' ||
    name === 'UserRejectedRequestError' ||
    REJECTION.test(message)
  ) {
    return { kind: 'rejected', message };
  }
  if (name === 'AugustTimeoutError') {
    return {
      kind: 'unknown',
      message:
        'The network did not confirm in time. Check the explorer before retrying.',
    };
  }
  return { kind: 'error', message };
}

export function useTxFlow() {
  const [phase, setPhase] = useState<TxPhase>({ status: 'idle' });
  const run = async (action: () => Promise<string | null>) => {
    setPhase({ status: 'submitting' });
    try {
      const hash = await action();
      setPhase(
        hash === null ? { status: 'idle' } : { status: 'success', hash },
      );
      return hash;
    } catch (caught) {
      const { kind, message } = classifyError(caught);
      setPhase(
        kind === 'rejected'
          ? { status: 'rejected' }
          : { status: kind, message },
      );
      return null;
    }
  };
  return { phase, run, reset: () => setPhase({ status: 'idle' }) };
}
