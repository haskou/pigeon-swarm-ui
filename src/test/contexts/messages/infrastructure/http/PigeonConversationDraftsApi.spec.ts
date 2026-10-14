import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { DraftPayloadCipher } from '../../../../../contexts/messages/infrastructure/crypto/DraftPayloadCipher';
import { PigeonConversationDraftsApi } from '../../../../../contexts/messages/infrastructure/http/PigeonConversationDraftsApi';
import { RequestCache } from '../../../../../shared/infrastructure/http/RequestCache';

function httpClient(request: jest.Mock): HttpJsonClient {
  return {
    request,
    requestBlob: jest.fn(),
  } as unknown as HttpJsonClient;
}

function signer(headers: jest.Mock): RequestSigner {
  return { headers } as unknown as RequestSigner;
}

describe(PigeonConversationDraftsApi.name, () => {
  it('lists the conversation drafts that open under the device sealed root and skips the rest', async () => {
    const rooted = {
      deviceSealedRootKey: SymmetricKey.generate(),
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const cipher = new DraftPayloadCipher();
    const openable = {
      conversationId: 'conversation-1',
      encryptedPayload: cipher.encrypt(rooted, 'draft text'),
      updatedAt: 1,
    };
    const unopenable = {
      conversationId: 'conversation-2',
      encryptedPayload: cipher.encrypt(
        { ...rooted, deviceSealedRootKey: SymmetricKey.generate() },
        'replaced root draft',
      ),
      updatedAt: 2,
    };
    const request = jest
      .fn()
      .mockResolvedValue({ drafts: [unopenable, openable] });
    const api = new PigeonConversationDraftsApi(
      httpClient(request),
      signer(jest.fn().mockResolvedValue({})),
      new RequestCache(),
    );

    await expect(api.listConversationDrafts(rooted)).resolves.toEqual([
      { ...openable, content: 'draft text' },
    ]);
  });
});
