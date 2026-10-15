import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { announceIdentityUpdate } from '../../../../app/presentation/workspace/announceIdentityUpdate';

jest.mock('../../../../app/composition/applicationContainer', () => ({
  applicationContainer: {
    groupMessages: { identityUpdated: jest.fn() },
  },
}));

const identityUpdated = jest.mocked(
  applicationContainer.groupMessages.identityUpdated,
);
const session = {} as Session;
const conversation = (id: string, type: string) =>
  ({ id, type }) as unknown as ConversationResource;

async function settle(): Promise<void> {
  for (let tick = 0; tick < 5; tick += 1) {
    await Promise.resolve();
  }
}

describe('announceIdentityUpdate', () => {
  beforeEach(() => {
    identityUpdated.mockReset().mockResolvedValue(undefined);
  });

  it('announces the update to every group conversation only', () => {
    announceIdentityUpdate(session, [
      conversation('group-1', 'group'),
      conversation('direct-1', 'direct'),
      conversation('group-2', 'group'),
      conversation('odd-1', 'unknown'),
    ]);

    expect(identityUpdated.mock.calls).toEqual([
      [session, 'group-1'],
      [session, 'group-2'],
    ]);
  });

  it('keeps announcing to the other groups when one announcement fails', async () => {
    identityUpdated.mockRejectedValueOnce(new TypeError('offline'));

    announceIdentityUpdate(session, [
      conversation('group-1', 'group'),
      conversation('group-2', 'group'),
    ]);
    await settle();

    expect(identityUpdated.mock.calls).toEqual([
      [session, 'group-1'],
      [session, 'group-2'],
    ]);
  });
});
