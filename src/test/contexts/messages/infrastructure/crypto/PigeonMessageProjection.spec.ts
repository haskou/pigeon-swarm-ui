import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { mock, type MockProxy } from 'jest-mock-extended';
import { setImmediate as flushImmediate } from 'node:timers/promises';

import type { MessageResource } from '../../../../../shared/domain/pigeonResources.types';

import { createMessageDecryptWorker } from '../../../../../contexts/messages/infrastructure/crypto/createMessageDecryptWorker';
import { MessageProjector } from '../../../../../contexts/messages/infrastructure/crypto/MessageProjector';
import { PigeonMessageProjection } from '../../../../../contexts/messages/infrastructure/crypto/PigeonMessageProjection';
import { sessionFixture } from '../../../conversations/ConversationFixture';

jest.mock(
  '../../../../../contexts/messages/infrastructure/crypto/createMessageDecryptWorker',
  () => ({ createMessageDecryptWorker: jest.fn() }),
);

const projectionCopy = {
  decryptFailed: 'decrypt failed',
  missingKey: 'missing key',
};

describe(PigeonMessageProjection.name, () => {
  it('projects messages in source order and excludes deleted resources', async () => {
    const projection = new PigeonMessageProjection(
      new MessageProjector(projectionCopy),
      projectionCopy,
    );
    const messages: MessageResource[] = [
      ...Array.from({ length: 10 }, (_, index) => ({
        authorIdentityId: 'identity-b',
        content: `message-${index}`,
        createdAt: index,
        id: `message-${index}`,
        type: 'sent' as const,
      })),
      {
        authorIdentityId: 'identity-b',
        createdAt: 11,
        id: 'deleted-message',
        type: 'deleted',
      },
    ];

    const projected = await projection.decryptMany(
      sessionFixture(),
      'conversation-a',
      messages,
    );

    expect(projected.map((message) => message.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `message-${index}`),
    );
  });

  it('projects a single message through the same pipeline', async () => {
    const projection = new PigeonMessageProjection(
      new MessageProjector(projectionCopy),
      projectionCopy,
    );

    const projected = await projection.decrypt(
      sessionFixture(),
      'conversation-a',
      {
        authorIdentityId: 'identity-b',
        content: 'hello',
        createdAt: 1,
        id: 'message-a',
        type: 'sent',
      },
    );

    expect(projected).toMatchObject({ content: 'hello', id: 'message-a' });
  });

  describe('worker lifecycle', () => {
    const originalWorker = Object.getOwnPropertyDescriptor(
      globalThis,
      'Worker',
    );

    beforeEach(() => {
      Object.defineProperty(globalThis, 'Worker', {
        configurable: true,
        value: class WorkerAvailable {},
      });
    });

    afterEach(() => {
      jest.mocked(createMessageDecryptWorker).mockReset();

      if (originalWorker) {
        Object.defineProperty(globalThis, 'Worker', originalWorker);
      } else {
        Reflect.deleteProperty(globalThis, 'Worker');
      }
    });

    function respondingWorker(): MockProxy<Worker> {
      const worker = mock<Worker>();

      worker.postMessage.mockImplementation((request: unknown) => {
        const { requestId } = request as { requestId: number };

        worker.onmessage?.({
          data: { messages: [], requestId, type: 'success' },
        } as MessageEvent);
      });

      return worker;
    }

    const sentMessage = {
      authorIdentityId: 'identity-b',
      content: 'hello',
      createdAt: 1,
      id: 'message-a',
      type: 'sent' as const,
    };

    it('terminates the decrypt worker on dispose and starts a fresh one afterwards', async () => {
      const worker = respondingWorker();

      jest.mocked(createMessageDecryptWorker).mockReturnValue(worker);
      const projection = new PigeonMessageProjection(
        new MessageProjector(projectionCopy),
        projectionCopy,
      );

      await projection.decryptMany(sessionFixture(), 'conversation-a', [
        sentMessage,
      ]);
      projection.dispose();

      expect(worker.terminate).toHaveBeenCalledTimes(1);

      await projection.decryptMany(sessionFixture(), 'conversation-a', [
        sentMessage,
      ]);

      expect(createMessageDecryptWorker).toHaveBeenCalledTimes(2);
    });

    it('rejects decrypts still in flight when disposed', async () => {
      const worker = mock<Worker>();

      jest.mocked(createMessageDecryptWorker).mockReturnValue(worker);
      const projection = new PigeonMessageProjection(
        new MessageProjector(projectionCopy),
        projectionCopy,
      );
      const pending = projection.decryptMany(
        sessionFixture(),
        'conversation-a',
        [sentMessage],
      );
      await flushImmediate();
      projection.dispose();

      await expect(pending).rejects.toThrow(
        'Message decrypt worker was terminated',
      );
    });
  });
});
