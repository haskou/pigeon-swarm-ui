import { CallPeerRecovery } from '../../../../../contexts/calls/infrastructure/media/CallPeerRecovery';

function peerConnection(
  connectionState: RTCPeerConnectionState,
  iceConnectionState: RTCIceConnectionState,
): RTCPeerConnection {
  return {
    connectionState,
    iceConnectionState,
    restartIce: jest.fn(),
  } as unknown as RTCPeerConnection;
}

describe('CallPeerRecovery', () => {
  afterEach(() => jest.useRealTimers());

  it('restarts ICE immediately after a failed connection', async () => {
    jest.useFakeTimers();
    const recovery = new CallPeerRecovery((peer, canRestart) => {
      if (canRestart()) peer.restartIce();

      return Promise.resolve();
    });
    const peer = peerConnection('failed', 'failed');

    recovery.reconcile('peer-1', peer, () => true);
    await jest.runOnlyPendingTimersAsync();

    expect(peer.restartIce).toHaveBeenCalledTimes(1);
  });

  it('cancels pending recovery when the peer is forgotten', async () => {
    jest.useFakeTimers();
    const recovery = new CallPeerRecovery((peer, canRestart) => {
      if (canRestart()) peer.restartIce();

      return Promise.resolve();
    });
    const peer = peerConnection('disconnected', 'disconnected');

    recovery.reconcile('peer-1', peer, () => true);
    recovery.forget('peer-1');
    await jest.runOnlyPendingTimersAsync();

    expect(peer.restartIce).not.toHaveBeenCalled();
  });

  it('recovers stalled checking without extending the deadline on repeated events', async () => {
    jest.useFakeTimers();
    const recovery = new CallPeerRecovery((peer, canRestart) => {
      if (canRestart()) peer.restartIce();

      return Promise.resolve();
    });
    const peer = peerConnection('connecting', 'checking');

    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(10_000);
    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(4_999);
    expect(peer.restartIce).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(peer.restartIce).toHaveBeenCalledTimes(1);
  });

  it('bounds recovery when checking never changes and ignores later retry events', async () => {
    jest.useFakeTimers();
    const recovery = new CallPeerRecovery((peer, canRestart) => {
      if (canRestart()) peer.restartIce();

      return Promise.resolve();
    });
    const peer = peerConnection('connecting', 'checking');

    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(120_000);
    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(120_000);

    expect(peer.restartIce).toHaveBeenCalledTimes(3);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(['forget', 'reset', 'replaced', 'closed', 'healthy'])(
    'cancels stalled checking recovery when %s',
    async (reason) => {
      jest.useFakeTimers();
      const recovery = new CallPeerRecovery((peer, canRestart) => {
        if (canRestart()) peer.restartIce();

        return Promise.resolve();
      });
      const peer = peerConnection('connecting', 'checking');
      let current = true;
      recovery.reconcile('peer-1', peer, () => current);

      if (reason === 'forget') recovery.forget('peer-1');

      if (reason === 'reset') recovery.reset();

      if (reason === 'replaced') current = false;

      if (reason === 'closed')
        Object.assign(peer, { connectionState: 'closed' });

      if (reason === 'healthy') {
        Object.assign(peer, {
          connectionState: 'connected',
          iceConnectionState: 'completed',
        });
        recovery.reconcile('peer-1', peer, () => current);
      }
      await jest.advanceTimersByTimeAsync(120_000);

      expect(peer.restartIce).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  it('resets the recovery budget after a healthy connection', async () => {
    jest.useFakeTimers();
    const recovery = new CallPeerRecovery((peer, canRestart) => {
      if (canRestart()) peer.restartIce();

      return Promise.resolve();
    });
    const peer = peerConnection('connecting', 'checking');
    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(120_000);
    expect(peer.restartIce).toHaveBeenCalledTimes(3);

    Object.assign(peer, {
      connectionState: 'connected',
      iceConnectionState: 'completed',
    });
    recovery.reconcile('peer-1', peer, () => true);
    Object.assign(peer, {
      connectionState: 'connecting',
      iceConnectionState: 'checking',
    });
    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(15_000);

    expect(peer.restartIce).toHaveBeenCalledTimes(4);
    recovery.reset();
  });

  it('also bounds retries when a failed connection never emits another event', async () => {
    jest.useFakeTimers();
    const recovery = new CallPeerRecovery((peer, canRestart) => {
      if (canRestart()) peer.restartIce();

      return Promise.resolve();
    });
    const peer = peerConnection('failed', 'failed');
    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(120_000);

    expect(peer.restartIce).toHaveBeenCalledTimes(3);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('replaces a checking deadline with immediate recovery when ICE fails', async () => {
    jest.useFakeTimers();
    const recovery = new CallPeerRecovery((peer, canRestart) => {
      if (canRestart()) peer.restartIce();

      return Promise.resolve();
    });
    const peer = peerConnection('connecting', 'checking');
    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(1_000);
    Object.assign(peer, {
      connectionState: 'failed',
      iceConnectionState: 'failed',
    });
    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(0);

    expect(peer.restartIce).toHaveBeenCalledTimes(1);
    recovery.reset();
  });

  it('allows a restart time to negotiate before consuming the next attempt', async () => {
    jest.useFakeTimers();
    const recovery = new CallPeerRecovery((peer, canRestart) => {
      if (canRestart()) peer.restartIce();

      return Promise.resolve();
    });
    const peer = peerConnection('failed', 'failed');
    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(0);
    expect(peer.restartIce).toHaveBeenCalledTimes(1);
    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(14_999);
    expect(peer.restartIce).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(peer.restartIce).toHaveBeenCalledTimes(2);
    recovery.reset();
  });

  it('bounds refreshes that never settle and ignores late completions', async () => {
    jest.useFakeTimers();
    const peer = peerConnection('failed', 'failed');
    const completions: (() => void)[] = [];
    const restart = jest.fn(
      (currentPeer: RTCPeerConnection, canRestart: () => boolean) =>
        new Promise<void>((resolve) => {
          completions.push(() => {
            if (canRestart()) currentPeer.restartIce();
            resolve();
          });
        }),
    );
    const recovery = new CallPeerRecovery(restart);
    recovery.reconcile('peer-1', peer, () => true);
    await jest.advanceTimersByTimeAsync(120_000);

    expect(restart).toHaveBeenCalledTimes(3);
    expect(peer.restartIce).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    completions.forEach((complete) => complete());
    await jest.advanceTimersByTimeAsync(0);
    expect(peer.restartIce).not.toHaveBeenCalled();
  });

  it('does not let a cancelled refresh disturb a replacement peer', async () => {
    jest.useFakeTimers();
    const oldPeer = peerConnection('failed', 'failed');
    const newPeer = peerConnection('failed', 'failed');
    const completions: (() => void)[] = [];
    const restart = jest.fn(
      (peer: RTCPeerConnection, canRestart: () => boolean) =>
        new Promise<void>((resolve) => {
          completions.push(() => {
            if (canRestart()) peer.restartIce();
            resolve();
          });
        }),
    );
    const recovery = new CallPeerRecovery(restart);
    recovery.reconcile('peer-1', oldPeer, () => true);
    await jest.advanceTimersByTimeAsync(0);
    recovery.forget('peer-1');
    recovery.reconcile('peer-1', newPeer, () => true);
    await jest.advanceTimersByTimeAsync(0);
    completions[0]();
    await jest.advanceTimersByTimeAsync(0);
    recovery.reconcile('peer-1', newPeer, () => true);
    await jest.advanceTimersByTimeAsync(0);
    expect(restart).toHaveBeenCalledTimes(2);
    completions[1]();
    await jest.advanceTimersByTimeAsync(0);

    expect(oldPeer.restartIce).not.toHaveBeenCalled();
    expect(newPeer.restartIce).toHaveBeenCalledTimes(1);
    recovery.reset();
    expect(jest.getTimerCount()).toBe(0);
  });
});
