import { NullObject } from '@haskou/value-objects';

import { EncryptedAttachmentStrategy } from '../../../../../contexts/attachments/domain/strategies/EncryptedAttachmentStrategy';
import { PublicAttachmentStrategy } from '../../../../../contexts/attachments/domain/strategies/PublicAttachmentStrategy';
import { AttachmentNetworkId } from '../../../../../contexts/attachments/domain/value-objects/AttachmentNetworkId';

describe('Attachment publication strategies', () => {
  it('exposes the encryption network for encrypted publication', () => {
    const strategy = EncryptedAttachmentStrategy.forNetwork(
      AttachmentNetworkId.fromString('network-1'),
    );

    expect(strategy.isEncrypted()).toBe(true);
    expect(strategy.getEncryptionNetworkId().toString()).toBe('network-1');
    expect(strategy.toPrimitives()).toEqual({
      encrypted: true,
      networkId: 'network-1',
    });
  });

  it('represents public publication without an encryption network', () => {
    const strategy = PublicAttachmentStrategy.create();

    expect(strategy.isEncrypted()).toBe(false);
    expect(NullObject.isNullObject(strategy.getEncryptionNetworkId())).toBe(
      true,
    );
    expect(strategy.toPrimitives()).toEqual({ encrypted: false });
  });

  it('serializes an encrypted strategy restored without its network', () => {
    const strategy = EncryptedAttachmentStrategy.restore();

    expect(strategy.toPrimitives()).toEqual({ encrypted: true });
  });
});
