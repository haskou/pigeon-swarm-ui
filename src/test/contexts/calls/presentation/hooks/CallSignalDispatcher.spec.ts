import type { CallPeerConnections } from '../../../../../contexts/calls/infrastructure/media/CallPeerConnections';
import type { ReceivedCallSignal } from '../../../../../contexts/calls/presentation/hooks/CallSignalDispatcher';

import { CallSignalDispatcher } from '../../../../../contexts/calls/presentation/hooks/CallSignalDispatcher';

function signal(
  callId: string,
  senderIdentityId = 'peer-1',
): ReceivedCallSignal {
  return {
    callId,
    payload: { sdp: 'v=0' },
    senderIdentityId,
    signalType: 'offer',
  };
}

describe('CallSignalDispatcher', () => {
  const handleSignal = jest.fn<Promise<void>, [string, ...unknown[]]>();
  const sendSignal = jest.fn().mockResolvedValue(undefined);
  let activeCallId: string | undefined;
  let dispatcher: CallSignalDispatcher;

  beforeEach(() => {
    handleSignal.mockReset();
    handleSignal.mockResolvedValue(undefined);
    activeCallId = undefined;
    dispatcher = new CallSignalDispatcher(
      { handleSignal } as unknown as CallPeerConnections,
      () => activeCallId,
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
});
