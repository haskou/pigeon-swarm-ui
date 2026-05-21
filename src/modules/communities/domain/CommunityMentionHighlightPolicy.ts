import type { ChatMessage } from '../../../shared/domain/pigeonResources.types';

export class CommunityMentionHighlightPolicy {
  public static mentionsIdentity(
    message: ChatMessage,
    identityId: string,
    roleIds: ReadonlySet<string>,
  ): boolean {
    if (message.authorIdentityId === identityId) return false;

    return (message.mentions ?? []).some((mention) => {
      if (mention.type === 'everyone' || mention.type === 'here') return true;

      if (mention.type === 'identity') return mention.targetId === identityId;

      return roleIds.has(mention.targetId);
    });
  }
}
