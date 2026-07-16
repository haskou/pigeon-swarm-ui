import { NullObject } from '@haskou/value-objects';

import { AttachmentPublicationPlan } from '../../../../contexts/attachments/domain/AttachmentPublicationPlan';
import { AttachmentNetworkId } from '../../../../contexts/attachments/domain/value-objects/AttachmentNetworkId';

describe(AttachmentPublicationPlan.name, () => {
  it('requires a network for encrypted publication', () => {
    expect(() =>
      AttachmentPublicationPlan.encrypted(NullObject.new(AttachmentNetworkId)),
    ).toThrow('Encrypted attachment publication requires a network.');
  });

  it('keeps public publication independent from a network', () => {
    const plan = AttachmentPublicationPlan.public();

    expect(plan.isEncrypted()).toBe(false);
  });
});
