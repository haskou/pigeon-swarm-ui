import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { ConversationDraftCipher } from '../../../../../contexts/messages/infrastructure/crypto/ConversationDraftCipher';
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
  const conversationId = 'group:conversation-1';
  const cipher = new ConversationDraftCipher();
  const rooted = (): Session =>
    ({
      deviceSealedRootKey: SymmetricKey.generate(),
      identity: { id: 'identity-1' },
    }) as unknown as Session;

  it('lists only the drafts whose opaque key matches the conversation sealed inside', async () => {
    const session = rooted();
    const draftKey = cipher.draftKey(session, conversationId);
    const openable = {
      draftKey,
      encryptedPayload: cipher.encrypt(session, conversationId, 'draft text'),
      updatedAt: 3,
    };
    const movedToAnotherKey = {
      draftKey: cipher.draftKey(session, 'group:conversation-2'),
      encryptedPayload: cipher.encrypt(session, conversationId, 'moved draft'),
      updatedAt: 2,
    };
    const replacedRoot = {
      draftKey,
      encryptedPayload: cipher.encrypt(rooted(), conversationId, 'old root'),
      updatedAt: 1,
    };
    const request = jest.fn().mockResolvedValue({
      drafts: [openable, movedToAnotherKey, replacedRoot],
    });
    const api = new PigeonConversationDraftsApi(
      httpClient(request),
      signer(jest.fn().mockResolvedValue({})),
      new RequestCache(),
    );

    await expect(api.listConversationDrafts(session)).resolves.toEqual([
      {
        content: 'draft text',
        conversationId,
        encryptedPayload: openable.encryptedPayload,
        updatedAt: 3,
      },
    ]);
    expect(request).toHaveBeenCalledWith(
      '/conversations/me/drafts',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('saves a draft under its opaque key, never under the conversation id', async () => {
    const session = rooted();
    const draftKey = cipher.draftKey(session, conversationId);
    const path = `/conversations/me/drafts/${draftKey}`;
    const request = jest.fn((_path: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as {
        encryptedPayload: string;
        updatedAt: number;
      };

      return Promise.resolve({ draftKey, ...body });
    });
    const headers = jest.fn().mockResolvedValue({});
    const api = new PigeonConversationDraftsApi(
      httpClient(request as unknown as jest.Mock),
      signer(headers),
      new RequestCache(),
    );

    const saved = await api.saveConversationDraft(
      session,
      conversationId,
      'draft text',
      7,
    );
    const [requestPath, init] = request.mock.calls[0];
    const sent = JSON.parse(init.body) as { encryptedPayload: string };

    expect(requestPath).toBe(path);
    expect(init.body).not.toContain(conversationId);
    expect(headers).toHaveBeenCalledWith(session, 'PUT', path, {
      encryptedPayload: sent.encryptedPayload,
      updatedAt: 7,
    });
    expect(cipher.decrypt(session, draftKey, sent.encryptedPayload)).toEqual({
      content: 'draft text',
      conversationId,
    });
    expect(saved).toEqual({
      content: 'draft text',
      conversationId,
      encryptedPayload: sent.encryptedPayload,
      updatedAt: 7,
    });
  });

  it('deletes a draft under its opaque key', async () => {
    const session = rooted();
    const path = `/conversations/me/drafts/${cipher.draftKey(session, conversationId)}`;
    const request = jest.fn().mockResolvedValue({});
    const headers = jest.fn().mockResolvedValue({});
    const api = new PigeonConversationDraftsApi(
      httpClient(request),
      signer(headers),
      new RequestCache(),
    );

    await api.deleteConversationDraft(session, conversationId);

    expect(request).toHaveBeenCalledWith(
      path,
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(headers).toHaveBeenCalledWith(session, 'DELETE', path);
  });
});
