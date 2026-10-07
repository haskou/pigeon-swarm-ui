import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type {
  ConversationResource,
  ConversationKeyEntry,
  IdentityResource,
  LocalKeychain,
  NotificationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestCache } from '../../../../shared/infrastructure/http/RequestCache';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { ConversationIdFactory } from '../../domain/ConversationIdFactory';
import type { ConversationIdentityReader } from './ConversationIdentityReader';
import type { ConversationInvitationType } from './ConversationInvitationType';
import type { ConversationKeychainPublisher } from './ConversationKeychainPublisher';
import type { ConversationMapper } from './ConversationMapper';
import type { ConversationOperationBody } from './ConversationOperationBody';
import type { ConversationOperationSigner } from './ConversationOperationSigner';
import type { ConversationTarget } from './ConversationTarget';
import type { GroupConversationInput } from './GroupConversationInput';
import type { PigeonConversationCommandsApiDependencies } from './PigeonConversationCommandsApiDependencies';

import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { NotificationMutationSigner } from '../../../notifications/infrastructure/http/NotificationMutationSigner';
import { ConversationGroupNonce } from '../../domain/value-objects/ConversationGroupNonce';
import { ConversationNetworkId } from '../../domain/value-objects/ConversationNetworkId';
import { ConversationParticipantId } from '../../domain/value-objects/ConversationParticipantId';

export class PigeonConversationCommandsApi {
  private readonly invitations: NotificationMutationSigner;

  private readonly http: HttpJsonClient;
  private readonly signer: RequestSigner;
  private readonly conversations: ConversationMapper;
  private readonly ids: ConversationIdFactory;
  private readonly identities: ConversationIdentityReader;
  private readonly keychains: ConversationKeychainPublisher;
  private readonly requestCache: RequestCache;
  private readonly operations: ConversationOperationSigner;

  public constructor(dependencies: PigeonConversationCommandsApiDependencies) {
    this.http = dependencies.http;
    this.signer = dependencies.signer;
    this.conversations = dependencies.conversations;
    this.ids = dependencies.ids;
    this.identities = dependencies.identities;
    this.keychains = dependencies.keychains;
    this.requestCache = dependencies.requestCache;
    this.operations = dependencies.operations;
    this.invitations = new NotificationMutationSigner(dependencies.mutations);
  }

  private async createInvitation(
    session: Session,
    peerIdentity: IdentityResource,
    keyEntry: ConversationKeyEntry,
    invitationType: ConversationInvitationType = 'conversation_invitation',
  ): Promise<void> {
    const path = '/notifications/';
    const recipientKeyEntry = {
      ...keyEntry,
      peerIdentityId: session.identity.id,
    };
    const encryptedConversationKey = IdentityId.fromString(peerIdentity.id)
      .getPublicKey()
      .encrypt(JSON.stringify(recipientKeyEntry))
      .toString();
    const invitation = await this.invitations.invitation(session, {
      encryptedKey: encryptedConversationKey,
      recipientIdentityId: peerIdentity.id,
      subjectId: keyEntry.conversationId,
      type: invitationType,
    });
    const body = {
      conversationId: keyEntry.conversationId,
      encryptedConversationKey,
      inviterIdentityId: invitation.inviterIdentityId,
      mutation: invitation.mutation,
      nonce: invitation.nonce,
      recipientIdentityId: invitation.recipientIdentityId,
      type: invitationType,
    };

    await this.http.request<NotificationResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }

  private createConversationKeyEntry(
    identityId: string,
    peerIdentityId: string,
    networkId: string,
  ): ConversationKeyEntry {
    return {
      algorithm: 'aes-256-gcm',
      conversationId: this.ids
        .create(
          ConversationParticipantId.fromString(identityId),
          ConversationParticipantId.fromString(peerIdentityId),
          ConversationNetworkId.fromString(networkId),
        )
        .toString(),
      createdAt: Date.now(),
      key: SymmetricKey.generate().valueOf(),
      kind: 'conversation',
      peerIdentityId,
      version: 2,
    };
  }

  private createGroupConversationKeyEntry(
    conversationId: string,
  ): ConversationKeyEntry {
    return {
      algorithm: 'aes-256-gcm',
      conversationId,
      createdAt: Date.now(),
      key: SymmetricKey.generate().valueOf(),
      kind: 'conversation',
      peerIdentityId: '',
      version: 2,
    };
  }

