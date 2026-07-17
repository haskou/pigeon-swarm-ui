import type {
  Community,
  CommunityChannel,
  CommunityMessageMention,
  CommunityPermission,
  IdentityResource,
} from '../../../../shared/domain/pigeonResources.types';

import { CommunityAccessPolicy } from '../view-models/CommunityAccessPolicy';
import { memberDisplayName } from './communityMemberNames';

type CommunityMentionInput = {
  channel: CommunityChannel;
  community: Community;
  content: string;
  identities: Record<string, IdentityResource>;
  permissions: Set<CommunityPermission>;
};

type CommunityMentionTokenInput = Omit<CommunityMentionInput, 'content'>;

export class CommunityMessageMentions {
  public static forContent({
    channel,
    community,
    content,
    identities,
    permissions,
  }: CommunityMentionInput): CommunityMessageMention[] {
    const lowerContent = content.toLowerCase();
    const mentions: CommunityMessageMention[] = [];

    if (
      permissions.has('mention_everyone') &&
      lowerContent.includes('@everyone')
    ) {
      mentions.push({ type: 'everyone' });
    }

    if (permissions.has('mention_here') && lowerContent.includes('@here')) {
      mentions.push({ type: 'here' });
    }

    if (permissions.has('mention_roles')) {
      for (const role of community.roles ?? []) {
        if (role.builtIn) continue;

        if (lowerContent.includes(`@${role.name.toLowerCase()}`)) {
          mentions.push({ targetId: role.id, type: 'role' });
        }
      }
    }

    for (const identityId of CommunityAccessPolicy.membersWithChannelAccess(
      community,
      channel,
    )) {
      const identity = identities[identityId];
      const handle = identity?.profile.handle?.trim();
      const name = memberDisplayName(identity, identityId);
      const tokens = [handle ? `@${handle}` : null, `@${name}`]
        .filter((token): token is string => !!token)
        .map((token) => token.toLowerCase());

      if (tokens.some((token) => lowerContent.includes(token))) {
        mentions.push({ targetId: identityId, type: 'identity' });
      }
    }

    return CommunityMessageMentions.dedupe(mentions);
  }

  public static tokens({
    channel,
    community,
    identities,
    permissions,
  }: CommunityMentionTokenInput): string[] {
    const tokens = new Set<string>();

    if (permissions.has('mention_everyone')) tokens.add('@everyone');
    if (permissions.has('mention_here')) tokens.add('@here');

    if (permissions.has('mention_roles')) {
      for (const role of community.roles ?? []) {
        if (!role.builtIn) tokens.add(`@${role.name}`);
      }
    }

    for (const identityId of CommunityAccessPolicy.membersWithChannelAccess(
      community,
      channel,
    )) {
      const identity = identities[identityId];
      const handle = identity?.profile.handle?.trim();
      const name = memberDisplayName(identity, identityId);

      if (handle) tokens.add(`@${handle}`);
      tokens.add(`@${name}`);
    }

    return [...tokens];
  }

  private static dedupe(
    mentions: CommunityMessageMention[],
  ): CommunityMessageMention[] {
    const seen = new Set<string>();

    return mentions.filter((mention) => {
      const key =
        mention.type === 'identity' || mention.type === 'role'
          ? `${mention.type}:${mention.targetId}`
          : mention.type;

      if (seen.has(key)) return false;

      seen.add(key);

      return true;
    });
  }
}
