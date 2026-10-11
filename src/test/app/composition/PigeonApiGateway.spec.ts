import { describe, expect, it, jest } from '@jest/globals';

import { PigeonApiGateway } from '../../../app/composition/PigeonApiGateway';

// The real worker factory uses import.meta, which the real-crypto Jest config
// cannot parse. No decrypt runs in this spec.
jest.mock(
  '../../../contexts/messages/infrastructure/crypto/createMessageDecryptWorker',
  () => ({ createMessageDecryptWorker: jest.fn() }),
);

describe(PigeonApiGateway.name, () => {
  it('composes the context gateways used by the application', () => {
    const gateway = new PigeonApiGateway();

    expect(gateway).toMatchObject({
      calls: expect.any(Object),
      communityGateway: expect.any(Object),
      conversationsGateway: expect.any(Object),
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
});
