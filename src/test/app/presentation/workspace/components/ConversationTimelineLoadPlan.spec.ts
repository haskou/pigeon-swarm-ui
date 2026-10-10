import { describe, expect, it } from '@jest/globals';

import { ConversationTimelineLoadPlan } from '../../../../../app/presentation/workspace/components/ConversationTimelineLoadPlan';

describe(ConversationTimelineLoadPlan.name, () => {
  const activeContext = {
    activeConversationId: 'conversation',
    activeConversationKeyAvailable: true,
    loadedConversationId: null,
    workspaceMode: 'messages' as const,
  };

  it('clears timelines that are not available in the active workspace', () => {
    expect(
      ConversationTimelineLoadPlan.decide({
        ...activeContext,
        activeConversationKeyAvailable: false,
      }),
    ).toBe('clear');
    expect(
      ConversationTimelineLoadPlan.decide({
        ...activeContext,
        workspaceMode: 'community',
      }),
    ).toBe('clear');
  });

  it('preserves an already loaded conversation and loads a different one', () => {
    expect(
      ConversationTimelineLoadPlan.decide({
        ...activeContext,
        loadedConversationId: 'conversation',
      }),
    ).toBe('preserve');
    expect(
      ConversationTimelineLoadPlan.decide({
        ...activeContext,
        loadedConversationId: 'other',
      }),
    ).toBe('load');
  });
});
