import type { NotificationSettingMap } from '../../../../contexts/notifications/presentation/view-models/NotificationSettingMap';
import type { PwaNotificationPermission } from '../../../../contexts/notifications/infrastructure/browser/PwaNotificationPermission';
import type {
  Community,
  CommunityInvitationNotificationResource,
  ConversationResource,
  ConversationInvitationNotificationResource,
  NotificationResource,
  NotificationSettingScope,
  NotificationScopeSetting,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { ConversationPeer } from '../../../../contexts/conversations/presentation/view-models/ConversationPeer';
import { ConversationKeychain } from '../../../../contexts/identities/infrastructure/keychain/ConversationKeychain';
import {
  identityDisplayName,
  identityPrimaryDisplayName,
} from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import { NotificationSettingsPolicy } from '../../../../contexts/notifications/presentation/view-models/NotificationSettingsPolicy';
import {
  isPendingCommunityInvitationFor,
  isPendingConversationInvitationFor,
} from './workspaceNotificationState';

export class WorkspaceDerivedState {
  public static activeConversation(
    conversations: ConversationResource[],
    activeConversationId: null | string,
  ): ConversationResource | undefined {
    return (
      conversations.find(
        (conversation) => conversation.id === activeConversationId,
      ) ??
      conversations[0] ??
      undefined
    );
  }

  public static communityChannelUnreadCounts(
    community: Community | undefined,
    unreadCountsByCommunityId: Record<string, Record<string, number>>,
  ): Record<string, number> {
    if (!community) return {};

    return unreadCountsByCommunityId[community.id] ?? {};
  }

  public static conversationKey(
    session: Session,
    conversation: ConversationResource | null | undefined,
  ): Session['keychain']['conversations'][string] | undefined {
    if (!conversation) return undefined;

    return ConversationKeychain.entry(
      session.keychain,
      session.identity.id,
      conversation.id,
    );
  }

  public static conversationKeyId(
    key: Session['keychain']['conversations'][string] | undefined,
  ): null | string {
    return key?.conversationId ?? null;
  }

  public static conversationNotificationScope(
    conversation: ConversationResource | null | undefined,
  ): NotificationSettingScope | null {
    return conversation
      ? { conversationId: conversation.id, type: 'conversation' }
      : null;
  }

  public static conversationNotificationSetting(
    settings: NotificationSettingMap,
    scope: NotificationSettingScope | null,
  ): NotificationScopeSetting {
    return scope
      ? NotificationSettingsPolicy.resolve(settings, scope)
      : NotificationSettingsPolicy.defaults;
  }

  public static conversationPeerIdentityId(
    conversation: ConversationResource | null | undefined,
    session: Session,
  ): string | undefined {
    if (!conversation) return undefined;

    return ConversationPeer.identityId(
      conversation,
      session.identity.id,
      session.keychain,
    );
  }

  public static hasOpenDialog(states: boolean[]): boolean {
    return states.some(Boolean);
  }

  public static id(resource: { id: string } | null | undefined): null | string {
    return resource?.id ?? null;
  }

  public static invitationInviterName(
    notification: NotificationResource | null,
    identityNames: Record<string, string>,
  ): string | undefined {
    if (!notification || !('inviterIdentityId' in notification.payload)) {
      return undefined;
    }

    return identityPrimaryDisplayName(
      identityDisplayName(
        notification.payload.inviterIdentityId,
        identityNames,
      ),
    );
  }

  public static networkId(
    resource: { networkId: string } | null | undefined,
  ): null | string {
    return resource?.networkId ?? null;
  }

  public static nodeIsUnclaimed(
    node: { owner: null | string } | null,
  ): boolean {
    return !node?.owner;
  }

  public static pendingCommunityInvitation(
    notifications: NotificationResource[],
    community: Community | undefined,
    currentIdentityId: string,
  ): CommunityInvitationNotificationResource | null {
    if (!community) return null;

    return (
      notifications.find((notification) =>
        isPendingCommunityInvitationFor(
          notification,
          community.id,
          currentIdentityId,
        ),
      ) ?? null
    );
  }

  public static pendingConversationInvitation(
    notifications: NotificationResource[],
    conversation: ConversationResource | null | undefined,
    currentIdentityId: string,
  ): ConversationInvitationNotificationResource | null {
    if (!conversation) return null;

    return (
      notifications.find((notification) =>
        isPendingConversationInvitationFor(
          notification,
          conversation.id,
          currentIdentityId,
        ),
      ) ?? null
    );
  }

  public static pushPromptVisible(
    ready: boolean,
    permission: PwaNotificationPermission,
    dismissed: boolean,
  ): boolean {
    return ready && permission === 'default' && !dismissed;
  }

  public static railCommunityId(
    workspaceMode: 'community' | 'messages',
    community: Community | undefined,
  ): null | string {
    return workspaceMode === 'community'
      ? WorkspaceDerivedState.id(community)
      : null;
  }

  public static selectedId(
    resource: { id: string } | null | undefined,
    fallbackId: null | string,
  ): null | string {
    return resource?.id ?? fallbackId;
  }
}
