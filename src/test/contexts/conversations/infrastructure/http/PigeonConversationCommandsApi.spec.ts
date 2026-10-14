import { mock, type MockProxy } from 'jest-mock-extended';

import type { ConversationOperationBody } from '../../../../../contexts/conversations/infrastructure/http/ConversationOperationBody';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestCache } from '../../../../../shared/infrastructure/http/RequestCache';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { ConversationIdFactory } from '../../../../../contexts/conversations/domain/ConversationIdFactory';
import { ConversationMapper } from '../../../../../contexts/conversations/infrastructure/http/ConversationMapper';
import { ConversationOperationSigner } from '../../../../../contexts/conversations/infrastructure/http/ConversationOperationSigner';
import { PigeonConversationCommandsApi } from '../../../../../contexts/conversations/infrastructure/http/PigeonConversationCommandsApi';
import { publicMutationSignerAt } from '../../../../shared/infrastructure/crypto/publicMutationSignerAt';

const target = { id: 'group:abc', networkId: 'network-1' };
const operation = {
  createdAt: 10,
  mutation: { recordId: 'conversation:group:abc:op:digest' },
  parents: ['parent-1'],
} as unknown as ConversationOperationBody;
const resource = {
  adminIds: ['identity-2'],
  creatorId: 'identity-1',
  id: 'group:abc',
  name: 'Friends',
  networkId: 'network-1',
  participantIds: ['identity-1', 'identity-2'],
  type: 'group',
};

describe(PigeonConversationCommandsApi.name, () => {
  let http: MockProxy<HttpJsonClient>;
  let identities: { get: jest.Mock };
  let publishKeychain: jest.Mock;
  let operations: MockProxy<ConversationOperationSigner>;
  let requestSigner: MockProxy<RequestSigner>;
  let api: PigeonConversationCommandsApi;
  const session = {
    identity: { id: 'identity-1' },
    keychain: { conversations: {}, version: 1 },
  } as unknown as Session;

  beforeEach(() => {
    http = mock<HttpJsonClient>();
    operations = mock<ConversationOperationSigner>();
    requestSigner = mock<RequestSigner>();
    requestSigner.headers.mockResolvedValue({ 'x-signature': 'sig' });
    operations.sign.mockResolvedValue(operation);
    identities = { get: jest.fn().mockResolvedValue({ id: 'identity-2' }) };
    publishKeychain = jest.fn().mockResolvedValue({
      keychain: { conversations: {}, version: 2 },
      keychainExternalIdentifier: 'keychain-2',
    });
    http.request.mockImplementation((path: string) =>
      Promise.resolve(
        path.endsWith('/frontier') ? { frontier: ['parent-1'] } : resource,
      ),
    );
    api = new PigeonConversationCommandsApi({
      conversations: new ConversationMapper(),
      http,
      identities,
      ids: new ConversationIdFactory(),
      keychains: { publishKeychain },
      mutations: publicMutationSignerAt(),
      operations,
      requestCache: mock<RequestCache>(),
      signer: requestSigner,
    });
  });

  it('adds a member with a signed operation and no conversation key', async () => {
    await expect(api.addMember(session, target, 'identity-2')).resolves.toEqual(
      resource,
    );

    expect(http.request).toHaveBeenCalledTimes(2);
    expect(http.request).toHaveBeenLastCalledWith(
      '/conversations/group%3Aabc/members',
      {
        body: JSON.stringify({ identityId: 'identity-2', operation }),
        headers: { 'x-signature': 'sig' },
        method: 'POST',
      },
    );
  });

  it('creates a group under the published keychain, without a group key', async () => {
    const published = { ...session, keychainExternalIdentifier: 'keychain-1' };

    await expect(
      api.createGroup(published, {
        name: 'Friends',
        networkId: 'network-1',
        nonce: 'nonce-1',
        participantIds: ['identity-2'],
      }),
    ).resolves.toEqual({
      conversation: resource,
      keychain: session.keychain,
      keychainExternalIdentifier: 'keychain-1',
    });

    expect(publishKeychain).not.toHaveBeenCalled();
    expect(http.request).toHaveBeenCalledTimes(1);
    expect(http.request).toHaveBeenCalledWith(
      '/conversations',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('publishes the unchanged keychain before a group when none is', async () => {
    await api.createGroup(session, {
      name: 'Friends',
      networkId: 'network-1',
      nonce: 'nonce-1',
      participantIds: ['identity-2'],
    });

    const [, update] = publishKeychain.mock.calls[0] as [
      Session,
      (current: Session['keychain']) => Session['keychain'],
    ];

    expect(update(session.keychain)).toBe(session.keychain);
    expect(http.request).toHaveBeenCalledTimes(1);
  });

  it('fetches the frontier with a signed GET', async () => {
    await expect(api.frontier(session, 'group:abc')).resolves.toEqual([
      'parent-1',
    ]);
    expect(requestSigner.headers).toHaveBeenCalledWith(
      session,
      'GET',
      '/conversations/group%3Aabc/frontier',
    );
  });

  it.each([
    [
      'leaves through the me route',
      'member_left',
      {},
      'DELETE',
      '/conversations/group%3Aabc/members/me',
      (): Promise<unknown> => api.leave(session, target),
    ],
    [
      'removes a member',
      'member_removed',
      { identityId: 'identity-2' },
      'DELETE',
      '/conversations/group%3Aabc/members/identity-2',
      (): Promise<unknown> => api.removeMember(session, target, 'identity-2'),
    ],
    [
      'promotes an admin',
      'admin_promoted',
      { identityId: 'identity-2' },
      'PUT',
      '/conversations/group%3Aabc/admins/identity-2',
      (): Promise<unknown> => api.promoteAdmin(session, target, 'identity-2'),
    ],
    [
      'demotes an admin',
      'admin_demoted',
      { identityId: 'identity-2' },
      'DELETE',
      '/conversations/group%3Aabc/admins/identity-2',
      (): Promise<unknown> => api.demoteAdmin(session, target, 'identity-2'),
    ],
  ])(
    '%s with a signed operation on the current frontier',
    async (_name, action, args, method, path, run) => {
      await expect(run()).resolves.toEqual(resource);

      expect(operations.sign).toHaveBeenCalledWith(
        session,
        expect.objectContaining({
          action,
          args,
          conversationId: 'group:abc',
          networkId: 'network-1',
          parents: ['parent-1'],
        }),
      );
      expect(http.request).toHaveBeenLastCalledWith(path, {
        body: JSON.stringify({ operation }),
        headers: { 'x-signature': 'sig' },
        method,
      });
      expect(requestSigner.headers).toHaveBeenLastCalledWith(
        session,
        method,
        path,
        { operation },
      );
    },
  );
});
