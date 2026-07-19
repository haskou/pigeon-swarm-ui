import type { CallParticipant } from '../../../../contexts/calls/presentation/view-models/CallParticipant';
import type { NodeNetwork } from '../../../../contexts/networks/presentation/view-models/NodeNetwork';
import type {
  ConversationKeyEntry,
  ConversationResource,
  IdentityResource,
} from '../../../../shared/domain/pigeonResources.types';

import { memberPrimaryName } from '../../../../contexts/communities/presentation/components/communityMemberNames';
import { conversationSupportsThreads } from '../../../../contexts/conversations/presentation/view-models/conversationSupportsThreads';
import {
  identityDisplayName,
  type IdentityNames,
  type IdentityPictures,
} from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import { shortId } from '../../../../shared/presentation/formatting';
import { copy } from '../../../../shared/presentation/i18n/copy';

export class ChatConversationPresentation {
  public readonly callParticipants: CallParticipant[];

  public readonly canCreatePoll: boolean;

  public readonly canOpenPeerProfile: boolean;

  public readonly canShareConversationKey: boolean;

  public readonly conversationData: {
    frontendDerived: Record<string, unknown>;
    serverConversation: ConversationResource | null;
  };

  public readonly encryptionDetails: {
    note: string;
    rows: Array<{ label: string; technical?: boolean; value: string }>;
    secrets: Array<{
      label: string;
      sensitive?: boolean;
      value?: string;
    }>;
    status: 'missing' | 'ready';
    subtitle: string;
    title: string;
  } | null;

  public readonly groupParticipants: Array<{
    identity?: IdentityResource;
    identityId: string;
    name?: string;
    picture?: string;
  }>;

  public readonly isGroup: boolean;

  public readonly name?: string;

  public readonly networkId?: string;

  public readonly networkName: string;

  public readonly networkTooltip: string;

  public readonly participantIds: string[];

  public readonly title?: string;

  public constructor({
    conversation,
    conversationKey,
    currentIdentityId,
    hasConversationKey,
    identityNames,
    identityPictures,
    identityProfiles,
    loadedMessageCount,
    nodeNetworks,
    peerIdentity,
    peerIdentityId,
  }: {
    conversation?: ConversationResource;
    conversationKey?: ConversationKeyEntry;
    currentIdentityId: string;
    hasConversationKey: boolean;
    identityNames: IdentityNames;
    identityPictures: IdentityPictures;
    identityProfiles: Record<string, IdentityResource>;
    loadedMessageCount: number;
    nodeNetworks: NodeNetwork[];
    peerIdentity?: IdentityResource;
    peerIdentityId?: string;
  }) {
    this.isGroup = conversationSupportsThreads(conversation);
    this.participantIds = this.resolveParticipantIds(conversation);
    this.name = this.resolveName(conversation, peerIdentityId, identityNames);
    this.title = this.resolveTitle(conversation, peerIdentity, this.name);
    this.networkId = conversation?.networkId;
    this.networkName = this.resolveNetworkName(nodeNetworks);
    this.networkTooltip = this.networkId ?? copy.profile.noNetworks;
    this.groupParticipants = this.resolveGroupParticipants(
      identityNames,
      identityPictures,
      identityProfiles,
    );
    this.callParticipants = this.groupParticipants.map((participant) => ({
      identity: participant.identity,
      identityId: participant.identityId,
      muted: false,
      name:
        participant.name ??
        memberPrimaryName(participant.identity, participant.identityId),
      picture: participant.picture,
    }));
    this.canCreatePoll = this.allowsPollCreation(
      conversation,
      currentIdentityId,
    );
    this.canOpenPeerProfile = this.allowsPeerProfile(
      conversation,
      peerIdentityId,
    );
    this.canShareConversationKey = !this.isGroup;
    this.conversationData = {
      frontendDerived: {
        conversationNetworkId: this.networkId ?? null,
        conversationNetworkName: this.networkName,
        e2eReady: hasConversationKey,
        loadedMessages: loadedMessageCount,
        peerIdentity,
        peerIdentityId: peerIdentityId ?? null,
      },
      serverConversation: conversation ?? null,
    };
    this.encryptionDetails = this.resolveAvailableEncryptionDetails(
      conversation,
      conversationKey,
      hasConversationKey,
    );
  }

