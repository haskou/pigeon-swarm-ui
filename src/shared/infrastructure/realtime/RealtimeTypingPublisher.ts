import type { RealtimeTypingInput } from './realtimeGateway';

export class RealtimeTypingPublisher {
  public send(
    socket: WebSocket,
    input: RealtimeTypingInput,
    debug: (event: string, data: unknown) => void,
  ): void {
    if (socket.readyState !== 1) return;

    socket.send(
      JSON.stringify({
        ...input,
        type: 'typing',
      }),
    );
    debug('typing', input);
  }
}
