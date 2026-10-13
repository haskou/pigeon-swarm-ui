import { DomainError } from '@haskou/value-objects';

import { DirectMailboxRecordError } from '../../../../contexts/mailboxes/domain/DirectMailboxRecordError';

describe('DirectMailboxRecordError', () => {
  it('is a domain error that keeps the broken rule as its message', () => {
    const error = new DirectMailboxRecordError(
      'Direct mailbox needs a one-to-one conversation.',
    );

    expect(error).toBeInstanceOf(DomainError);
    expect(DomainError.isDomainError(error)).toBe(true);
    expect(error.message).toBe(
      'Direct mailbox needs a one-to-one conversation.',
    );
  });
});
