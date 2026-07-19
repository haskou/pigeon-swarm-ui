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
});
