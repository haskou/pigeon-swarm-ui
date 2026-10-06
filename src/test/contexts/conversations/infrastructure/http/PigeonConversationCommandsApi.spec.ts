import { mock, type MockProxy } from 'jest-mock-extended';

import type { Session } from '../../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestCache } from '../../../../../shared/infrastructure/http/RequestCache';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';
import type { ConversationOperationBody } from '../../../../../contexts/conversations/infrastructure/http/ConversationOperationBody';

import { ConversationIdFactory } from '../../../../../contexts/conversations/domain/ConversationIdFactory';
import { ConversationMapper } from '../../../../../contexts/conversations/infrastructure/http/ConversationMapper';
import { ConversationOperationSigner } from '../../../../../contexts/conversations/infrastructure/http/ConversationOperationSigner';
import { PigeonConversationCommandsApi } from '../../../../../contexts/conversations/infrastructure/http/PigeonConversationCommandsApi';

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
  unreadCount: 0,
};

describe(PigeonConversationCommandsApi.name, () => {
  let http: MockProxy<HttpJsonClient>;
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
    operations.sign.mockReturnValue(operation);
    http.request.mockImplementation(async (path: string) =>
      path.endsWith('/frontier') ? { frontier: ['parent-1'] } : resource,
    );
    api = new PigeonConversationCommandsApi(
      http,
      requestSigner,
      new ConversationMapper(),
      new ConversationIdFactory(),
      { get: jest.fn() },
      { publishKeychain: jest.fn() },
      mock<RequestCache>(),
      operations,
    );
  });

  it('rejects invitations when the conversation key is not available', async () => {
    await expect(
      api.addMember(session, target, 'identity-2'),
    ).rejects.toThrow('Conversation key is required.');
    expect(http.request).not.toHaveBeenCalled();
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
  ])('%s with a signed operation on the current frontier', async (_name, action, args, method, path, run) => {
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
  });
});
