import { RealtimeCallSignalAcknowledgementPublisher } from './RealtimeCallSignalAcknowledgementPublisher';

describe(RealtimeCallSignalAcknowledgementPublisher.name, () => {
  it('sends only the signal id through an open socket', () => {
    const socket = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
    } as unknown as WebSocket;

    new RealtimeCallSignalAcknowledgementPublisher().send(
      socket,
      'signal-1',
      jest.fn(),
    );

    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({ signalId: 'signal-1', type: 'call_signal_ack' }),
    );
  });
});
