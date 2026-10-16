import { descriptionPayload } from '../../../../../contexts/calls/infrastructure/media/descriptionPayload';

describe(descriptionPayload.name, () => {
  it('includes call media encryption metadata when provided', () => {
    expect(
      descriptionPayload({ sdp: 'v=0', type: 'offer' }, [], [], [], [], {
        acceptsEncrypted: true,
        enabled: true,
        version: 2,
      }),
    ).toMatchObject({
      mediaEncryption: {
        acceptsEncrypted: true,
        enabled: true,
        version: 2,
      },
      sdp: 'v=0',
      type: 'offer',
    });
  });
});
