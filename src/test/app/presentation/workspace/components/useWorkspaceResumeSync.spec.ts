import { workspaceResumeSyncPlan } from '../../../../../app/presentation/workspace/components/useWorkspaceResumeSync';

describe(workspaceResumeSyncPlan.name, () => {
  it('does not refresh conversations while resuming a visible community workspace', () => {
    expect(
      workspaceResumeSyncPlan({
        workspaceMode: 'community',
        workspaceWasHidden: false,
      }),
    ).toEqual({
      refreshConversations: false,
      reloadCommunities: false,
    });
  });

  it('reloads communities without refreshing conversations after a hidden community workspace resumes', () => {
    expect(
      workspaceResumeSyncPlan({
        workspaceMode: 'community',
        workspaceWasHidden: true,
      }),
    ).toEqual({
      refreshConversations: false,
      reloadCommunities: true,
    });
  });

  it('refreshes conversations while resuming a messages workspace', () => {
    expect(
      workspaceResumeSyncPlan({
        workspaceMode: 'messages',
        workspaceWasHidden: true,
      }),
    ).toEqual({
      refreshConversations: true,
      reloadCommunities: false,
    });
  });
});
