import { createHash } from 'crypto';

import { ConversationIdFactory } from '../../../../contexts/conversations/domain/ConversationIdFactory';

describe(ConversationIdFactory.name, () => {
  it('creates the same one-to-one id as the backend including network id', () => {
    const factory = new ConversationIdFactory();
    const networkId = 'network-1';
    const expectedHash = createHash('sha256')
      .update(`identity-a:identity-b:${networkId}`)
      .digest('hex');

    expect(factory.create('identity-b', 'identity-a', networkId)).toBe(
      `one-to-one:${expectedHash}`,
    );
  });

  it('changes the one-to-one id when the network changes', () => {
    const factory = new ConversationIdFactory();

    expect(factory.create('identity-a', 'identity-b', 'network-1')).not.toBe(
      factory.create('identity-a', 'identity-b', 'network-2'),
    );
  });
});