  private allowsPeerProfile(
    conversation: ConversationResource | undefined,
    peerIdentityId: string | undefined,
  ): boolean {
    return !!conversation && !!peerIdentityId && !this.isGroup;
  }

  private allowsPollCreation(
    conversation: ConversationResource | undefined,
    currentIdentityId: string,
  ): boolean {
    return (
      this.isGroup &&
      !!conversation &&
      this.participantIds.includes(currentIdentityId)
    );
  }

  private resolveAvailableEncryptionDetails(
    conversation: ConversationResource | undefined,
    conversationKey: ConversationKeyEntry | undefined,
    hasConversationKey: boolean,
  ): ChatConversationPresentation['encryptionDetails'] {
    if (!conversation) return null;

    return this.resolveEncryptionDetails(
      conversation,
      conversationKey,
      hasConversationKey,
    );
  }

  private resolveEncryptionDetails(
    conversation: ConversationResource,
    conversationKey: ConversationKeyEntry | undefined,
    hasConversationKey: boolean,
  ): ChatConversationPresentation['encryptionDetails'] {
    return {
      note: hasConversationKey
        ? copy.encryption.conversationNote
        : copy.encryption.missingNote,
      rows: [
        { label: copy.encryption.scope, value: conversation.id },
        { label: copy.encryption.network, value: this.networkName },
        {
          label: copy.encryption.algorithm,
          technical: true,
          value: conversationKey?.algorithm ?? copy.encryption.unknown,
        },
        {
          label: copy.encryption.keyVersion,
          technical: true,
          value: conversationKey ? `v${conversationKey.version}` : '-',
        },
        {
          label: copy.encryption.createdAt,
          technical: true,
          value: conversationKey
            ? new Intl.DateTimeFormat(undefined, {
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                month: 'short',
                year: 'numeric',
              }).format(new Date(conversationKey.createdAt))
            : '-',
        },
      ],
      secrets: [
        {
          label: copy.encryption.symmetricKey,
          sensitive: true,
          value: conversationKey?.key,
        },
        {
          label: copy.encryption.peerIdentity,
          value: conversationKey?.peerIdentityId,
        },
      ],
      status: hasConversationKey ? 'ready' : 'missing',
      subtitle: shortId(conversation.id),
      title: copy.encryption.conversationTitle,
    };
  }

  private resolveGroupParticipants(
    identityNames: IdentityNames,
    identityPictures: IdentityPictures,
    identityProfiles: Record<string, IdentityResource>,
  ): ChatConversationPresentation['groupParticipants'] {
    return this.participantIds.map((identityId) => {
      const identity = identityProfiles[identityId];

      return {
        identity,
        identityId,
        name:
          identityNames[identityId] ??
          (identity ? memberPrimaryName(identity, identityId) : undefined),
        picture: identityPictures[identityId],
      };
    });
  }

  private resolveName(
    conversation: ConversationResource | undefined,
    peerIdentityId: string | undefined,
    identityNames: IdentityNames,
  ): string | undefined {
    if (this.isGroup) return conversation?.name ?? conversation?.title;

    return peerIdentityId
      ? identityDisplayName(peerIdentityId, identityNames)
      : conversation?.title;
  }

  private resolveNetworkName(nodeNetworks: NodeNetwork[]): string {
    if (!this.networkId) return copy.profile.noNetworks;

    return (
      nodeNetworks.find((network) => network.id === this.networkId)?.name ??
      shortId(this.networkId)
    );
  }

  private resolveParticipantIds(conversation?: ConversationResource): string[] {
    if (!conversation) return [];

    return (
      conversation.participantIdentityIds ??
      conversation.participantIds ??
      conversation.participants ??
      []
    );
  }

  private resolveTitle(
    conversation: ConversationResource | undefined,
    peerIdentity: IdentityResource | undefined,
    name: string | undefined,
  ): string | undefined {
    if (this.isGroup) return name;

    const fallbackName = name?.replace(/\s+\(@[^)]+\)$/, '');

    return (
      peerIdentity?.profile.name.trim() ||
      (peerIdentity?.profile.handle?.trim()
        ? `@${peerIdentity.profile.handle.trim()}`
        : (fallbackName ?? conversation?.title))
    );
  }
}