  private withConversationKey(
    keychain: LocalKeychain,
    keyEntry: ConversationKeyEntry,
  ): LocalKeychain {
    return {
      conversations: {
        ...keychain.conversations,
        [keyEntry.conversationId]: keyEntry,
      },
      version: keychain.version + 1,
    };
  }

  private withServerConversationId(
    keychain: LocalKeychain,
    keyEntry: ConversationKeyEntry,
    conversationId: string,
  ): LocalKeychain {
    if (conversationId === keyEntry.conversationId) return keychain;

    return {
      ...keychain,
      conversations: {
        ...keychain.conversations,
        [conversationId]: { ...keyEntry, conversationId },
      },
    };
  }

  private async postConversation(
    session: Session,
    published: {
      keychain: LocalKeychain;
      keychainExternalIdentifier: string;
    },
    body: Record<string, unknown>,
  ): Promise<ConversationResource> {
    const path = '/conversations';
    const created = await this.http.request<unknown>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(
        {
          ...session,
          keychain: published.keychain,
          keychainExternalIdentifier: published.keychainExternalIdentifier,
        },
        'POST',
        path,
        body,
      ),
      method: 'POST',
    });
    this.requestCache.invalidateForSession('/conversations/?limit=30', session);

    return this.conversations.resource(created);
  }

  /** Signs an operation on top of the frontier the node holds right now. */
  private async signOperation(
    session: Session,
    target: ConversationTarget,
    action: string,
    args: Record<string, unknown>,
  ): Promise<ConversationOperationBody> {
    return await this.operations.sign(session, {
      action,
      args,
      conversationId: target.id,
      createdAt: Date.now(),
      networkId: target.networkId,
      parents: await this.frontier(session, target.id),
    });
  }

  private async sendRosterChange(
    session: Session,
    target: ConversationTarget,
    change: {
      action: string;
      args: Record<string, unknown>;
      body?: Record<string, unknown>;
      method: 'DELETE' | 'POST' | 'PUT';
      path: string;
    },
  ): Promise<ConversationResource> {
    const body = {
      ...change.body,
      operation: await this.signOperation(
        session,
        target,
        change.action,
        change.args,
      ),
    };
    const updated = await this.http.request<unknown>(change.path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(
        session,
        change.method,
        change.path,
        body,
      ),
      method: change.method,
    });
    this.requestCache.invalidateForSession('/conversations/?limit=30', session);

    return this.conversations.resource(updated);
  }

  private memberPath(conversationId: string, suffix: string): string {
    return `/conversations/${encodeURIComponent(conversationId)}/${suffix}`;
  }

  public async create(
    session: Session,
    peerIdentityId: string,
    networkId: string,
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    const peerIdentity = await this.identities.get(peerIdentityId.trim());
    const keyEntry = this.createConversationKeyEntry(
      session.identity.id,
      peerIdentity.id,
      networkId,
    );
    const published = await this.keychains.publishKeychain(
      session,
      this.withConversationKey(session.keychain, keyEntry),
    );
    const conversation = await this.postConversation(session, published, {
      keychainExternalIdentifier: published.keychainExternalIdentifier,
      networkId,
      operation: await this.operations.sign(session, {
        action: 'conversation_created',
        args: {
          participantIds: [session.identity.id, peerIdentity.id].sort(),
          type: 'one-to-one',
        },
        conversationId: keyEntry.conversationId,
        createdAt: Date.now(),
        networkId,
        parents: [],
      }),
      participantIds: [session.identity.id, peerIdentity.id].sort(),
      type: 'one-to-one',
    });
    const serverKeyEntry = { ...keyEntry, conversationId: conversation.id };

    await this.createInvitation(session, peerIdentity, serverKeyEntry);

    return {
      conversation,
      keychain: this.withServerConversationId(
        published.keychain,
        keyEntry,
        conversation.id,
      ),
      keychainExternalIdentifier: published.keychainExternalIdentifier,
    };
  }

  public async createGroup(
    session: Session,
    input: GroupConversationInput,
  ): Promise<{
    conversation: ConversationResource;
    keychain: LocalKeychain;
    keychainExternalIdentifier: string;
  }> {
    const participantIds = [session.identity.id, ...input.participantIds]
      .filter(Boolean)
      .filter((id, index, values) => values.indexOf(id) === index)
      .sort();
    const name = input.name.trim();
    const conversationId = this.ids
      .createGroup(
        ConversationParticipantId.fromString(session.identity.id),
        ConversationNetworkId.fromString(input.networkId),
        ConversationGroupNonce.fromString(input.nonce),
      )
      .toString();
    const keyEntry = this.createGroupConversationKeyEntry(conversationId);
    const published = await this.keychains.publishKeychain(
      session,
      this.withConversationKey(session.keychain, keyEntry),
    );
    const conversation = await this.postConversation(session, published, {
      keychainExternalIdentifier: published.keychainExternalIdentifier,
      name,
      networkId: input.networkId,
      nonce: input.nonce,
      operation: await this.operations.sign(session, {
        action: 'conversation_created',
        args: { name, nonce: input.nonce, participantIds, type: 'group' },
        conversationId,
        createdAt: Date.now(),
        networkId: input.networkId,
        parents: [],
      }),
      participantIds,
      type: 'group',
    });
    const invitedIdentities = await Promise.all(
      participantIds
        .filter((identityId) => identityId !== session.identity.id)
        .map((identityId) => this.identities.get(identityId)),
    );

    await Promise.all(
      invitedIdentities.map((identity) =>
        this.createInvitation(
          session,
          identity,
          keyEntry,
          'group_conversation_invitation',
        ),
      ),
    );

    return {
      conversation,
      keychain: published.keychain,
      keychainExternalIdentifier: published.keychainExternalIdentifier,
    };
  }

  /** Signs `member_added`, then hands the new member the conversation key. */
  public async addMember(
    session: Session,
    target: ConversationTarget,
    recipientIdentityId: string,
  ): Promise<ConversationResource> {
    const keyEntry = session.keychain.conversations[target.id];

    if (!keyEntry) throw new Error('Conversation key is required.');

    const recipientIdentity = await this.identities.get(
      recipientIdentityId.trim(),
    );
    const conversation = await this.sendRosterChange(session, target, {
      action: 'member_added',
      args: { identityId: recipientIdentity.id },
      body: { identityId: recipientIdentity.id },
      method: 'POST',
      path: this.memberPath(target.id, 'members'),
    });

    await this.createInvitation(
      session,
      recipientIdentity,
      keyEntry,
      'group_conversation_invitation',
    );

    return conversation;
  }

  public async demoteAdmin(
    session: Session,
    target: ConversationTarget,
    identityId: string,
  ): Promise<ConversationResource> {
    return await this.sendRosterChange(session, target, {
      action: 'admin_demoted',
      args: { identityId },
      method: 'DELETE',
      path: this.memberPath(
        target.id,
        `admins/${encodeURIComponent(identityId)}`,
      ),
    });
  }

  public async frontier(
    session: Session,
    conversationId: string,
  ): Promise<string[]> {
    const path = this.memberPath(conversationId, 'frontier');
    const result = await this.http.request<{ frontier: string[] }>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });

    return result.frontier;
  }

  public async leave(
    session: Session,
    target: ConversationTarget,
  ): Promise<ConversationResource> {
    return await this.sendRosterChange(session, target, {
      action: 'member_left',
      args: {},
      method: 'DELETE',
      path: this.memberPath(target.id, 'members/me'),
    });
  }

  public async promoteAdmin(
    session: Session,
    target: ConversationTarget,
    identityId: string,
  ): Promise<ConversationResource> {
    return await this.sendRosterChange(session, target, {
      action: 'admin_promoted',
      args: { identityId },
      method: 'PUT',
      path: this.memberPath(
        target.id,
        `admins/${encodeURIComponent(identityId)}`,
      ),
    });
  }

  public async removeMember(
    session: Session,
    target: ConversationTarget,
    identityId: string,
  ): Promise<ConversationResource> {
    return await this.sendRosterChange(session, target, {
      action: 'member_removed',
      args: { identityId },
      method: 'DELETE',
      path: this.memberPath(
        target.id,
        `members/${encodeURIComponent(identityId)}`,
      ),
    });
  }
}
