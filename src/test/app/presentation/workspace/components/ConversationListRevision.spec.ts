import { describe, expect, it } from '@jest/globals';

import { ConversationListRevision } from '../../../../../app/presentation/workspace/components/ConversationListRevision';

describe('ConversationListRevision', () => {
  it('keeps a request current while no list is written', () => {
    const revision = new ConversationListRevision();
    const isCurrent = revision.begin();

    expect(isCurrent()).toBe(true);
  });

  it('marks a request stale once a list is written after it began', () => {
    const revision = new ConversationListRevision();
    const isCurrent = revision.begin();

    revision.recordWrite();

    expect(isCurrent()).toBe(false);
  });

  it('keeps a request stale after later writes', () => {
    const revision = new ConversationListRevision();
    const isCurrent = revision.begin();

    revision.recordWrite();
    revision.recordWrite();

    expect(isCurrent()).toBe(false);
  });

  it('treats a request begun after a write as current', () => {
    const revision = new ConversationListRevision();

    revision.recordWrite();
    const isCurrent = revision.begin();

    expect(isCurrent()).toBe(true);
  });

  it('keeps an earlier request stale without affecting a later one', () => {
    const revision = new ConversationListRevision();
    const earlier = revision.begin();

    revision.recordWrite();
    const later = revision.begin();

    expect(earlier()).toBe(false);
    expect(later()).toBe(true);
  });
});
