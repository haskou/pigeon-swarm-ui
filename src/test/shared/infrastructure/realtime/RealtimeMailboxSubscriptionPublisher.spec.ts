import { RealtimeMailboxSubscriptionPublisher } from '../../../../shared/infrastructure/realtime/RealtimeMailboxSubscriptionPublisher';

describe(RealtimeMailboxSubscriptionPublisher.name, () => {
  it('sends the mailbox and read token through an open socket', () => {
    const socket = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
    } as unknown as WebSocket;

    new RealtimeMailboxSubscriptionPublisher().send(socket, {
      mailboxId: 'mailbox-1',
      readToken: 'token-1',
    });

    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({
        mailboxId: 'mailbox-1',
        readToken: 'token-1',
        type: 'mailbox_subscribe',
      }),
    );
  });

  it('sends nothing through a socket that is not open', () => {
    const socket = {
      readyState: WebSocket.CLOSED,
      send: jest.fn(),
    } as unknown as WebSocket;

    new RealtimeMailboxSubscriptionPublisher().send(socket, {
      mailboxId: 'mailbox-1',
      readToken: 'token-1',
    });

    expect(socket.send).not.toHaveBeenCalled();
  });
});
