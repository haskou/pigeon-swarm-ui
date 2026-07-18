import { MessageDecryptWorkerClient } from '../../../../../contexts/messages/infrastructure/crypto/MessageDecryptWorkerClient';

class WorkerDouble {
  public onerror: ((event: ErrorEvent) => void) | null = null;

  public onmessage: ((event: MessageEvent) => void) | null = null;

  public readonly postMessage = jest.fn();

  public succeed(messages: unknown[]): void {
    this.onmessage?.({
      data: { messages, requestId: 1, type: 'success' },
    } as MessageEvent);
  }
}

describe(MessageDecryptWorkerClient.name, () => {
  it('resolves the matching worker response', async () => {
    const worker = new WorkerDouble();
    const client = new MessageDecryptWorkerClient(worker as unknown as Worker);
    const decrypted = client.decrypt({
      conversationId: 'conversation-a',
      copy: { decryptFailed: 'Failed', missingKey: 'Missing key' },
      currentIdentityId: 'identity-a',
      messages: [],
      privateKey: 'secret',
    });

    worker.succeed([]);

    await expect(decrypted).resolves.toEqual([]);
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conversation-a',
        requestId: 1,
      }),
    );
  });

  it('cancels an in-flight request when aborted', async () => {
    const worker = new WorkerDouble();
    const client = new MessageDecryptWorkerClient(worker as unknown as Worker);
    const controller = new AbortController();
    const decrypted = client.decrypt(
      {
        conversationId: 'conversation-a',
        copy: { decryptFailed: 'Failed', missingKey: 'Missing key' },
        currentIdentityId: 'identity-a',
        messages: [],
        privateKey: 'secret',
      },
      controller.signal,
    );

    controller.abort();

    await expect(decrypted).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.postMessage).toHaveBeenLastCalledWith({
      requestId: 1,
      type: 'cancel',
    });
  });
});
