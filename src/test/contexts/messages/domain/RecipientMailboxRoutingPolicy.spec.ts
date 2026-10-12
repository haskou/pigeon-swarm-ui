import { RecipientMailboxRoutingPolicy } from '../../../../contexts/messages/domain/RecipientMailboxRoutingPolicy';

const DELIVERED = 'appended';
const HOME_FAULT = new Error('home fault');
const LOCAL_FAULT = new Error('local fault');
const NO_INBOX = new Error('no inbox');

describe(RecipientMailboxRoutingPolicy.name, () => {
  it('delivers locally when no home is published', () => {
    expect(
      RecipientMailboxRoutingPolicy.resolve(
        { kind: 'absent' },
        { kind: 'delivered', value: DELIVERED },
      ),
    ).toBe(DELIVERED);
  });

  it('delivers locally after a kept home fault', () => {
    expect(
      RecipientMailboxRoutingPolicy.resolve(
        { error: HOME_FAULT, kind: 'faulted' },
        { kind: 'delivered', value: DELIVERED },
      ),
    ).toBe(DELIVERED);
  });

  it('rethrows the home fault when the local inbox is absent', () => {
    expect(() =>
      RecipientMailboxRoutingPolicy.resolve(
        { error: HOME_FAULT, kind: 'faulted' },
        { error: NO_INBOX, kind: 'absent' },
      ),
    ).toThrow(HOME_FAULT);
  });

  it('rethrows the local absence when no home fault is kept', () => {
    expect(() =>
      RecipientMailboxRoutingPolicy.resolve(
        { kind: 'absent' },
        { error: NO_INBOX, kind: 'absent' },
      ),
    ).toThrow(NO_INBOX);
  });

  it('rethrows the local fault when the local append fails after a home fault', () => {
    expect(() =>
      RecipientMailboxRoutingPolicy.resolve(
        { error: HOME_FAULT, kind: 'faulted' },
        { error: LOCAL_FAULT, kind: 'faulted' },
      ),
    ).toThrow(LOCAL_FAULT);
  });

  it('rethrows the local fault when no home fault is kept', () => {
    expect(() =>
      RecipientMailboxRoutingPolicy.resolve(
        { kind: 'absent' },
        { error: LOCAL_FAULT, kind: 'faulted' },
      ),
    ).toThrow(LOCAL_FAULT);
  });
});
