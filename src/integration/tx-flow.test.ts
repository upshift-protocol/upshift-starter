import { act, renderHook } from '@testing-library/react';
import { classifyError, useTxFlow } from './tx-flow';

function named(name: string, message = name) {
  const error = new Error(message);
  error.name = name;
  return error;
}

describe('classifyError', () => {
  it('treats wallet rejections as rejected, not failed', () => {
    expect(classifyError(named('WalletSignTransactionError')).kind).toBe(
      'rejected',
    );
    expect(classifyError(new Error('User rejected the request.')).kind).toBe(
      'rejected',
    );
    expect(classifyError(named('UserRejectedRequestError')).kind).toBe(
      'rejected',
    );
  });

  it('matches wallet rejection wording across wallets', () => {
    for (const message of [
      'User declined access',
      'User denied transaction signature',
      'Request rejected',
    ]) {
      expect(classifyError(new Error(message)).kind).toBe('rejected');
    }
  });

  it('does not call a failed transaction rejected because it mentions cancelled', () => {
    expect(
      classifyError(new Error('Order was cancelled by the program')).kind,
    ).toBe('error');
    expect(classifyError(new Error('Transfer declined: frozen')).kind).toBe(
      'error',
    );
  });

  it('marks an SDK timeout as unknown outcome', () => {
    expect(classifyError(named('AugustTimeoutError')).kind).toBe('unknown');
  });

  it('keeps everything else an error with its message', () => {
    expect(classifyError(new Error('insufficient funds'))).toEqual({
      kind: 'error',
      message: 'insufficient funds',
    });
  });
});

describe('useTxFlow', () => {
  it('moves idle → submitting → success with the hash', async () => {
    const { result } = renderHook(() => useTxFlow());
    await act(() => result.current.run(async () => 'sig'));
    expect(result.current.phase).toEqual({ status: 'success', hash: 'sig' });
    act(() => result.current.reset());
    expect(result.current.phase).toEqual({ status: 'idle' });
  });

  it('returns to idle when the action had nothing to submit', async () => {
    const { result } = renderHook(() => useTxFlow());
    await act(async () => {
      expect(await result.current.run(async () => null)).toBeNull();
    });
    expect(result.current.phase).toEqual({ status: 'idle' });
  });

  it('lands on rejected for a declined signature', async () => {
    const { result } = renderHook(() => useTxFlow());
    await act(() =>
      result.current.run(async () => {
        throw named('WalletSignTransactionError', 'User rejected');
      }),
    );
    expect(result.current.phase).toEqual({ status: 'rejected' });
  });
});
