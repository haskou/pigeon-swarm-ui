import { createHash } from 'crypto';

import { ConversationIdFactory } from '../../../../contexts/conversations/domain/ConversationIdFactory';
import { ConversationGroupNonce } from '../../../../contexts/conversations/domain/value-objects/ConversationGroupNonce';
import { ConversationNetworkId } from '../../../../contexts/conversations/domain/value-objects/ConversationNetworkId';
import { ConversationParticipantId } from '../../../../contexts/conversations/domain/value-objects/ConversationParticipantId';

import vectors from '../../../fixtures/conversation-operation-vectors.json';

const participant = ConversationParticipantId.fromString;
const network = ConversationNetworkId.fromString;

describe(ConversationIdFactory.name, () => {
  it.each([
    ['identity-a', 'identity-B', 'identity-B:identity-a'],
    ['identity-+', 'identity-/', 'identity-+:identity-/'],
    ['identity-z', 'identity-Z', 'identity-Z:identity-z'],
  ])('matches backend ordering for %s and %s', (left, right, ordered) => {
    const expected = `one-to-one:${createHash('sha256').update(`${ordered}:network-1`).digest('hex')}`;
    const factory = new ConversationIdFactory();

    expect(
      factory
        .create(participant(left), participant(right), network('network-1'))
        .toString(),
    ).toBe(expected);
    expect(
      factory
        .create(participant(right), participant(left), network('network-1'))
        .toString(),
    ).toBe(expected);
  });

  it('creates the same one-to-one id as the backend including network id', () => {
    const factory = new ConversationIdFactory();
    const networkId = 'network-1';
    const expectedHash = createHash('sha256')
      .update(`identity-a:identity-b:${networkId}`)
      .digest('hex');

    expect(
      factory
        .create(
          participant('identity-b'),
          participant('identity-a'),
          network(networkId),
        )
        .toString(),
    ).toBe(`one-to-one:${expectedHash}`);
  });

  it('changes the one-to-one id when the network changes', () => {
    const factory = new ConversationIdFactory();

    expect(
      factory
        .create(
          participant('identity-a'),
          participant('identity-b'),
          network('network-1'),
        )
        .isNotEqual(
          factory.create(
            participant('identity-a'),
            participant('identity-b'),
            network('network-2'),
          ),
        ),
    ).toBe(true);
  });

  it.each(['group', 'group_unicode'] as const)(
    'derives the %s id the backend vectors expect',
    (name) => {
      const { conversationId, conversationIdPreimage, nonce } =
        vectors.conversations[name];
      const { creatorIdentityId, networkId } = JSON.parse(
        conversationIdPreimage,
      ) as { creatorIdentityId: string; networkId: string };

      expect(
        new ConversationIdFactory()
          .createGroup(
            participant(creatorIdentityId),
            network(networkId),
            ConversationGroupNonce.fromString(nonce),
          )
          .toString(),
      ).toBe(conversationId);
    },
  );

  it('changes the group id when the nonce changes', () => {
    const factory = new ConversationIdFactory();
    const create = (nonce: string) =>
      factory.createGroup(
        participant('identity-a'),
        network('network-1'),
        ConversationGroupNonce.fromString(nonce),
      );

    expect(create('nonce-a').isNotEqual(create('nonce-b'))).toBe(true);
  });
});
