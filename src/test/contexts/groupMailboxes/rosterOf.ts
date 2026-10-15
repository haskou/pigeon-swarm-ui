import type { GroupMailboxRosterFields } from '../../../contexts/groupMailboxes/domain/GroupMailboxRosterFields';

import { GroupMailboxRoster } from '../../../contexts/groupMailboxes/domain/GroupMailboxRoster';

/**
 * A well-formed roster of `memberIds`, created by the first of them unless
 * `fields` say otherwise; throws when the fields are not well formed.
 */
export function rosterOf(
  memberIds: readonly string[],
  fields: Partial<GroupMailboxRosterFields> = {},
): GroupMailboxRoster {
  const roster = GroupMailboxRoster.of({
    adminIds: [],
    conversationId: `group:${'A'.repeat(43)}`,
    creatorId: memberIds[0] ?? '',
    memberIds,
    name: 'Group',
    version: GroupMailboxRoster.VERSION,
    ...fields,
  });

  if (!roster) throw new Error('The roster fixture is not well formed');

  return roster;
}
