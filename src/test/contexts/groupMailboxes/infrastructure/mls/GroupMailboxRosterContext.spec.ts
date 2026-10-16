import { GroupMailboxRosterExtension } from '@haskou/pigeon-swarm-crypto/mls';

import { GroupMailboxRoster } from '../../../../../contexts/groupMailboxes/domain/GroupMailboxRoster';
import { GroupMailboxRosterContext } from '../../../../../contexts/groupMailboxes/infrastructure/mls/GroupMailboxRosterContext';

const roster = GroupMailboxRoster.of({
  adminIds: ['bob'],
  conversationId: `group:${'A'.repeat(43)}`,
  creatorId: 'alice',
  memberIds: ['carol', 'alice', 'bob'],
  name: 'Team ✓',
  version: GroupMailboxRoster.VERSION,
}) as GroupMailboxRoster;

describe('GroupMailboxRosterContext', () => {
  it('carries the roster in the library roster extension', () => {
    const extension = GroupMailboxRosterContext.extension(roster);

    expect(extension.extensionType).toBe(0xf421);
    expect(GroupMailboxRosterExtension.decode(extension.extensionData)).toEqual(
      {
        ...roster.toFields(),
        memberIds: ['alice', 'bob', 'carol'],
      },
    );
  });

  it('reads the roster back from a context holding only its extension', () => {
    const extension = GroupMailboxRosterContext.extension(roster);

    expect(
      GroupMailboxRosterContext.read([extension])?.toFields(),
    ).toMatchObject({
      adminIds: ['bob'],
      creatorId: 'alice',
      memberIds: ['alice', 'bob', 'carol'],
      name: 'Team ✓',
    });
  });

  it('reads no roster from any other context', () => {
    const extension = GroupMailboxRosterContext.extension(roster);
    const { extensionData } = extension;

    expect(GroupMailboxRosterContext.read([])).toBeUndefined();
    expect(
      GroupMailboxRosterContext.read([extension, extension]),
    ).toBeUndefined();
    expect(
      GroupMailboxRosterContext.read([
        { extensionData, extensionType: 0xf420 },
      ]),
    ).toBeUndefined();
    expect(
      GroupMailboxRosterContext.read([
        {
          extensionData: new TextEncoder().encode('{}'),
          extensionType: GroupMailboxRosterExtension.EXTENSION_TYPE,
        },
      ]),
    ).toBeUndefined();
  });
});
