export class RealtimeCallSignalAcknowledgementPublisher {
  public send(
    socket: WebSocket,
    signalId: string,
    debug: (event: string, data: unknown) => void,
  ): void {
    if (socket.readyState !== WebSocket.OPEN) return;

    socket.send(
      JSON.stringify({
        signalId,
        type: 'call_signal_ack',
      }),
    );
    debug('call-signal-ack', { signalId });
  }
}
