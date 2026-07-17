import { createHash } from 'crypto';

import { ConversationIdFactory } from '../../../../contexts/conversations/domain/ConversationIdFactory';
import { ConversationNetworkId } from '../../../../contexts/conversations/domain/value-objects/ConversationNetworkId';
import { ConversationParticipantId } from '../../../../contexts/conversations/domain/value-objects/ConversationParticipantId';

const participant = ConversationParticipantId.fromString;
const network = ConversationNetworkId.fromString;

describe(ConversationIdFactory.name, () => {
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
});
