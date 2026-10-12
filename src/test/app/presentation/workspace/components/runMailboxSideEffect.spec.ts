import { setImmediate as flushMacrotask } from 'timers/promises';

import { runMailboxSideEffect } from '../../../../../app/presentation/workspace/components/runMailboxSideEffect';

describe(runMailboxSideEffect.name, () => {
  const flush = (): Promise<void> => flushMacrotask();

  it('starts the mailbox effect synchronously and logs nothing on success', async () => {
    const debug = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const effect = jest.fn(() => Promise.resolve('delivered'));

    runMailboxSideEffect(effect);

    expect(effect).toHaveBeenCalledTimes(1);
    await flush();
    expect(debug).not.toHaveBeenCalled();
    debug.mockRestore();
  });

  it('contains a synchronous throw and logs one count-only line', () => {
    const debug = jest.spyOn(console, 'debug').mockImplementation(() => {});

    expect(() =>
      runMailboxSideEffect(() => {
        throw new Error('malformed conversation');
      }),
    ).not.toThrow();
    expect(debug).toHaveBeenCalledTimes(1);
    expect(debug).toHaveBeenCalledWith(
      'Direct mailbox side effect failed; legacy path kept.',
    );
    debug.mockRestore();
  });

  it('contains a rejection without an unhandled rejection and logs one count-only line', async () => {
    const debug = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);

    try {
      runMailboxSideEffect(() => Promise.reject(new Error('network down')));
      await flush();

      expect(unhandled).not.toHaveBeenCalled();
      expect(debug).toHaveBeenCalledTimes(1);
      expect(debug).toHaveBeenCalledWith(
        'Direct mailbox side effect failed; legacy path kept.',
      );
    } finally {
      process.off('unhandledRejection', unhandled);
      debug.mockRestore();
    }
  });

  it('passes the resolved outcome to the outcome handler', async () => {
    const outcome = jest.fn();

    runMailboxSideEffect(() => Promise.resolve('failed'), outcome);
    await flush();

    expect(outcome).toHaveBeenCalledTimes(1);
    expect(outcome).toHaveBeenCalledWith('failed');
  });

  it('does not call the outcome handler when the effect rejects', async () => {
    const debug = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const outcome = jest.fn();

    runMailboxSideEffect(
      () => Promise.reject(new Error('network down')),
      outcome,
    );
    await flush();

    expect(outcome).not.toHaveBeenCalled();
    expect(debug).toHaveBeenCalledWith(
      'Direct mailbox side effect failed; legacy path kept.',
    );
    debug.mockRestore();
  });
});
