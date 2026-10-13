import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { WorkspaceMode } from '../../../../app/presentation/workspace/components/WorkspaceMode';
import type { WorkspacePreference } from '../../../../app/presentation/workspace/components/WorkspacePreference';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { loadWorkspacePreference } from '../../../../app/presentation/workspace/components/workspacePersistence';
import { useWorkspacePreferenceState } from '../../../../app/presentation/workspace/useWorkspacePreferences';

type WorkspaceSelection = {
  activeCommunityId: null | string;
  setActiveCommunityId: (communityId: string) => void;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  workspaceMode: WorkspaceMode;
};

const mockCells: Array<{ value: unknown }> = [];
const mockEffectDeps: Array<readonly unknown[] | undefined> = [];
const mockRender = {
  cellIndex: 0,
  dirty: false,
  effectIndex: 0,
  queued: [] as Array<() => void>,
};

jest.mock('react', () => ({
  useEffect: (effect: () => void, deps?: readonly unknown[]) => {
    const index = mockRender.effectIndex;

    mockRender.effectIndex += 1;

    const previous = mockEffectDeps[index];
    const changed =
      previous === undefined ||
      deps === undefined ||
      deps.some((dep, position) => !Object.is(dep, previous[position]));

    if (changed) mockRender.queued.push(effect);
    mockEffectDeps[index] = deps;
  },
  useState: (initial: unknown) => {
    const index = mockRender.cellIndex;

    mockRender.cellIndex += 1;

    const cell = mockCells[index] ?? {
      value:
        typeof initial === 'function' ? (initial as () => unknown)() : initial,
    };

    mockCells[index] = cell;

    const setValue = (update: unknown) => {
      const next =
        typeof update === 'function'
          ? (update as (current: unknown) => unknown)(cell.value)
          : update;

      if (Object.is(next, cell.value)) return;
      cell.value = next;
      mockRender.dirty = true;
    };

    return [cell.value, setValue];
  },
}));
jest.mock(
  '../../../../app/presentation/workspace/components/workspacePersistence',
  () => ({
    ...jest.requireActual<object>(
      '../../../../app/presentation/workspace/components/workspacePersistence',
    ),
    initialConversationId: () => null,
    loadCommunityUnreadCounts: () => ({}),
    loadEncryptedDraftPayloads: () => ({}),
    loadWorkspacePreference: jest.fn(),
  }),
);
jest.mock(
  '../../../../contexts/messages/infrastructure/crypto/DraftPayloadCipher',
  () => ({
    DraftPayloadCipher: class {
      public decrypt(): null {
        return null;
      }
    },
  }),
);

const storedPreference = jest.mocked(loadWorkspacePreference);

function sessionFor(identityId: string): Session {
  return { identity: { id: identityId } } as unknown as Session;
}

function render(session: Session): WorkspaceSelection {
  for (let pass = 0; pass < 10; pass += 1) {
    mockRender.cellIndex = 0;
    mockRender.effectIndex = 0;
    mockRender.dirty = false;

    const state = useWorkspacePreferenceState([], session);
    const effects = mockRender.queued;

    mockRender.queued = [];
    effects.forEach((effect) => effect());

    if (!mockRender.dirty) return state;
  }

  throw new Error('The workspace preference state did not settle.');
}

describe('useWorkspacePreferenceState', () => {
  beforeEach(() => {
    mockCells.length = 0;
    mockEffectDeps.length = 0;
    mockRender.queued = [];
    storedPreference.mockImplementation(
      (): WorkspacePreference => ({ communityId: null, mode: 'messages' }),
    );
  });

  it('keeps the opened community when the same identity gets a new session', () => {
    const opened = render(sessionFor('identity-1'));

    opened.setActiveCommunityId('community-1');
    opened.setWorkspaceMode('community');

    const state = render(sessionFor('identity-1'));

    expect(state.workspaceMode).toBe('community');
    expect(state.activeCommunityId).toBe('community-1');
  });

  it('restores the stored workspace of another identity', () => {
    render(sessionFor('identity-1'));
    storedPreference.mockImplementation(
      (identityId): WorkspacePreference =>
        identityId === 'identity-2'
          ? { communityId: 'community-2', mode: 'community' }
          : { communityId: null, mode: 'messages' },
    );

    const state = render(sessionFor('identity-2'));

    expect(state.workspaceMode).toBe('community');
    expect(state.activeCommunityId).toBe('community-2');
  });
});
