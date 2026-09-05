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

  it('restarts ICE immediately after a failed connection', () => {
    jest.useFakeTimers();
    const recovery = new CallPeerRecovery();
    const peer = peerConnection('failed', 'failed');

    recovery.reconcile('peer-1', peer, () => true);
    jest.runOnlyPendingTimers();

    expect(peer.restartIce).toHaveBeenCalledTimes(1);
  });

  it('cancels pending recovery when the peer is forgotten', () => {
    jest.useFakeTimers();
    const recovery = new CallPeerRecovery();
    const peer = peerConnection('disconnected', 'disconnected');

    recovery.reconcile('peer-1', peer, () => true);
    recovery.forget('peer-1');
    jest.runOnlyPendingTimers();

    expect(peer.restartIce).not.toHaveBeenCalled();
  });

  it('recovers stalled checking without extending the deadline on repeated events', () => {
    jest.useFakeTimers();
    const recovery = new CallPeerRecovery();
    const peer = peerConnection('connecting', 'checking');

    recovery.reconcile('peer-1', peer, () => true);
    jest.advanceTimersByTime(10_000);
    recovery.reconcile('peer-1', peer, () => true);
    jest.advanceTimersByTime(4_999);
    expect(peer.restartIce).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(peer.restartIce).toHaveBeenCalledTimes(1);
  });

  it('bounds recovery when checking never changes and ignores later retry events', () => {
    jest.useFakeTimers();
    const recovery = new CallPeerRecovery();
    const peer = peerConnection('connecting', 'checking');

    recovery.reconcile('peer-1', peer, () => true);
    jest.advanceTimersByTime(120_000);
    recovery.reconcile('peer-1', peer, () => true);
    jest.advanceTimersByTime(120_000);

    expect(peer.restartIce).toHaveBeenCalledTimes(3);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(['forget', 'reset', 'replaced', 'closed', 'healthy'])(
    'cancels stalled checking recovery when %s',
    (reason) => {
      jest.useFakeTimers();
      const recovery = new CallPeerRecovery();
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
      jest.advanceTimersByTime(120_000);

      expect(peer.restartIce).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  it('resets the recovery budget after a healthy connection', () => {
    jest.useFakeTimers();
    const recovery = new CallPeerRecovery();
    const peer = peerConnection('connecting', 'checking');
    recovery.reconcile('peer-1', peer, () => true);
    jest.advanceTimersByTime(120_000);
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
    jest.advanceTimersByTime(15_000);

    expect(peer.restartIce).toHaveBeenCalledTimes(4);
    recovery.reset();
  });

  it('also bounds retries when a failed connection never emits another event', () => {
    jest.useFakeTimers();
    const recovery = new CallPeerRecovery();
    const peer = peerConnection('failed', 'failed');
    recovery.reconcile('peer-1', peer, () => true);
    jest.advanceTimersByTime(120_000);

    expect(peer.restartIce).toHaveBeenCalledTimes(3);
    expect(jest.getTimerCount()).toBe(0);
  });
});
