import type { ChatMessage } from '../../../../contexts/messages/domain/ChatMessage';
import type { DirectMessageTimelineChange } from '../../../../contexts/messages/domain/DirectMessageTimelineChange';

import { applyGroupTypingChanges } from '../../../../app/presentation/workspace/typingEntries';

const NOW = 1_700_000_000_000;
const typing = (
  identityId: string,
  createdAt: number,
): DirectMessageTimelineChange => ({ createdAt, identityId, kind: 'typing' });
const message = (authorIdentityId: string): DirectMessageTimelineChange => ({
  kind: 'message',
  message: { authorIdentityId } as ChatMessage,
});

describe('applyGroupTypingChanges', () => {
  it('shows a member typing until 15 seconds after the notice was written', () => {
    expect(
      applyGroupTypingChanges({}, 'group-1', [typing('bob', NOW - 4_000)], NOW),
    ).toEqual({ 'group-1': { bob: NOW + 11_000 } });
  });

  it('never shows a notice dated in the future for more than 15 seconds', () => {
    expect(
      applyGroupTypingChanges({}, 'group-1', [typing('bob', NOW + 60_000)], NOW),
    ).toEqual({ 'group-1': { bob: NOW + 15_000 } });
  });

  it('ignores a notice read after it expired', () => {
    const entries = {};

    expect(
      applyGroupTypingChanges(
        entries,
        'group-1',
        [typing('bob', NOW - 15_000)],
        NOW,
      ),
    ).toBe(entries);
  });

  it('ends a member’s typing with its message, leaving the others', () => {
    expect(
      applyGroupTypingChanges(
        { 'group-1': { bob: NOW + 5_000, carol: NOW + 5_000 } },
        'group-1',
        [message('bob')],
        NOW,
      ),
    ).toEqual({ 'group-1': { carol: NOW + 5_000 } });
  });

  it('keeps the entries when a message ends no typing', () => {
    const entries = { 'group-1': { carol: NOW + 5_000 } };

    expect(
      applyGroupTypingChanges(entries, 'group-1', [message('bob')], NOW),
    ).toBe(entries);
  });

  it('applies the changes in inbox order', () => {
    expect(
      applyGroupTypingChanges(
        {},
        'group-1',
        [typing('bob', NOW), message('bob'), typing('carol', NOW)],
        NOW,
      ),
    ).toEqual({ 'group-1': { carol: NOW + 15_000 } });
  });
});
