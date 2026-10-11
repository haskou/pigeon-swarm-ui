import { MailboxCreationWorkerClient } from '../../../../../contexts/mailboxes/infrastructure/crypto/MailboxCreationWorkerClient';

class WorkerDouble {
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public postMessage = jest.fn();
  public terminate = jest.fn();

  public fail(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }

  public respond(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

describe(MailboxCreationWorkerClient.name, () => {
  const setup = () => {
    const worker = new WorkerDouble();
    const client = new MailboxCreationWorkerClient(worker as unknown as Worker);

    return { client, worker };
  };

  it('posts the mining request and resolves with the worker nonce', async () => {
    const { client, worker } = setup();
    const mined = client.mine('mailbox', 'post-hash', 'read-hash', 17);

    expect(worker.postMessage).toHaveBeenCalledWith({
      id: 0,
      mailboxId: 'mailbox',
      postTokenHash: 'post-hash',
      readTokenHash: 'read-hash',
      difficultyBits: 17,
    });

    worker.respond({ creationNonce: '42', id: 0 });

    await expect(mined).resolves.toBe('42');
  });

  it('matches responses to requests by id', async () => {
    const { client, worker } = setup();
    const first = client.mine('a', 'p', 'r', 16);
    const second = client.mine('b', 'p', 'r', 16);

    worker.respond({ creationNonce: 'two', id: 1 });
    worker.respond({ creationNonce: 'one', id: 0 });

    await expect(first).resolves.toBe('one');
    await expect(second).resolves.toBe('two');
  });

  it('rejects pending requests when the worker errors', async () => {
    const { client, worker } = setup();
    const mined = client.mine('mailbox', 'post-hash', 'read-hash', 16);

    worker.fail('boom');

    await expect(mined).rejects.toThrow('boom');
  });

  it('terminates the worker and rejects pending requests on dispose', async () => {
    const { client, worker } = setup();
    const mined = client.mine('mailbox', 'post-hash', 'read-hash', 16);

    client.dispose();

    expect(worker.terminate).toHaveBeenCalledTimes(1);
    await expect(mined).rejects.toThrow('Mailbox creation worker was disposed');
  });
});
