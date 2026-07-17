import type {
  ChatMessage,
  Community,
  CommunityPermission,
} from '../../../../shared/domain/pigeonResources.types';

import { MessageEditability } from '../../../messages/presentation/view-models/MessageEditability';
import { communityRoleDisplayName } from '../view-models/communityRoleDisplayName';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { CommunityAccessPolicy } from '../view-models/CommunityAccessPolicy';

type DeleteMessageInput = {
  currentPermissions: Set<CommunityPermission>;
  message: ChatMessage;
  owner: boolean;
};

type OpenConversationInput = {
  currentIdentityId: string;
  hasConversationHandler: boolean;
  profileIdentityId: string;
};

export class CommunityWorkspaceDialogActions {
  public static canDeleteMessage({
    currentPermissions,
    message,
    owner,
  }: DeleteMessageInput): boolean {
    return (
      message.kind !== 'poll' &&
      (message.mine || owner || currentPermissions.has('manage_messages'))
    );
  }

  public static canEditMessage(
    message: ChatMessage,
    currentIdentityId: string,
  ): boolean {
    return MessageEditability.canEdit(message, currentIdentityId);
  }

  public static canOpenConversation({
    currentIdentityId,
    hasConversationHandler,
    profileIdentityId,
  }: OpenConversationInput): boolean {
    return hasConversationHandler && profileIdentityId !== currentIdentityId;
  }

  public static profileRoleNames(
    community: Community,
    identityId: string,
  ): string[] {
    const isOwner = community.ownerIdentityId === identityId;
    const isMember = community.memberIds.includes(identityId);

    if (!isOwner && !isMember) return [];

    const roleNames = new Set<string>();

    if (isOwner) {
      roleNames.add(copy.communities.owner);
    }

    for (const role of CommunityAccessPolicy.assignedRolesFor(
      community,
      identityId,
    )) {
      roleNames.add(communityRoleDisplayName(role));
    }

    return [...roleNames];
  }
}
