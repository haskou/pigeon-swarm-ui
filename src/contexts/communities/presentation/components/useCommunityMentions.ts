import { useCallback, useMemo } from 'react';

import type {
  Community,
  CommunityPermission,
  CommunityTextChannel,
  IdentityResource,
} from '../../../../shared/domain/pigeonResources.types';
import type { CommunityMemberListItem } from './communityMembersPanel';
import type { CommunityMentionSuggestion } from './communityMentionPanel';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { CommunityAccessPolicy } from '../../domain/CommunityAccessPolicy';
import { CommunityMessageMentions } from './CommunityMessageMentions';
import { memberDisplayName } from './communityMemberNames';
import { findMentionTrigger } from './communityMentionTrigger';

type CommunityMentionsInput = {
  community: Community;
  draft: string;
  identities: Record<string, IdentityResource>;
  members: CommunityMemberListItem[];
  permissions: Set<CommunityPermission>;
  selectedChannel?: CommunityTextChannel | null;
  setDraft: (draft: string) => void;
};

export function useCommunityMentions({
  community,
  draft,
  identities,
  members,
  permissions,
  selectedChannel,
  setDraft,
}: CommunityMentionsInput) {
  const suggestions = useMemo(() => {
    if (!selectedChannel) return [];

    const trigger = findMentionTrigger(draft);

    if (!trigger) return [];

    const query = trigger.query.toLowerCase();
    const accessibleMemberIds = new Set(
      CommunityAccessPolicy.membersWithChannelAccess(
        community,
        selectedChannel,
      ),
    );
    const memberSuggestions = members
      .filter((member) => accessibleMemberIds.has(member.identityId))
      .map((member) => {
        const label = memberDisplayName(member.identity, member.identityId);
        const handle = member.identity?.profile.handle?.trim();

        return {
          description: handle ? `@${handle}` : copy.composer.identityMention,
          id: member.identityId,
          label,
          mention: { targetId: member.identityId, type: 'identity' } as const,
          token: `@${handle || label}`,
        };
      })
      .filter((suggestion) =>
        `${suggestion.label} ${suggestion.description}`
          .toLowerCase()
          .includes(query),
      );
    const roleSuggestions =
      permissions.has('mention_roles') && community.roles
        ? community.roles
            .filter(
              (role) =>
                !role.builtIn && role.name.toLowerCase().includes(query),
            )
            .map((role) => ({
              description: copy.composer.roleMention,
              id: role.id,
              label: role.name,
              mention: { targetId: role.id, type: 'role' } as const,
              token: `@${role.name}`,
            }))
        : [];
    const specialCandidates: Array<CommunityMentionSuggestion | null> = [
      permissions.has('mention_everyone')
        ? {
            description: copy.composer.everyoneMention,
            id: 'everyone',
            label: 'everyone',
            mention: { type: 'everyone' },
            token: '@everyone',
          }
        : null,
      permissions.has('mention_here')
        ? {
            description: copy.composer.hereMention,
            id: 'here',
            label: 'here',
            mention: { type: 'here' },
            token: '@here',
          }
        : null,
    ];
    const specialSuggestions = specialCandidates.filter(
      (suggestion): suggestion is CommunityMentionSuggestion =>
        Boolean(suggestion && suggestion.label.includes(query)),
    );

    return [
      ...specialSuggestions,
      ...roleSuggestions,
      ...memberSuggestions,
    ].slice(0, 8);
  }, [community, draft, members, permissions, selectedChannel]);

  const insert = useCallback(
    (token: string) => {
      const trigger = findMentionTrigger(draft);

      if (!trigger) return;

      setDraft(
        `${draft.slice(0, trigger.start)}${token} ${draft.slice(trigger.end)}`,
      );
    },
    [draft, setDraft],
  );

  const tokens = useMemo(
    () =>
      selectedChannel
        ? CommunityMessageMentions.tokens({
            channel: selectedChannel,
            community,
            identities,
            permissions,
          })
        : [],
    [community, identities, permissions, selectedChannel],
  );

  const autocomplete = useCallback(() => {
    const suggestion = suggestions[0];

    if (!suggestion) return false;

    insert(suggestion.token);

    return true;
  }, [insert, suggestions]);

  return { autocomplete, insert, suggestions, tokens };
}
