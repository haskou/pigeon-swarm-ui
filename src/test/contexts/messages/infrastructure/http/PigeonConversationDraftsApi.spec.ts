import { ConversationDraft, SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { sessionRootKey } from '../../../../../contexts/identities/infrastructure/session/sessionRootKey';
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
  const rootOf = sessionRootKey;
  const rooted = (): Session =>
    ({
      deviceSealedRootKey: SymmetricKey.generate(),
      identity: { id: 'identity-1' },
    }) as unknown as Session;
  const draftKey = (session: Session, conversation: string): string =>
    ConversationDraft.draftKey(rootOf(session), conversation);
  const seal = (session: Session, conversation: string, content: string) =>
    ConversationDraft.seal(rootOf(session), conversation, content);

  it('lists only the drafts whose opaque key matches the conversation sealed inside', async () => {
    const session = rooted();
    const key = draftKey(session, conversationId);
    const openable = {
      draftKey: key,
      encryptedPayload: seal(session, conversationId, 'draft text'),
      updatedAt: 3,
    };
    const movedToAnotherKey = {
      draftKey: draftKey(session, 'group:conversation-2'),
      encryptedPayload: seal(session, conversationId, 'moved draft'),
      updatedAt: 2,
    };
    const replacedRoot = {
      draftKey: key,
      encryptedPayload: seal(rooted(), conversationId, 'old root'),
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
      '/conversation-drafts?limit=100',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('saves a draft under its opaque key and keeps what it sent, not what the node echoes', async () => {
    const session = rooted();
    const key = draftKey(session, conversationId);
    const path = `/conversation-drafts/${key}`;
    const request = jest.fn().mockResolvedValue({
      draftKey: key,
      encryptedPayload: 'node-substituted-payload',
      updatedAt: 99,
    });
    const headers = jest.fn().mockResolvedValue({});
    const api = new PigeonConversationDraftsApi(
      httpClient(request),
      signer(headers),
      new RequestCache(),
    );

    const saved = await api.saveConversationDraft(
      session,
      conversationId,
      'draft text',
      7,
    );
    const [requestPath, init] = request.mock.calls[0] as [
      string,
      { body: string },
    ];
    const sent = JSON.parse(init.body) as { encryptedPayload: string };

    expect(requestPath).toBe(path);
    expect(init.body).not.toContain(conversationId);
    expect(headers).toHaveBeenCalledWith(session, 'PUT', path, {
      encryptedPayload: sent.encryptedPayload,
      updatedAt: 7,
    });
    expect(
      ConversationDraft.open(rootOf(session), key, sent.encryptedPayload),
    ).toEqual({
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
    const path = `/conversation-drafts/${draftKey(session, conversationId)}`;
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
