import type { CallPeerConnections } from '../../../../../contexts/calls/infrastructure/media/CallPeerConnections';
import type { SealedCallSignal } from '../../../../../contexts/calls/infrastructure/signals/SealedCallSignal';

import { CallSignalRefusedError } from '../../../../../contexts/calls/infrastructure/signals/CallSignalRefusedError';
import { CallSignalDispatcher } from '../../../../../contexts/calls/presentation/hooks/CallSignalDispatcher';

function signal(callId: string, senderIdentityId = 'peer-1'): SealedCallSignal {
  return {
    callId,
    createdAt: 1,
    expiresAt: 20_001,
    networkId: 'network-a',
    recipientIdentityId: 'me',
    scopeType: 'conversation',
    sealedEntries: [],
    senderDeviceCredential: 'device',
    senderIdentityId,
    signalId: `signal-${callId}-${senderIdentityId}`,
    signalType: 'offer',
    signature: 'sig',
  };
}

describe('CallSignalDispatcher', () => {
  const handleSignal = jest.fn<Promise<void>, [string, ...unknown[]]>();
  const sendSignal = jest.fn().mockResolvedValue(undefined);
  let activeCallId: string | undefined;
  const open = jest.fn();
  const onRefused = jest.fn();
  let dispatcher: CallSignalDispatcher;

  beforeEach(() => {
    handleSignal.mockReset();
    handleSignal.mockResolvedValue(undefined);
    open.mockReset();
    open.mockResolvedValue({ sdp: 'v=0' });
    onRefused.mockReset();
    activeCallId = undefined;
    dispatcher = new CallSignalDispatcher(
      { handleSignal } as unknown as CallPeerConnections,
      () => activeCallId,
      open,
      onRefused,
    );
  });

  it('queues signals until the call has finished starting, then flushes them in order', async () => {
    dispatcher.begin('me', sendSignal, 'call-1');
    activeCallId = 'call-1';

    await dispatcher.receive(signal('call-1', 'peer-1'));
    await dispatcher.receive(signal('call-1', 'peer-2'));

    expect(handleSignal).not.toHaveBeenCalled();

    dispatcher.markStarted();
    await dispatcher.flushPending('call-1', sendSignal);

    expect(handleSignal.mock.calls.map(([sender]) => sender)).toEqual([
      'peer-1',
      'peer-2',
    ]);
    expect(handleSignal).toHaveBeenCalledWith(
      'peer-1',
      'offer',
      { sdp: 'v=0' },
      sendSignal,
      'me',
    );

    await dispatcher.flushPending('call-1', sendSignal);

    expect(handleSignal).toHaveBeenCalledTimes(2);
  });

  it('delivers signals immediately once the call is started', async () => {
    dispatcher.begin('me', sendSignal, 'call-1');
    dispatcher.markStarted();
    activeCallId = 'call-1';

    await dispatcher.receive(signal('call-1'));

    expect(handleSignal).toHaveBeenCalledTimes(1);
  });

  it('ignores signals for a different active call', async () => {
    dispatcher.begin('me', sendSignal, 'call-1');
    dispatcher.markStarted();
    activeCallId = 'call-1';

    await dispatcher.receive(signal('call-2'));
    await dispatcher.flushPending('call-2', sendSignal);

    expect(handleSignal).not.toHaveBeenCalled();
  });

  it('keeps only the latest 100 queued signals per call', async () => {
    for (let index = 0; index < 105; index += 1) {
      await dispatcher.receive(signal('call-1', `peer-${index}`));
    }

    await dispatcher.flushPending('call-1', sendSignal);

    expect(handleSignal).toHaveBeenCalledTimes(100);
    expect(handleSignal.mock.calls[0][0]).toBe('peer-5');
  });

  it('drops queued signals and identity state on reset', async () => {
    dispatcher.begin('me', sendSignal, 'call-1');
    await dispatcher.receive(signal('call-1'));

    dispatcher.reset();
    await dispatcher.flushPending('call-1', sendSignal);

    expect(handleSignal).not.toHaveBeenCalled();
    expect(dispatcher.currentIdentityId).toBeNull();
    expect(dispatcher.sendSignal).toBeNull();
  });

  it('never opens a signal for a different active call', async () => {
    dispatcher.begin('me', sendSignal, 'call-1');
    dispatcher.markStarted();
    activeCallId = 'call-1';

    await dispatcher.receive(signal('call-2'));

    expect(open).not.toHaveBeenCalled();
  });

  it('reports a refused signal as a failed negotiation and never applies it', async () => {
    dispatcher.begin('me', sendSignal, 'call-1');
    dispatcher.markStarted();
    activeCallId = 'call-1';
    open.mockRejectedValue(new CallSignalRefusedError('sender-unauthorised'));

    await dispatcher.receive(signal('call-1', 'peer-1'));

    expect(handleSignal).not.toHaveBeenCalled();
    expect(onRefused).toHaveBeenCalledWith({
      callId: 'call-1',
      reason: 'sender-unauthorised',
      senderIdentityId: 'peer-1',
    });
  });

  it('applies opened signals in arrival order even when opening settles out of order', async () => {
    dispatcher.begin('me', sendSignal, 'call-1');
    dispatcher.markStarted();
    activeCallId = 'call-1';
    let release: () => void = () => undefined;

    open.mockImplementationOnce(
      async () =>
        await new Promise((resolve) => {
          release = () => resolve({ n: 1 });
        }),
    );
    open.mockResolvedValueOnce({ n: 2 });
    const first = dispatcher.receive(signal('call-1', 'peer-1'));
    const second = dispatcher.receive(signal('call-1', 'peer-2'));

    await new Promise((resolve) => setTimeout(resolve, 0));
    release();
    await Promise.all([first, second]);

    expect(handleSignal.mock.calls.map(([sender]) => sender)).toEqual([
      'peer-1',
      'peer-2',
    ]);
  });

  it('rethrows a failure that is not a refusal', async () => {
    dispatcher.begin('me', sendSignal, 'call-1');
    dispatcher.markStarted();
    activeCallId = 'call-1';
    open.mockRejectedValue(new Error('boom'));

    await expect(dispatcher.receive(signal('call-1'))).rejects.toThrow('boom');
  });
});
