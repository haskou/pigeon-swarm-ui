import { Timestamp } from '@haskou/value-objects';
import { mock } from 'jest-mock-extended';

import type { ContactPresenceRepository } from '../../../../../contexts/identities/domain/repositories/ContactPresenceRepository';
import type { PresenceSharingRepository } from '../../../../../contexts/identities/domain/repositories/PresenceSharingRepository';

import { ContactPresencePublisher } from '../../../../../contexts/identities/application/publish-contact-presence/ContactPresencePublisher';
import { PublishContactPresenceMessage } from '../../../../../contexts/identities/application/publish-contact-presence/messages/PublishContactPresenceMessage';
import { ContactPresencesReceiver } from '../../../../../contexts/identities/application/receive-contact-presences/ContactPresencesReceiver';
import { ReceiveContactPresencesMessage } from '../../../../../contexts/identities/application/receive-contact-presences/messages/ReceiveContactPresencesMessage';
import { ContactPresencesSearcher } from '../../../../../contexts/identities/application/search-contact-presences/ContactPresencesSearcher';
import { SearchContactPresencesMessage } from '../../../../../contexts/identities/application/search-contact-presences/messages/SearchContactPresencesMessage';
import { PresenceSharingsSearcher } from '../../../../../contexts/identities/application/search-presence-sharings/PresenceSharingsSearcher';
import { SearchPresenceSharingsMessage } from '../../../../../contexts/identities/application/search-presence-sharings/messages/SearchPresenceSharingsMessage';
import { ContactPresenceSharer } from '../../../../../contexts/identities/application/share-contact-presence/ContactPresenceSharer';
import { ShareContactPresenceMessage } from '../../../../../contexts/identities/application/share-contact-presence/messages/ShareContactPresenceMessage';
import { ContactPresenceSharingStopper } from '../../../../../contexts/identities/application/stop-sharing-contact-presence/ContactPresenceSharingStopper';
import { StopSharingContactPresenceMessage } from '../../../../../contexts/identities/application/stop-sharing-contact-presence/messages/StopSharingContactPresenceMessage';
import { ContactPresence } from '../../../../../contexts/identities/domain/ContactPresence';
import { ContactPresenceBoard } from '../../../../../contexts/identities/domain/ContactPresenceBoard';
import { ContactPresenceBroadcast } from '../../../../../contexts/identities/domain/ContactPresenceBroadcast';
import { PresenceSharing } from '../../../../../contexts/identities/domain/PresenceSharing';
import { ContactPresenceSource } from '../../../../../contexts/identities/domain/value-objects/ContactPresenceSource';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';

const ACTOR = 'identity-a';
const sharingWithB = PresenceSharing.fromPrimitives({
  contactIdentityId: 'identity-b',
  conversationId: 'conversation-b',
});
const sharingWithC = PresenceSharing.fromPrimitives({
  contactIdentityId: 'identity-c',
  conversationId: 'conversation-c',
});

const update = (authorId: string, status: string, sequence = 1) =>
  ContactPresence.fromPrimitives({
    authorId,
    expiresAt: 90_000,
    sentAt: 0,
    sequence,
    source: 'BBBBBBBBBBBBBBBBBBBBBB',
    status,
  });

const setup = (sharings: PresenceSharing[] = [sharingWithB, sharingWithC]) => {
  const sharingRepository = mock<PresenceSharingRepository>();
  const presenceRepository = mock<ContactPresenceRepository>();
  const board = new ContactPresenceBoard();
  const broadcast = new ContactPresenceBroadcast(
    IdentityId.fromString(ACTOR),
    ContactPresenceSource.fromString('AAAAAAAAAAAAAAAAAAAAAA'),
  );

  sharingRepository.search.mockResolvedValue(sharings);
  presenceRepository.board.mockReturnValue(board);
  presenceRepository.broadcast.mockReturnValue(broadcast);
  presenceRepository.receive.mockResolvedValue([]);
  presenceRepository.publish.mockResolvedValue();
  presenceRepository.close.mockResolvedValue();

  return { board, presenceRepository, sharingRepository };
};

const statuses = (presences: { toPrimitives(): { identityId: string; status: string } }[]) =>
  presences.map((presence) => {
    const { identityId, status } = presence.toPrimitives();

    return { identityId, status };
  });

