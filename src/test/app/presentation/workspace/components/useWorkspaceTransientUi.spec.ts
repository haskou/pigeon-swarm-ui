import { describe, expect, it } from '@jest/globals';

import { reduceWorkspaceTransientUi } from '../../../../../app/presentation/workspace/components/useWorkspaceTransientUi';

describe('reduceWorkspaceTransientUi', () => {
  const closedState = {
    'community-creation': false,
    'community-members': false,
    'conversation-creation': false,
    inspector: false,
    'node-settings': false,
    notifications: false,
    'realtime-events': false,
    sidebar: false,
  } as const;

  it('opens and closes one surface without changing the others', () => {
    const opened = reduceWorkspaceTransientUi(closedState, {
      surface: 'notifications',
      type: 'open',
    });

    expect(opened).toEqual({ ...closedState, notifications: true });
    expect(
      reduceWorkspaceTransientUi(opened, {
        surface: 'notifications',
        type: 'close',
      }),
    ).toEqual(closedState);
  });

  it('closes every transient surface together', () => {
    const openState = {
      ...closedState,
      inspector: true,
      notifications: true,
      sidebar: true,
    };

    expect(
      reduceWorkspaceTransientUi(openState, { type: 'close-all' }),
    ).toEqual(closedState);
  });
});
