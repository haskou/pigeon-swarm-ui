import type {
  ChatMessage,
  Community,
  CommunityPermission,
} from '../../../../shared/domain/pigeonResources.types';

import { MessageEditPolicy } from '../../../messages/domain/MessageEditPolicy';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { CommunityAccessPolicy } from '../../domain/CommunityAccessPolicy';

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
    return MessageEditPolicy.canEdit(message, currentIdentityId);
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
    const roleNames = new Set<string>();

    if (community.ownerIdentityId === identityId) {
      roleNames.add(copy.communities.owner);
    }

    for (const role of CommunityAccessPolicy.assignedRolesFor(
      community,
      identityId,
    )) {
      roleNames.add(role.name);
    }

    return [...roleNames];
  }
}
