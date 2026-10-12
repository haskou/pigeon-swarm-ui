import { describe, expect, it, jest } from '@jest/globals';
import { mock } from 'jest-mock-extended';

import { PigeonApiGateway } from '../../../app/composition/PigeonApiGateway';
import { AttachmentCipher } from '../../../contexts/attachments/infrastructure/crypto/AttachmentCipher';

// The real worker factories use import.meta, which the real-crypto Jest config
// cannot parse. No decrypt or mining runs in this spec.
jest.mock(
  '../../../contexts/messages/infrastructure/crypto/createMessageDecryptWorker',
  () => ({ createMessageDecryptWorker: jest.fn() }),
);
jest.mock(
  '../../../contexts/mailboxes/infrastructure/crypto/createMailboxWorkerClient',
  () => ({ createMailboxWorkerClient: jest.fn() }),
);

describe(PigeonApiGateway.name, () => {
  it('composes the context gateways used by the application', () => {
    const gateway = new PigeonApiGateway();

    expect(gateway).toMatchObject({
      calls: expect.any(Object),
      communityGateway: expect.any(Object),
      conversationsGateway: expect.any(Object),
      directMessageMailbox: expect.any(Object),
      filesGateway: expect.any(Object),
      identityGateway: expect.any(Object),
      identityVault: expect.any(Object),
      messageCommands: expect.any(Object),
      messagesApi: expect.any(Object),
      messagesGateway: expect.any(Object),
      node: expect.any(Object),
      notificationsGateway: expect.any(Object),
      pollsApi: expect.any(Object),
      presence: expect.any(Object),
      pushApi: expect.any(Object),
      pushGateway: expect.any(Object),
      stickersApi: expect.any(Object),
    });
  });

  it('builds public asset URLs from the configured API root', () => {
    expect(new PigeonApiGateway().apiUrl('/ipfs/cid')).toMatch(/\/ipfs\/cid$/);
  });

  it('terminates the attachment cipher worker with the session workers', () => {
    const attachmentCipher = mock<AttachmentCipher>();
    const gateway = new PigeonApiGateway(
      undefined,
      undefined,
      undefined,
      undefined,
      {
        attachmentCipher,
      },
    );

    gateway.disposeSessionWorkers();

    expect(attachmentCipher.dispose).toHaveBeenCalledTimes(1);
  });

  it('reads attachment upload storage only from the injected storage', () => {
    const globalStorageRead = jest.fn((): never => {
      throw new Error('localStorage is not available outside the browser');
    });
    const storage = {
      getItem: jest.fn(() => null),
      removeItem: jest.fn(),
      setItem: jest.fn(),
    };

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: globalStorageRead,
    });

    try {
      expect(
        () =>
          new PigeonApiGateway(undefined, undefined, undefined, undefined, {
            storage,
          }),
      ).not.toThrow();
    } finally {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }

    expect(globalStorageRead).not.toHaveBeenCalled();
  });
});
