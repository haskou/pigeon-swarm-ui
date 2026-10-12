import type { RealtimeMailboxSubscriptionInput } from './RealtimeMailboxSubscriptionInput';

export class RealtimeMailboxSubscriptionPublisher {
  public send(
    socket: WebSocket,
    input: RealtimeMailboxSubscriptionInput,
  ): void {
    if (socket.readyState !== WebSocket.OPEN) return;

    socket.send(
      JSON.stringify({
        mailboxId: input.mailboxId,
        readToken: input.readToken,
        type: 'mailbox_subscribe',
      }),
    );
  }
}
