import { Timestamp } from '@haskou/value-objects';

import { ContactPresence } from '../../../../contexts/identities/domain/ContactPresence';
import { ContactPresenceBoard } from '../../../../contexts/identities/domain/ContactPresenceBoard';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';

const CONTACT = IdentityId.fromString('identity-b');
const PHONE = 'AAAAAAAAAAAAAAAAAAAAAA';
const LAPTOP = 'BBBBBBBBBBBBBBBBBBBBBB';

const update = (
  status: string,
  sequence: number,
  sentAt = 0,
  source = PHONE,
  authorId = 'identity-b',
): ContactPresence =>
  ContactPresence.fromPrimitives({
    authorId,
    expiresAt: sentAt + 90_000,
    sentAt,
    sequence,
    source,
    status,
  });

const statusAt = (board: ContactPresenceBoard, at: number): string =>
  board.presenceOf(CONTACT, new Timestamp(at)).toPrimitives().status;

describe(ContactPresenceBoard.name, () => {
  it('shows a contact as disconnected until an update arrives', () => {
    expect(statusAt(new ContactPresenceBoard(), 0)).toBe('disconnected');
  });

  it('shows the latest status until it expires', () => {
    const board = new ContactPresenceBoard();

    expect(board.accept(update('available', 1), new Timestamp(0))).toBe(true);
    expect(statusAt(board, 89_999)).toBe('available');
    expect(statusAt(board, 90_000)).toBe('disconnected');
  });

  it('caps a sender clock running ahead at one lifetime after receipt', () => {
    const board = new ContactPresenceBoard();

    board.accept(update('available', 1, 60_000), new Timestamp(0));

    expect(statusAt(board, 89_999)).toBe('available');
    expect(statusAt(board, 90_000)).toBe('disconnected');
  });

  it('rejects an update that already expired', () => {
    const board = new ContactPresenceBoard();

    expect(board.accept(update('available', 1), new Timestamp(90_000))).toBe(
      false,
    );
    expect(statusAt(board, 90_000)).toBe('disconnected');
  });

  it('rejects an older or replayed sequence from the same source', () => {
    const board = new ContactPresenceBoard();

    board.accept(update('busy', 2, 10_000), new Timestamp(10_000));

    expect(board.accept(update('away', 1, 0), new Timestamp(10_000))).toBe(
      false,
    );
    expect(board.accept(update('away', 2, 10_000), new Timestamp(20_000))).toBe(
      false,
    );
    expect(statusAt(board, 20_000)).toBe('busy');
  });

  it('keeps rejecting a replay while the sender expiry outlives the local cap', () => {
    const board = new ContactPresenceBoard();
    const ahead = update('available', 1, 60_000);

    board.accept(ahead, new Timestamp(0));

    expect(board.accept(ahead, new Timestamp(100_000))).toBe(false);
    expect(statusAt(board, 100_000)).toBe('disconnected');
  });

  it('ranks busy over available over away across sources', () => {
    const board = new ContactPresenceBoard();

    board.accept(update('away', 1, 0, PHONE), new Timestamp(0));
    board.accept(update('available', 1, 0, LAPTOP), new Timestamp(0));
    expect(statusAt(board, 1_000)).toBe('available');

    board.accept(update('busy', 2, 1_000, PHONE), new Timestamp(1_000));
    expect(statusAt(board, 1_000)).toBe('busy');
  });

  it('keeps each contact apart and forgets one on request', () => {
    const board = new ContactPresenceBoard();

    board.accept(update('busy', 1, 0, PHONE, 'identity-c'), new Timestamp(0));
    board.accept(update('away', 1), new Timestamp(0));
    expect(statusAt(board, 0)).toBe('away');

    board.forget(CONTACT);
    expect(statusAt(board, 0)).toBe('disconnected');
    expect(
      board
        .presenceOf(IdentityId.fromString('identity-c'), new Timestamp(0))
        .toPrimitives().status,
    ).toBe('busy');
  });
});