describe('contact presence use cases', () => {
  it('starts sharing with the peer of a direct conversation', async () => {
    const { sharingRepository } = setup();

    await new ContactPresenceSharer(sharingRepository).share(
      new ShareContactPresenceMessage(ACTOR, 'conversation-b', 'identity-b'),
    );

    expect(sharingRepository.save).toHaveBeenCalledWith(
      IdentityId.fromString(ACTOR),
      sharingWithB,
    );
  });

  it('stops sharing, closes the inbox and forgets what the contact sent', async () => {
    const { board, presenceRepository, sharingRepository } = setup();

    board.accept(update('identity-b', 'busy'), new Timestamp(0));

    await new ContactPresenceSharingStopper(
      sharingRepository,
      presenceRepository,
    ).stop(
      new StopSharingContactPresenceMessage(
        ACTOR,
        'conversation-b',
        'identity-b',
      ),
    );

    expect(sharingRepository.delete).toHaveBeenCalledWith(
      IdentityId.fromString(ACTOR),
      sharingWithB,
    );
    expect(presenceRepository.close).toHaveBeenCalledWith(
      IdentityId.fromString(ACTOR),
      sharingWithB,
    );
    expect(
      board
        .presenceOf(IdentityId.fromString('identity-b'), new Timestamp(0))
        .toPrimitives().status,
    ).toBe('disconnected');
  });

  it('searches the sharings of this device', async () => {
    const { sharingRepository } = setup();

    await expect(
      new PresenceSharingsSearcher(sharingRepository).search(
        new SearchPresenceSharingsMessage(ACTOR),
      ),
    ).resolves.toEqual([sharingWithB, sharingWithC]);
  });

  it('publishes nothing without a sharing', async () => {
    const { presenceRepository, sharingRepository } = setup([]);

    await new ContactPresencePublisher(
      sharingRepository,
      presenceRepository,
    ).publish(new PublishContactPresenceMessage(ACTOR, 'available', 0));

    expect(presenceRepository.publish).not.toHaveBeenCalled();
  });

  it('publishes nothing while invisible', async () => {
    const { presenceRepository, sharingRepository } = setup();

    await new ContactPresencePublisher(
      sharingRepository,
      presenceRepository,
    ).publish(new PublishContactPresenceMessage(ACTOR, 'invisible', 0));

    expect(presenceRepository.publish).not.toHaveBeenCalled();
  });

  it('publishes a due update to every contact it shares with', async () => {
    const { presenceRepository, sharingRepository } = setup();
    const publisher = new ContactPresencePublisher(
      sharingRepository,
      presenceRepository,
    );

    await publisher.publish(
      new PublishContactPresenceMessage(ACTOR, 'busy', 1_000),
    );
    await publisher.publish(
      new PublishContactPresenceMessage(ACTOR, 'busy', 2_000),
    );

    expect(
      presenceRepository.publish.mock.calls.map(([actor, sharing, presence]) => [
        actor.toString(),
        sharing.toPrimitives().contactIdentityId,
        presence.toPrimitives().status,
      ]),
    ).toEqual([
      [ACTOR, 'identity-b', 'busy'],
      [ACTOR, 'identity-c', 'busy'],
    ]);
  });

  it('receives updates only from the contact of each sharing', async () => {
    const { presenceRepository, sharingRepository } = setup();

    presenceRepository.receive.mockImplementation((_actor, sharing) =>
      Promise.resolve(
        sharing.isWith(IdentityId.fromString('identity-b'))
          ? [update('identity-b', 'away'), update('identity-c', 'busy')]
          : [],
      ),
    );

    await expect(
      new ContactPresencesReceiver(sharingRepository, presenceRepository)
        .receive(new ReceiveContactPresencesMessage(ACTOR, 1_000))
        .then(statuses),
    ).resolves.toEqual([
      { identityId: 'identity-b', status: 'away' },
      { identityId: 'identity-c', status: 'disconnected' },
    ]);
    expect(
      presenceRepository.receive.mock.calls.map(([, , receivedAt]) =>
        receivedAt.valueOf(),
      ),
    ).toEqual([1_000, 1_000]);
  });

  it('searches the board without touching the network', async () => {
    const { board, presenceRepository, sharingRepository } = setup();

    board.accept(update('identity-c', 'available'), new Timestamp(0));

    await expect(
      new ContactPresencesSearcher(sharingRepository, presenceRepository)
        .search(new SearchContactPresencesMessage(ACTOR, 1_000))
        .then(statuses),
    ).resolves.toEqual([
      { identityId: 'identity-b', status: 'disconnected' },
      { identityId: 'identity-c', status: 'available' },
    ]);
    expect(presenceRepository.receive).not.toHaveBeenCalled();
  });
});
