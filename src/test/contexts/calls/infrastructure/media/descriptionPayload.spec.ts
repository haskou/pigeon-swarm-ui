import { descriptionPayload } from '../../../../../contexts/calls/infrastructure/media/descriptionPayload';

describe(descriptionPayload.name, () => {
  it('includes call media encryption metadata when provided', () => {
    expect(
      descriptionPayload({ sdp: 'v=0', type: 'offer' }, [], [], [], [], {
        acceptsEncrypted: true,
        enabled: true,
        version: 1,
      }),
    ).toMatchObject({
      mediaEncryption: {
        acceptsEncrypted: true,
        enabled: true,
        version: 1,
      },
      sdp: 'v=0',
      type: 'offer',
    });
  });
});
